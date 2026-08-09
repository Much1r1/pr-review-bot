"""Thin wrapper around the GitHub REST API for PR diff fetching and comment posting."""
import os
import requests


class GitHubClient:
    def __init__(self, token: str, repo: str, pr_number: int):
        self.token = token
        self.repo = repo
        self.pr_number = pr_number
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def get_pr_files(self) -> list[dict]:
        """Return the list of changed files in the PR, each with its patch (unified diff)."""
        url = f"{self.base_url}/repos/{self.repo}/pulls/{self.pr_number}/files"
        files = []
        page = 1
        while True:
            resp = requests.get(url, headers=self.headers, params={"per_page": 100, "page": page})
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            files.extend(batch)
            page += 1
        return files

    def post_review_comment(self, body: str, path: str, line: int, commit_id: str) -> None:
        """Post an inline comment on a specific line of a file in the PR."""
        url = f"{self.base_url}/repos/{self.repo}/pulls/{self.pr_number}/comments"
        payload = {
            "body": body,
            "commit_id": commit_id,
            "path": path,
            "line": line,
            "side": "RIGHT",
        }
        resp = requests.post(url, headers=self.headers, json=payload)
        if not resp.ok:
            # Inline comment can fail if the line isn't part of the diff context GitHub allows.
            # Don't crash the whole run over one bad comment placement.
            print(f"Warning: failed to post inline comment on {path}:{line} — {resp.status_code} {resp.text}")

    def post_summary_comment(self, body: str) -> None:
        """Post a general (non-inline) comment on the PR as a whole."""
        url = f"{self.base_url}/repos/{self.repo}/issues/{self.pr_number}/comments"
        resp = requests.post(url, headers=self.headers, json={"body": body})
        resp.raise_for_status()

    @classmethod
    def from_env(cls) -> "GitHubClient":
        return cls(
            token=os.environ["GITHUB_TOKEN"],
            repo=os.environ["REPO"],
            pr_number=int(os.environ["PR_NUMBER"]),
        )