"""Dependency-advisory check — flags known-vulnerable packages touched by a PR.

Not LLM-based: version-vulnerability matching is a lookup problem, not a
judgment call, so this queries OSV.dev's batch API directly against changed
dependency files (requirements.txt, package.json/-lock.json for now).

Runs independently of security_review.py / llm_review.py — no RAG, no model
call. Wire its output into main.py's comment/severity merge alongside the
other two passes.
"""
import json
import re
import requests
from dataclasses import dataclass
from src.diff_parser import FileDiff

OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch"

DEPENDENCY_FILENAMES = {
    "requirements.txt": "PyPI",
    "package.json": "npm",
    "package-lock.json": "npm",
}

# name==1.2.3 / name>=1.2.3 / name~=1.2.3 etc — captures name + pinned/lower version
_REQ_LINE_RE = re.compile(r"^([A-Za-z0-9_.\-]+)\s*(?:==|>=|~=)\s*([A-Za-z0-9_.\-]+)")


@dataclass
class DependencyFinding:
    package: str
    version: str
    ecosystem: str
    vuln_id: str
    summary: str
    severity: str  # "critical" | "warning" — derived from OSV data when available


def _extract_pypi_deps(file_diff: FileDiff) -> list[tuple[str, str]]:
    deps = []
    for added in file_diff.added_lines:
        line = added.content.strip()
        if not line or line.startswith("#"):
            continue
        m = _REQ_LINE_RE.match(line)
        if m:
            deps.append((m.group(1), m.group(2)))
    return deps


def _extract_npm_deps(file_diff: FileDiff) -> list[tuple[str, str]]:
    # Cheap line-level scan of added diff lines, not a full JSON parse — the
    # diff only contains changed lines, not a parseable JSON document.
    deps = []
    line_re = re.compile(r'"([A-Za-z0-9_.\-@/]+)"\s*:\s*"[~^]?([0-9][A-Za-z0-9_.\-]*)"')
    for added in file_diff.added_lines:
        m = line_re.search(added.content)
        if m:
            deps.append((m.group(1), m.group(2)))
    return deps


def extract_dependencies(file_diff: FileDiff) -> list[tuple[str, str, str]]:
    """Returns list of (package, version, ecosystem) touched by this file's diff."""
    ecosystem = DEPENDENCY_FILENAMES.get(file_diff.filename.split("/")[-1])
    if not ecosystem:
        return []
    if ecosystem == "PyPI":
        pairs = _extract_pypi_deps(file_diff)
    else:
        pairs = _extract_npm_deps(file_diff)
    return [(name, version, ecosystem) for name, version in pairs]


def _severity_from_osv(vuln: dict) -> str:
    for sev in vuln.get("severity", []):
        score = sev.get("score", "")
        if score.startswith(("9", "10")) or "CRITICAL" in score.upper():
            return "critical"
    for alias in vuln.get("database_specific", {}).get("severity", ""), "":
        if alias and "CRITICAL" in str(alias).upper():
            return "critical"
    return "warning"


def check_dependencies(file_diffs: list[FileDiff], timeout: int = 15) -> list[DependencyFinding]:
    """Batch-queries OSV.dev for every dependency touched across the given file
    diffs. Never raises — returns [] on any network/parse failure so it can't
    break the pipeline."""
    targets: list[tuple[str, str, str]] = []
    for fd in file_diffs:
        targets.extend(extract_dependencies(fd))

    if not targets:
        return []

    queries = [
        {"version": version, "package": {"name": name, "ecosystem": ecosystem}}
        for name, version, ecosystem in targets
    ]

    try:
        resp = requests.post(
            OSV_BATCH_URL, json={"queries": queries}, timeout=timeout
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
    except Exception as e:
        print(f"Warning: dependency check failed (OSV query): {e}")
        return []

    findings = []
    for (name, version, ecosystem), result in zip(targets, results):
        for vuln in result.get("vulns", []):
            findings.append(DependencyFinding(
                package=name,
                version=version,
                ecosystem=ecosystem,
                vuln_id=vuln.get("id", "UNKNOWN"),
                summary=(vuln.get("summary") or vuln.get("details") or "").strip()[:200],
                severity=_severity_from_osv(vuln),
            ))
    return findings