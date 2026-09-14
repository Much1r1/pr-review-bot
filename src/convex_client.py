import os
import requests
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

SOURCE_TO_CATEGORY = {
    "security": "security",
    "dependency": "dependency",
    "review": "code_review",
    "rules": "code_review",
}


def _map_category(source: str) -> str:
    return SOURCE_TO_CATEGORY.get(source, "code_review")


def persist_run(
    repo: str,
    pr_number: int,
    head_sha: str,
    all_comments: List[Dict[str, Any]],
    any_critical: bool,
    convex_url: Optional[str] = None,
    deploy_key: Optional[str] = None,
) -> Optional[str]:
    """
    Persists a PR review run and its findings to Convex using the Convex HTTP API.
    If convex_url or deploy_key are missing, it logs a warning and gracefully returns None.
    """
    url = convex_url or os.environ.get("CONVEX_URL")
    auth_token = deploy_key or os.environ.get("CONVEX_DEPLOY_KEY") or os.environ.get("CONVEX_AUTH_TOKEN")

    if not url:
        logger.warning("CONVEX_URL environment variable is not set. Skipping persistence to Convex.")
        return None

    # Clean up base URL
    base_url = url.rstrip("/")
    endpoint = f"{base_url}/api/mutation"

    findings = []
    for c in all_comments:
        findings.append({
            "category": _map_category(c.get("source", "")),
            "severity": c.get("severity", "info"),
            "file": c.get("filename", "unknown"),
            "line": c.get("line"),
            "message": c.get("body", ""),
            "code_snippet": c.get("code_snippet"),
        })

    payload = {
        "path": "runs:saveRunAndFindings",
        "args": {
            "repo": repo,
            "pr_number": pr_number,
            "head_sha": head_sha,
            "total_findings": len(findings),
            "any_critical": any_critical,
            "findings": findings,
        },
    }

    headers = {
        "Content-Type": "application/json",
    }
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"

    try:
        response = requests.post(endpoint, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        if data.get("status") == "success":
            logger.info(f"Successfully persisted run to Convex: {data.get('value')}")
            return data.get("value")
        else:
            logger.error(f"Convex mutation returned error status: {data.get('errorMessage')}")
            return None
    except Exception as e:
        logger.error(f"Failed to post run to Convex: {e}")
        return None
