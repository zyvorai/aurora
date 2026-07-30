"""Text chunking utilities."""

import hashlib
import re
from dataclasses import dataclass


@dataclass
class TextChunk:
    content: str
    chunk_index: int
    content_hash: str
    token_count: int


def estimate_tokens(text: str) -> int:
    return len(re.findall(r"\w+", text))


def chunk_text(
    text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> list[TextChunk]:
    if not text.strip():
        return []

    words = text.split()
    chunks: list[TextChunk] = []
    start = 0
    index = 0

    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        content = " ".join(chunk_words)

        chunks.append(
            TextChunk(
                content=content,
                chunk_index=index,
                content_hash=hashlib.sha256(content.encode()).hexdigest(),
                token_count=estimate_tokens(content),
            )
        )
        index += 1
        start += chunk_size - chunk_overlap
        if start >= len(words):
            break

    return chunks
