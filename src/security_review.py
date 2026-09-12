"""Dedicated security review pass — separate from the general code review LLM call.

Uses a security-specific prompt with a concrete vulnerability checklist and a
lower bar for flagging (false negatives on security are worse than false
positives), so it's tuned differently than llm_review.py's general pass.
"""
import json
import os
import requests
from dataclasses import dataclass
from src.diff_parser import FileDiff
from src.rag_index import RepoIndex, RetrievedChunk

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "openai/gpt-oss-120b"

SECURITY_SYSTEM_PROMPT = """You are a security-focused static analysis engine performing a
dedicated security review of added lines in a pull request diff. This is a SEPARATE,
security-only pass — do not comment on style, logic bugs, or anything non-security-related.

Check specifically for these vulnerability classes:
- Injection: SQL, command/shell, NoSQL, LDAP, XPath, template injection
- Broken authentication/authorization: weak comparisons, missing auth checks, insecure session handling
- Sensitive data exposure: hardcoded secrets/credentials/keys, logging of sensitive data, weak/missing encryption
- Insecure deserialization (pickle, yaml.load without safe_load, eval/exec on untrusted input)
- Path traversal / arbitrary file access from user input
- SSRF: outbound requests built from unsanitized user input
- Insecure cryptography: weak hashing (MD5/SHA1 for passwords), predictable randomness (random instead of secrets), non-constant-time comparisons for secrets
- Missing input validation on data that flows into a sensitive sink

You may be given a "Related code from this repository" section before the diff.
That section is EXISTING code elsewhere in the repo — NOT part of this PR. Use
it only to check whether an apparent vulnerability is already mitigated
elsewhere (e.g. a session-level TLS config, an existing sanitization wrapper)
before flagging it. Do not review the related-code section directly, and
security findings must still favor flagging when uncertain — the related
context should raise your confidence bar for a finding, not silence it.

Only flag something if it is demonstrably true from the exact lines shown — do not assume
library defaults or behavior not visible in the code. Because false negatives on real
security issues are costly, flag at "warning" severity even when you're moderately (not
fully) confident something is a risk — but do not invent issues in code that is clearly safe.

For each finding, include which vulnerability class it falls under in the message.
Be concise: one to two sentences, plain language.

Respond ONLY with valid JSON, no markdown fences, no commentary:
{"findings": [{"line_number": <int>, "severity": "warning"|"critical", "vuln_class": "<string>", "message": "<string>"}]}
"""


@dataclass
class SecurityFinding:
    line_number: int
    message: str
    severity: str
    vuln_class: str


def _format_retrieved_context(retrieved: list[RetrievedChunk]) -> str:
    if not retrieved:
        return ""
    blocks = [f"# {r.chunk.header}\n{r.chunk.content}" for r in retrieved]
    return (
        "Related code from this repository (for context only — do not review this directly):\n\n"
        + "\n\n---\n\n".join(blocks)
        + "\n\n"
    )


def _build_user_prompt(file_diff: FileDiff, repo_index: RepoIndex | None = None) -> str:
    lines_block = "\n".join(
        f"{added.line_number}: {added.content}" for added in file_diff.added_lines
    )
    context_block = ""
    if repo_index is not None:
        query_text = "\n".join(added.content for added in file_diff.added_lines)
        retrieved = repo_index.retrieve(query_text, k=3, exclude_filename=file_diff.filename)
        context_block = _format_retrieved_context(retrieved)
    return f"{context_block}Filename: {file_diff.filename}\n\nAdded lines:\n{lines_block}"


def security_review_file_diff(
    file_diff: FileDiff,
    api_key: str | None = None,
    repo_index: RepoIndex | None = None,
) -> list[SecurityFinding]:
    """Run the dedicated security pass on a file's added lines. Returns [] on any
    failure or if there's nothing to review — never crashes the pipeline."""
    if not file_diff.added_lines:
        return []

    api_key = api_key or os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("Warning: GROQ_API_KEY not set, skipping security review.")
        return []

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SECURITY_SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(file_diff, repo_index)},
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        findings = []
        valid_lines = {added.line_number for added in file_diff.added_lines}
        for f in parsed.get("findings", []):
            line_no = f.get("line_number")
            severity = f.get("severity", "warning")
            message = f.get("message", "").strip()
            vuln_class = f.get("vuln_class", "unspecified").strip()
            if not message or line_no not in valid_lines:
                continue
            if severity not in ("warning", "critical"):
                severity = "warning"
            findings.append(SecurityFinding(
                line_number=line_no, message=message, severity=severity, vuln_class=vuln_class
            ))
        return findings
    except Exception as e:
        print(f"Warning: security review failed for {file_diff.filename}: {e}")
        return []