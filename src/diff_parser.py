"""Parses unified diff patches (as returned by GitHub's Files API) into structured
added-line data, so downstream checks only look at what actually changed."""
from dataclasses import dataclass, field


@dataclass
class AddedLine:
    line_number: int  # line number in the NEW version of the file
    content: str


@dataclass
class FileDiff:
    filename: str
    status: str  # added, modified, removed, renamed
    added_lines: list[AddedLine] = field(default_factory=list)
    raw_patch: str = ""


def parse_file_patch(filename: str, status: str, patch: str | None) -> FileDiff:
    """Parse a single file's unified diff patch into a FileDiff with added lines only.

    GitHub's patch format uses hunk headers like: @@ -a,b +c,d @@
    We track the new-file line counter and record every '+' line (excluding the
    '+++' file header line).
    """
    file_diff = FileDiff(filename=filename, status=status, raw_patch=patch or "")
    if not patch:
        return file_diff

    new_line_no = 0
    for line in patch.split("\n"):
        if line.startswith("@@"):
            # Hunk header: @@ -old_start,old_count +new_start,new_count @@
            try:
                plus_part = line.split("+", 1)[1].split(" ")[0]
                new_start = int(plus_part.split(",")[0])
                new_line_no = new_start
            except (IndexError, ValueError):
                continue
        elif line.startswith("+") and not line.startswith("+++"):
            file_diff.added_lines.append(AddedLine(line_number=new_line_no, content=line[1:]))
            new_line_no += 1
        elif line.startswith("-") and not line.startswith("---"):
            continue  # removed line, doesn't consume a new-file line number
        else:
            new_line_no += 1

    return file_diff


def parse_pr_files(files: list[dict]) -> list[FileDiff]:
    return [
        parse_file_patch(f["filename"], f["status"], f.get("patch"))
        for f in files
        if f.get("patch")  # binary files / huge diffs have no patch
    ]