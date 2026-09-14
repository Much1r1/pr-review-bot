"""Throwaway test file — intentionally contains vulnerability patterns to verify
the dedicated security pass (security_review.py) actually fires. Not real code,
delete after verifying the PR summary shows 🔒 Security findings, and revert
requirements.txt afterward too.
"""
import os
import sqlite3
import subprocess

# --- hardcoded secret: should trip both rules.py (Week 1) and security_review.py ---
STRIPE_API_KEY = "sk_live_51H8x9kL3mN2pQeRtWyUvAbCdEfGhIjKlMnOpQrSt"


def get_user(username: str):
    """SQL injection — string-formatted query built directly from user input."""
    conn = sqlite3.connect("app.db")
    cursor = conn.cursor()
    query = f"SELECT * FROM users WHERE username = '{username}'"
    cursor.execute(query)
    return cursor.fetchone()


def run_diagnostic(user_command: str):
    """Command injection — user input passed to shell=True."""
    result = subprocess.run(user_command, shell=True, capture_output=True)
    return result.stdout


def load_config(user_supplied_expr: str):
    """eval() on untrusted input."""
    return eval(user_supplied_expr)


def check_password(candidate: str, real_password: str) -> bool:
    """Non-constant-time comparison of a secret."""
    return candidate == real_password