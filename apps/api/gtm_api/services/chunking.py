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


def truncate_to_token_budget(text: str, max_tokens: int) -> str:
    """Trim text to roughly max_tokens words (fast heuristic for LLM context limits)."""
    if max_tokens <= 0:
        return ""
    words = text.split()
    if len(words) <= max_tokens:
        return text
    trimmed = " ".join(words[:max_tokens])
    return trimmed + "\n...[truncated]"


def compact_profile(profile: dict, max_field_tokens: int = 200) -> dict:
    """Keep strategy-relevant profile fields and cap long lists/strings."""
    if not profile:
        return {}
    keys = (
        "summary",
        "features",
        "industry",
        "target_personas",
        "value_propositions",
        "pain_points",
        "use_cases",
        "competitors",
        "pricing",
        "technical_stack",
    )
    compact: dict = {}
    for key in keys:
        value = profile.get(key)
        if value in (None, "", [], {}):
            continue
        if isinstance(value, str):
            compact[key] = truncate_to_token_budget(value, max_field_tokens)
        elif isinstance(value, list):
            compact[key] = value[:8]
        else:
            compact[key] = value
    return compact


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
