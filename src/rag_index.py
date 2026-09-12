"""Builds an ephemeral, per-run FAISS index over the repo's code chunks and
exposes retrieval for grounding LLM review prompts in existing repo context.

Rebuilt fresh on every Action run (no persistence) — see code_chunker.py for
how chunks are extracted.
"""
from dataclasses import dataclass

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from src.code_chunker import CodeChunk

_MODEL_NAME = "all-MiniLM-L6-v2"
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(_MODEL_NAME)
    return _model


@dataclass
class RetrievedChunk:
    chunk: CodeChunk
    score: float


class RepoIndex:
    """FAISS-backed index over a repo's code chunks, built fresh per run."""

    def __init__(self, chunks: list[CodeChunk]):
        self.chunks = chunks
        model = _get_model()
        embeddings = model.encode(
            [c.content for c in chunks],
            convert_to_numpy=True,
            normalize_embeddings=True,  # so inner product == cosine similarity
        )
        self._dim = embeddings.shape[1]
        self._index = faiss.IndexFlatIP(self._dim)
        self._index.add(embeddings.astype(np.float32))

    def retrieve(self, query_text: str, k: int = 5, exclude_filename: str | None = None) -> list[RetrievedChunk]:
        """Return the top-k most similar chunks to query_text.

        exclude_filename filters out chunks from the file under review itself,
        since we want *other* repo context, not the file's own (already-visible) code.
        """
        if not self.chunks:
            return []
        model = _get_model()
        query_emb = model.encode([query_text], convert_to_numpy=True, normalize_embeddings=True)
        # Over-fetch so we still have k results after excluding same-file chunks
        fetch_k = min(k * 3 + 5, len(self.chunks))
        scores, indices = self._index.search(query_emb.astype(np.float32), fetch_k)

        results: list[RetrievedChunk] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:
                continue
            chunk = self.chunks[idx]
            if exclude_filename and chunk.filename == exclude_filename:
                continue
            results.append(RetrievedChunk(chunk=chunk, score=float(score)))
            if len(results) >= k:
                break
        return results


def build_repo_index(chunks: list[CodeChunk]) -> RepoIndex:
    return RepoIndex(chunks)