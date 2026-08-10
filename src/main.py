"""Entry point for the PR Review Bot.

Flow: fetch PR files -> parse diffs -> run rule checks + LLM review -> post
inline comments -> post a summary comment.
"""
import os
from dotenv import load_dotenv
load_dotenv()

from src.github_client import GitHubClient
from src.diff_parser import parse_pr_files
from src.rules import run_rules
from src.llm_review import review_file_diff
from src.security_review import security_review_file_diff


BOT_OWN_SOURCE_PREFIXES = ("src/", ".github/workflows/")


def _is_bot_own_source(filename: str) -> bool:
    """Skip reviewing the bot's own implementation files — reviewing its own
    source alongside target code adds noise and isn't the point of the tool."""
    return filename.startswith(BOT_OWN_SOURCE_PREFIXES)


def main():
    client = GitHubClient.from_env()
    head_sha = os.environ["HEAD_SHA"]

    print(f"Fetching changed files for PR #{client.pr_number} in {client.repo}...")
    raw_files = client.get_pr_files()
    file_diffs = parse_pr_files(raw_files)
    file_diffs = [fd for fd in file_diffs if not _is_bot_own_source(fd.filename)]
    print(f"Parsed {len(file_diffs)} file(s) with diffable changes (bot's own source excluded).")

    total_findings = 0
    total_security_findings = 0
    findings_by_severity = {"info": 0, "warning": 0, "critical": 0}

    for file_diff in file_diffs:
        # Rule-based findings (fast, deterministic)
        rule_findings = run_rules(file_diff)
        for finding in rule_findings:
            total_findings += 1
            findings_by_severity[finding.severity] += 1
            client.post_review_comment(
                body=f"**[{finding.severity.upper()}]** {finding.message}",
                path=file_diff.filename,
                line=finding.line_number,
                commit_id=head_sha,
            )

        # LLM-based findings (context-aware, catches what rules can't)
        llm_findings = review_file_diff(file_diff)
        for finding in llm_findings:
            total_findings += 1
            findings_by_severity[finding.severity] += 1
            client.post_review_comment(
                body=f"**[{finding.severity.upper()}] 🤖 AI Review**\n{finding.message}",
                path=file_diff.filename,
                line=finding.line_number,
                commit_id=head_sha,
            )

        # Dedicated security pass (separate prompt, lower bar for flagging)
        security_findings = security_review_file_diff(file_diff)
        for finding in security_findings:
            total_findings += 1
            total_security_findings += 1
            findings_by_severity[finding.severity] += 1
            client.post_review_comment(
                body=f"**[{finding.severity.upper()}] 🔒 Security Scan — {finding.vuln_class}**\n{finding.message}",
                path=file_diff.filename,
                line=finding.line_number,
                commit_id=head_sha,
            )

    summary = build_summary(len(file_diffs), total_findings, total_security_findings, findings_by_severity)
    client.post_summary_comment(summary)
    print("Review complete.")


def build_summary(files_reviewed: int, total_findings: int, total_security_findings: int, by_severity: dict) -> str:
    if total_findings == 0:
        return f"🤖 **PR Review Bot** — reviewed {files_reviewed} file(s), no issues flagged. ✅"

    lines = [
        f"🤖 **PR Review Bot** — reviewed {files_reviewed} file(s), found {total_findings} issue(s):",
        "",
        f"- 🔴 Critical: {by_severity['critical']}",
        f"- 🟡 Warning: {by_severity['warning']}",
        f"- 🔵 Info: {by_severity['info']}",
        f"- 🔒 Security-specific: {total_security_findings}",
        "",
        "_Static rules + AI review + dedicated security scan (Groq/Llama 3.3)._",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    main()