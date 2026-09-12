import subprocess

def run_backup(filename):
    subprocess.call(f"tar -czf backup.tar.gz {filename}", shell=True)

def check_password(user_input, stored_hash):
    return user_input == stored_hash