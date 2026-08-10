from dotenv import load_dotenv
load_dotenv()
from src.diff_parser import parse_file_patch
from src.security_review import security_review_file_diff

patch = """@@ -1,2 +1,4 @@
 import pickle
-def load(data):
+def load(data):
+    return pickle.loads(data)
"""
fd = parse_file_patch("loader.py", "modified", patch)
for f in security_review_file_diff(fd):
    print(f.severity, f.vuln_class, f.line_number, f.message)
