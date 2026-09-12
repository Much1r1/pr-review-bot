"""Parses source files into function/class-level chunks for RAG indexing.

Uses tree-sitter to extract logical code units (functions, methods, classes)
per file, with multi-language support. Files in unsupported languages fall
back to whole-file chunking so nothing is silently skipped.
"""
from dataclasses import dataclass
from pathlib import Path

from tree_sitter import Language, Parser
import tree_sitter_python
import tree_sitter_typescript
import tree_sitter_javascript

_LANGUAGE_OBJECTS = {
    "python": Language(tree_sitter_python.language()),
    "typescript": Language(tree_sitter_typescript.language_typescript()),
    "tsx": Language(tree_sitter_typescript.language_tsx()),
    "javascript": Language(tree_sitter_javascript.language()),
}

_PARSER_CACHE: dict[str, Parser] = {}


def get_parser(language: str) -> Parser:
    if language not in _PARSER_CACHE:
        parser = Parser(_LANGUAGE_OBJECTS[language])
        _PARSER_CACHE[language] = parser
    return _PARSER_CACHE[language]

# Map file extensions to tree-sitter language names
LANGUAGE_BY_EXTENSION = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "javascript",
}

# Node types that count as a "chunkable unit" per language
CHUNK_NODE_TYPES = {
    "python": {"function_definition", "class_definition"},
    "typescript": {"function_declaration", "class_declaration", "method_definition"},
    "tsx": {"function_declaration", "class_declaration", "method_definition"},
    "javascript": {"function_declaration", "class_declaration", "method_definition"},
}


@dataclass
class CodeChunk:
    filename: str
    header: str       # e.g. "pr-review-bot/src/llm_review.py > class Foo > def bar(x, y):"
    content: str       # the actual source text of the chunk
    start_line: int
    end_line: int


def _language_for(filename: str) -> str | None:
    ext = Path(filename).suffix
    return LANGUAGE_BY_EXTENSION.get(ext)


def _make_header(filename: str, node, source: bytes, enclosing_class: str | None) -> str:
    first_line = source[node.start_byte:node.end_byte].split(b"\n", 1)[0].decode("utf-8", errors="replace")
    if enclosing_class:
        return f"{filename} > class {enclosing_class} > {first_line.strip()}"
    return f"{filename} > {first_line.strip()}"


def chunk_file(filename: str, source_text: str) -> list[CodeChunk]:
    """Chunk a single file's source into function/class-level CodeChunks.

    Falls back to a single whole-file chunk if the language isn't supported.
    """
    language = _language_for(filename)
    if language is None:
        return [CodeChunk(
            filename=filename,
            header=f"{filename} (unsupported language, whole file)",
            content=source_text,
            start_line=1,
            end_line=source_text.count("\n") + 1,
        )]

    parser = get_parser(language)
    source_bytes = source_text.encode("utf-8")
    tree = parser.parse(source_bytes)
    chunk_types = CHUNK_NODE_TYPES[language]

    chunks: list[CodeChunk] = []

    def walk(node, enclosing_class: str | None):
        # Track class context so methods get "class Foo > def bar" headers
        current_class = enclosing_class
        if node.type in ("class_definition", "class_declaration"):
            name_node = next((c for c in node.children if c.type == "identifier"), None)
            current_class = name_node.text.decode("utf-8") if name_node else enclosing_class

        if node.type in chunk_types:
            content = source_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="replace")
            header = _make_header(filename, node, source_bytes, enclosing_class)
            chunks.append(CodeChunk(
                filename=filename,
                header=header,
                content=f"{header}\n{content}",
                start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1,
            ))
            # Still recurse into methods inside a class
            for child in node.children:
                walk(child, current_class)
        else:
            for child in node.children:
                walk(child, current_class)

    walk(tree.root_node, None)

    # If nothing chunkable was found (e.g. a config-like file in a supported
    # extension with no functions/classes), fall back to whole-file.
    if not chunks:
        return [CodeChunk(
            filename=filename,
            header=f"{filename} (no chunkable units found)",
            content=source_text,
            start_line=1,
            end_line=source_text.count("\n") + 1,
        )]

    return chunks


def chunk_repo(root: Path, extensions: set[str] | None = None) -> list[CodeChunk]:
    """Walk a repo directory and chunk every file with a supported/relevant extension."""
    extensions = extensions or set(LANGUAGE_BY_EXTENSION.keys())
    all_chunks: list[CodeChunk] = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix not in extensions:
            continue
        if ".git" in path.parts or "node_modules" in path.parts:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        rel_name = str(path.relative_to(root))
        all_chunks.extend(chunk_file(rel_name, text))
    return all_chunks