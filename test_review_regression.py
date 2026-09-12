"""Throwaway regression test: confirms llm_review.py and security_review.py
still behave correctly with no repo_index passed (old code path).

Run from repo root:
    python test_review_regression.py

Requires GROQ_API_KEY to be set in your environment for the live-call checks.
If you just want to check prompt building (no API cost), see the
PROMPT-ONLY section at the bottom — comment out the live calls if you like.
"""
from pathlib import Path

from src.diff_parser import parse_file_patch
from src.code_chunker import chunk_repo
from src.rag_index import build_repo_index
from src.llm_review import _build_user_prompt as build_llm_prompt, review_file_diff
from src.security_review import _build_user_prompt as build_sec_prompt, security_review_file_diff

# --- Build a minimal fake diff -------------------------------------------------
# GitHub-style unified diff patch body (no --- / +++ headers, just hunks —
# matches what the GitHub Files API returns and what parse_file_patch expects).
SAMPLE_PATCH = """@@ -1,2 +1,4 @@
 def foo():
-    pass
+    password = "hunter2"
+    eval(user_input)
+    return password
"""

def main():
    file_diff = parse_file_patch(
        filename="example.py",
        status="modified",
        patch=SAMPLE_PATCH,
    )

    print("=== Prompt WITHOUT repo_index (llm_review) ===")
    print(build_llm_prompt(file_diff))
    print()

    print("=== Prompt WITHOUT repo_index (security_review) ===")
    print(build_sec_prompt(file_diff))
    print()

    # Sanity: no "Related code from this repository" block should appear
    llm_prompt = build_llm_prompt(file_diff)
    sec_prompt = build_sec_prompt(file_diff)
    assert "Related code from this repository" not in llm_prompt, "llm_review leaked a context block with no repo_index!"
    assert "Related code from this repository" not in sec_prompt, "security_review leaked a context block with no repo_index!"
    print("PASS: no context block injected when repo_index is omitted.\n")

    # Live calls (costs a Groq request each) — comment out if you just want the prompt check above
    print("=== Live call: review_file_diff (no repo_index) ===")
    findings = review_file_diff(file_diff)
    print(findings)
    print()

    print("=== Live call: security_review_file_diff (no repo_index) ===")
    sec_findings = security_review_file_diff(file_diff)
    print(sec_findings)

    # --- Step 3: test WITH a real repo_index --------------------------------
    print("\n\n########## STEP 3: WITH repo_index ##########\n")

    repo_root = Path(".")
    chunks = chunk_repo(repo_root, extensions={".py"})
    print(f"Chunked {len(chunks)} code units from the repo.\n")

    repo_index = build_repo_index(chunks)

    # Pretend we're reviewing a diff to llm_review.py itself, so we can check
    # that security_review.py's real, closely-related code gets retrieved as
    # context, while llm_review.py's own chunks are excluded via exclude_filename.
    target_diff = parse_file_patch(
        filename="src/llm_review.py",
        status="modified",
        patch=SAMPLE_PATCH,
    )

    llm_prompt_with_ctx = build_llm_prompt(target_diff, repo_index)
    sec_prompt_with_ctx = build_sec_prompt(target_diff, repo_index)

    print("=== Prompt WITH repo_index (llm_review) ===")
    print(llm_prompt_with_ctx)
    print()

    # Sanity checks
    assert "Related code from this repository" in llm_prompt_with_ctx, \
        "Expected a context block when repo_index is provided and chunks exist!"
    assert "src/llm_review.py" not in llm_prompt_with_ctx.split("Filename:")[0], \
        "Self-retrieval leak: llm_review.py's own chunks appeared in its context block!"
    print("PASS: context block present, no self-retrieval from llm_review.py.\n")

    print("=== Prompt WITH repo_index (security_review) ===")
    print(sec_prompt_with_ctx)


if __name__ == "__main__":
    main()