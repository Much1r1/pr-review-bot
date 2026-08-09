"""Entry point for the PR Review Bot (Week 1: static rules only, no LLM yet).

Flow: fetch PR files -> parse diffs -> run rule checks -> post inline comments
-> post a summary comment.
"""
from src.github_client import GitHubClient
from src.diff_parser import parse_pr_files
from src.rules import run_rules


def main():
    client = GitHubClient.from_env()

    print(f"Fetching changed files for PR #{client.pr_number} in {client.repo}...")
    raw_files = client.get_pr_files()
    file_diffs = parse_pr_files(raw_files)
    print(f"Parsed {len(file_diffs)} file(s) with diffable changes.")

    import os
    head_sha = os.environ["HEAD_SHA"]

    total_findings = 0
    findings_by_severity = {"info": 0, "warning": 0, "critical": 0}

    for file_diff in file_diffs:
        findings = run_rules(file_diff)
        for finding in findings:
            total_findings += 1
            findings_by_severity[finding.severity] += 1
            comment_body = f"**[{finding.severity.upper()}]** {finding.message}"
            client.post_review_comment(
                body=comment_body,
                path=file_diff.filename,
                line=finding.line_number,
                commit_id=head_sha,
            )

    summary = build_summary(len(file_diffs), total_findings, findings_by_severity)
    client.post_summary_comment(summary)
    print("Review complete.")


def build_summary(files_reviewed: int, total_findings: int, by_severity: dict) -> str:
    if total_findings == 0:
        return "🤖 **PR Review Bot** — reviewed {} file(s), no issues flagged. ✅".format(files_reviewed)

    lines = [
        f"🤖 **PR Review Bot** — reviewed {files_reviewed} file(s), found {total_findings} issue(s):",
        "",
        f"- 🔴 Critical: {by_severity['critical']}",
        f"- 🟡 Warning: {by_severity['warning']}",
        f"- 🔵 Info: {by_severity['info']}",
        "",
        "_This is currently rule-based static analysis. LLM-powered review lands in Week 2._",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    main()