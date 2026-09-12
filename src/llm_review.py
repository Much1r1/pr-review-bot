"""LLM-powered review layer using Groq (free tier, OpenAI-compatible API).

Sends the added lines of a file diff to the model with a prompt constrained to
changed lines only, and parses structured JSON findings back out — same shape
as rules.Finding so main.py can treat rule-based and LLM findings uniformly.
"""
import json
import os
import requests
from dataclasses import dataclass
from src.diff_parser import FileDiff

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "openai/gpt-oss-120b"

SYSTEM_PROMPT = """You are an expert code reviewer performing an automated pull request review.

You will be given a filename and a set of ADDED lines from a diff (only new/changed code, with their line numbers in the final file). Review ONLY these added lines for:
- Bugs and logic errors
- Security vulnerabilities (injection, unsafe deserialization, auth issues, etc.)
- Poor error handling
- Code that will likely cause issues in production

Do NOT comment on style, formatting, or missing tests unless they represent a real risk.
Do NOT invent issues — if the code looks fine, return an empty findings list.
Be concise. Each message should be one sentence, plain language, no fluff.

Respond ONLY with valid JSON in this exact shape, no markdown fences, no commentary:
{"findings": [{"line_number": <int>, "severity": "info"|"warning"|"critical", "message": "<string>"}]}
"""


@dataclass
class LLMFinding:
    line_number: int
    message: str
    severity: str


def _build_user_prompt(file_diff: FileDiff) -> str:
    lines_block = "\n".join(
        f"{added.line_number}: {added.content}" for added in file_diff.added_lines
    )
    return f"Filename: {file_diff.filename}\n\nAdded lines:\n{lines_block}"


def review_file_diff(file_diff: FileDiff, api_key: str | None = None) -> list[LLMFinding]:
    """Send a file's added lines to Groq for LLM review. Returns [] on any failure
    or if there's nothing to review — this layer should never crash the pipeline."""
    if not file_diff.added_lines:
        return []

    api_key = api_key or os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("Warning: GROQ_API_KEY not set, skipping LLM review.")
        return []

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(file_diff)},
        ],
        "temperature": 0.2,
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
            severity = f.get("severity", "info")
            message = f.get("message", "").strip()
            if not message or line_no not in valid_lines:
                continue  # guard against hallucinated line numbers outside the diff
            if severity not in ("info", "warning", "critical"):
                severity = "info"
            findings.append(LLMFinding(line_number=line_no, message=message, severity=severity))
        return findings
    except Exception as e:
        print(f"Warning: LLM review failed for {file_diff.filename}: {e}")
        return []