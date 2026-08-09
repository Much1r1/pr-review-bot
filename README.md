# PR Review Bot

An AI-augmented code review and security scanner that runs automatically on
pull requests via GitHub Actions. Combines static analysis with LLM-generated
review feedback to catch bugs, security issues, and style problems before merge.

## Status: Week 1 — Static Analysis Pipeline

- ✅ GitHub Action triggers on PR open/sync
- ✅ Diff parser extracts added lines with correct line numbers from unified diffs
- ✅ Rule-based checks: hardcoded secrets, debug print statements, TODO/FIXME flags
- ✅ Posts inline PR comments + a summary comment
- ⬜ Week 2: LLM-powered review layer (structured, context-aware feedback)
- ⬜ Week 3: Dedicated security-pattern pass
- ⬜ Week 4: React/Convex dashboard for repo-wide trends

## Setup

\`\`\`bash
pip install -r requirements.txt
\`\`\`

Add this repo's workflow (`.github/workflows/pr-review.yml`) to any repo where
you want automated PR review. No extra secrets needed beyond the default
`GITHUB_TOKEN` for Week 1.

## Architecture

\`\`\`
src/
  github_client.py   # GitHub REST API: fetch PR diffs, post comments
  diff_parser.py      # Parses unified diff patches into structured added-line data
  rules.py             # Rule-based static checks (Week 1)
  main.py              # Entry point wiring it all together
\`\`\`