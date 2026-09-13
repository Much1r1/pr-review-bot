# PR Review Bot

An AI-augmented code review and security scanner that runs automatically on
pull requests via GitHub Actions. Combines static analysis with LLM-generated,
RAG-informed review feedback to catch bugs, security issues, and style
problems before merge.

## Status

- ✅ Week 1 — Static analysis pipeline: diff parsing, rule-based checks
  (hardcoded secrets, debug prints, TODO/FIXME), inline + summary PR comments
- ✅ Week 2 — LLM review layer: Groq (Llama 3.3 70B, free tier) generates
  structured, context-aware feedback; verified catching real issues (e.g. a
  timing-attack password comparison) that rule-based checks miss
- ✅ RAG integration — retrieves related code from elsewhere in the repo so
  the LLM reviews each file with actual project context, not just the diff
  in isolation
- ⬜ Week 3 — Dedicated security-pattern pass
- ⬜ Week 4 — React/Convex dashboard for repo-wide trends
- ⬜ Reusable GitHub Action — currently runs only within this repo; packaging
  as a portable Action (`action.yml`, referenced via `uses:` from other repos)
  is planned next

## How it works

On every PR open/sync, the Action:

1. Fetches the PR diff and parses it into structured added-line data
2. Runs fast rule-based checks (secrets, debug leftovers, TODO/FIXME)
3. Builds an ephemeral RAG index of the repo at the PR's head commit —
   function/class-level chunks (tree-sitter, AST-aware, multi-language),
   embedded locally (sentence-transformers) into an in-memory FAISS index,
   discarded after the run
4. For each changed file, retrieves related chunks from the rest of the repo
   and sends them alongside the diff to the LLM for review
5. Posts inline PR comments plus a summary comment; sets the check status

## Setup

```bash
pip install -r requirements.txt
```

Add this repo's workflow (`.github/workflows/pr-review.yml`) to a repo where
you want automated PR review. Requires:

- `GITHUB_TOKEN` — provided by default in GitHub Actions
- `GROQ_API_KEY` — repo secret, used for the LLM review layer

> Note: the workflow and bot source currently only work when copied into
> the target repo directly (no hosted service, no reusable Action yet).

## Architecture

```
src/
  github_client.py    # GitHub REST API: fetch PR diffs, post comments
  diff_parser.py       # Parses unified diff patches into structured added-line data
  rules.py              # Rule-based static checks (secrets, debug prints, TODO/FIXME)
  repo_index.py         # Builds the ephemeral RAG index (chunking, embedding, FAISS)
  llm_review.py         # RAG-augmented LLM review calls (Groq), prompt construction
  main.py                # Entry point wiring it all together
```

## Design notes

- **RAG scope**: ephemeral, per-run indexing only — no persisted vector store.
  The repo is small enough that re-indexing per run is simpler than
  maintaining a synced index.
- **Retrieval granularity**: per-file, not per-line — each changed file's
  diff is used as the query, retrieving related chunks from the rest of the
  repo.
- **Chunking**: function/class-level via tree-sitter, not file-level or
  fixed-size, with a lightweight header (filename, class, signature)
  prepended to each chunk.
- **Models**: Groq (Llama 3.3 70B) for review generation, a local
  sentence-transformers model for embeddings — both free-tier, no paid API
  dependency.