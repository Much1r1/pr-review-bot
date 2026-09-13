"""Entry point — wires diff parsing, rule checks, RAG-backed LLM review,
dedicated security review, and dependency-advisory checking into one run,
then posts merged PR comments. Check status is implicit: sys.exit(1) on a
critical finding fails the Action step (there's no separate status API call).
"""
import os
import sys
from pathlib import Path

from src.github_client import GitHubClient
from src.diff_parser import parse_pr_files, FileDiff
from src.rules import run_rules
from src.rag_index import build_repo_index
from src.code_chunker import chunk_repo
from src.llm_review import review_file_diff
from src.security_review import security_review_file_diff
from src.dependency_check import check_dependencies

SEVERITY_ORDER = {"critical": 0, "high": 1, "warning": 2, "info": 3}


def _severity_rank(sev: str) -> int:
    return SEVERITY_ORDER.get(sev, len(SEVERITY_ORDER))


def run():
    client = GitHubClient.from_env()
    head_sha = os.environ["HEAD_SHA"]
    groq_api_key = os.environ.get("GROQ_API_KEY")

    raw_files = client.get_pr_files()
    file_diffs = [
        fd for fd in parse_pr_files(raw_files)
        if not fd.filename.startswith(("src/", ".github/workflows/"))
    ]

    if not file_diffs:
        print("No reviewable files in this diff.")
        return

    # code_chunker.chunk_repo walks the already-checked-out working directory
    # (the Action's checkout step puts it at head_sha) and returns list[CodeChunk].
    chunks = chunk_repo(root=Path("."))
    repo_index = build_repo_index(chunks)

    all_comments = []   # {filename, line, body, severity, source}
    any_critical = False

    for fd in file_diffs:
        for r in run_rules(fd):
            all_comments.append({
                "filename": fd.filename, "line": r.line_number,
                "body": f"⚠️ {r.message}", "severity": r.severity, "source": "rules",
            })
            any_critical = any_critical or r.severity == "critical"

        for finding in review_file_diff(fd, api_key=groq_api_key, repo_index=repo_index):
            all_comments.append({
                "filename": fd.filename, "line": finding.line_number,
                "body": f"🤖 {finding.message}", "severity": finding.severity,
                "source": "review",
            })

        for finding in security_review_file_diff(fd, api_key=groq_api_key, repo_index=repo_index):
            any_critical = any_critical or finding.severity == "critical"
            all_comments.append({
                "filename": fd.filename, "line": finding.line_number,
                "body": f"🔒 Security [{finding.vuln_class}]: {finding.message}",
                "severity": finding.severity, "source": "security",
            })

    # one pass over all files, not per-file — OSV gives no line number, so
    # these findings are summary-only, never posted as inline comments
    dep_comments = []
    for dep_finding in check_dependencies(file_diffs):
        any_critical = any_critical or dep_finding.severity == "critical"
        dep_comments.append({
            "filename": f"{dep_finding.package}@{dep_finding.version}",
            "line": None,
            "body": f"📦 {dep_finding.vuln_id}: {dep_finding.summary}",
            "severity": dep_finding.severity, "source": "dependency",
        })

    inline_comments = [c for c in all_comments if c["line"] is not None]
    for c in inline_comments:
        client.post_review_comment(
            body=c["body"], path=c["filename"], line=c["line"], commit_id=head_sha,
        )

    everything = sorted(all_comments + dep_comments, key=lambda c: _severity_rank(c["severity"]))
    client.post_summary_comment(_build_summary(everything, any_critical))

    if any_critical:
        print("Critical finding(s) present — failing check.")
        sys.exit(1)


def _build_summary(comments: list[dict], any_critical: bool) -> str:
    if not comments:
        return "✅ PR Review Bot: no issues found."

    lines = [f"## PR Review Summary ({len(comments)} finding(s))", ""]
    if any_critical:
        lines.append("🔴 **Critical security finding(s) — check failed.**\n")

    by_source = {"security": [], "dependency": [], "review": [], "rules": []}
    for c in comments:
        by_source.setdefault(c["source"], []).append(c)

    section_titles = {
        "security": "🔒 Security", "dependency": "📦 Dependencies",
        "review": "🤖 Code Review", "rules": "⚠️ Static Checks",
    }
    for key, title in section_titles.items():
        items = by_source.get(key, [])
        if not items:
            continue
        lines.append(f"### {title} ({len(items)})")
        for c in items:
            loc = f"`{c['filename']}`" + (f":{c['line']}" if c["line"] else "")
            lines.append(f"- {loc} — {c['body']}")
        lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    run()