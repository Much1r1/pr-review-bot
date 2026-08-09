"""Simple rule-based checks over added lines. Deliberately dumb for Week 1 —
the goal is a working end-to-end pipeline before any LLM is involved.
Each rule takes a FileDiff and yields (line_number, message) tuples.
"""
import re
from dataclasses import dataclass
from src.diff_parser import FileDiff


@dataclass
class Finding:
    line_number: int
    message: str
    severity: str  # "info" | "warning" | "critical"


def check_todo_comments(file_diff: FileDiff) -> list[Finding]:
    findings = []
    for added in file_diff.added_lines:
        if re.search(r"\b(TODO|FIXME|XXX)\b", added.content):
            findings.append(Finding(
                line_number=added.line_number,
                message="Left a TODO/FIXME in the diff — confirm this is intentional before merging.",
                severity="info",
            ))
    return findings


def check_print_debugging(file_diff: FileDiff) -> list[Finding]:
    if not file_diff.filename.endswith(".py"):
        return []
    findings = []
    for added in file_diff.added_lines:
        stripped = added.content.strip()
        if stripped.startswith("print(") and "debug" not in stripped.lower():
            findings.append(Finding(
                line_number=added.line_number,
                message="Stray print() statement — likely leftover debugging output.",
                severity="warning",
            ))
    return findings


def check_hardcoded_secrets(file_diff: FileDiff) -> list[Finding]:
    """Very naive pattern match — a real security pass (Week 3) will do much better.
    This exists in Week 1 purely to prove the pipeline can flag something meaningful."""
    findings = []
    patterns = [
        (r"(?i)(api[_-]?key|secret|password|token)\s*=\s*[\"'][A-Za-z0-9+/=_-]{8,}[\"']", "critical"),
    ]
    for added in file_diff.added_lines:
        for pattern, severity in patterns:
            if re.search(pattern, added.content):
                findings.append(Finding(
                    line_number=added.line_number,
                    message="Possible hardcoded secret/credential — verify this isn't a real key.",
                    severity=severity,
                ))
    return findings


ALL_RULES = [check_todo_comments, check_print_debugging, check_hardcoded_secrets]


def run_rules(file_diff: FileDiff) -> list[Finding]:
    findings = []
    for rule in ALL_RULES:
        findings.extend(rule(file_diff))
    return findings