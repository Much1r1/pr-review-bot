"""LLM-powered review layer using Groq (free tier, OpenAI-compatible API).

Sends the added lines of a file diff to the model with a prompt constrained to
changed lines only, and parses structured JSON findings back out — same shape
as rules.Finding so main.py can treat rule-based and LLM findings uniformly.
"""
import json
import os
import time
import requests
from dataclasses import dataclass
from src.diff_parser import FileDiff
from src.rag_index import RepoIndex, RetrievedChunk

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "openai/gpt-oss-120b"
MAX_RETRIES = 3
BASE_BACKOFF_SECONDS = 5

SYSTEM_PROMPT = """You are an expert code reviewer performing an automated pull request review.

You will be given a filename and a set of ADDED lines from a diff (only new/changed code, with their line numbers in the final file). Review ONLY these added lines for:
- Bugs and logic errors
- Security vulnerabilities (injection, unsafe deserialization, auth issues, etc.)
- Poor error handling
- Code that will likely cause issues in production

You may be given a "Related code from this repository" section before the diff.
That section is EXISTING code elsewhere in the repo, retrieved because it's
semantically related to the file under review — it is NOT part of this PR and
you must not flag issues within it directly. Use it only to:
- check whether the diff is consistent with existing patterns/conventions in the repo
- avoid false positives (e.g. don't assume something is unsafe if related code
  elsewhere shows it's already validated/wrapped/configured correctly)
- notice if the diff duplicates logic that already exists elsewhere

If no related code section is present, or it isn't relevant to a specific
finding, review the diff on its own merits as before.

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


def _post_with_retry(payload: dict, headers: dict) -> requests.Response | None:
    """POST to Groq with retry/backoff on 429 (rate limit). Honors Retry-After
    when Groq sends one; otherwise falls back to exponential backoff.
    Returns None if all retries are exhausted."""
    for attempt in range(MAX_RETRIES):
        resp = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=30)
        if resp.status_code != 429:
            return resp
        retry_after = resp.headers.get("Retry-After")
        wait = float(retry_after) if retry_after else BASE_BACKOFF_SECONDS * (2 ** attempt)
        print(f"Rate limited by Groq (attempt {attempt + 1}/{MAX_RETRIES}), waiting {wait}s...")
        time.sleep(wait)
    return None


def review_file_diff(
    file_diff: FileDiff,
    api_key: str | None = None,
    repo_index: RepoIndex | None = None,
) -> list[LLMFinding]:
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
            {"role": "user", "content": _build_user_prompt(file_diff, repo_index)},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = _post_with_retry(payload, headers)
        if resp is None:
            print(f"Warning: LLM review rate-limited out for {file_diff.filename} after {MAX_RETRIES} retries.")
            return []
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