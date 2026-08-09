import sys
from dotenv import load_dotenv
load_dotenv()

from src.diff_parser import parse_file_patch
from src.llm_review import review_file_diff

patch = '''@@ -1,4 +1,7 @@
 def get_user(user_id):
-    return db.query(f"SELECT * FROM users")
+    query = f"SELECT * FROM users WHERE id = {user_id}"
+    result = db.execute(query)
+    return result
'''
fd = parse_file_patch("users.py", "modified", patch)
findings = review_file_diff(fd)
for f in findings:
    print(f.severity, f.line_number, f.message)