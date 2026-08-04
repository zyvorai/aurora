"""MCP context types — multi-source inputs for grounded LLM decisions."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ContextBlock:
    """One labeled context slice fed to the LLM."""

    source: str
    provider: str
    title: str
    content: str
    metadata: dict = field(default_factory=dict)


@dataclass
class DecisionContext:
    """Aggregated context from multiple MCP/internal providers."""

    query: str
    blocks: list[ContextBlock] = field(default_factory=list)
    search_results: list = field(default_factory=list)  # vector SearchResult for grounding

    @property
    def sources_used(self) -> list[str]:
        return [b.provider for b in self.blocks]

    def to_prompt_section(self, max_chars: int = 12000) -> str:
        parts: list[str] = []
        used = 0
        for block in self.blocks:
            header = f"## {block.title} (source: {block.provider})"
            body = block.content.strip()
            chunk = f"{header}\n{body}\n"
            if used + len(chunk) > max_chars:
                remaining = max_chars - used
                if remaining > 200:
                    parts.append(chunk[:remaining] + "\n...[truncated]")
                break
            parts.append(chunk)
            used += len(chunk)
        return "\n".join(parts)

    def to_dict(self) -> dict:
        return {
            "query": self.query,
            "sources_used": self.sources_used,
            "blocks": [
                {
                    "source": b.source,
                    "provider": b.provider,
                    "title": b.title,
                    "metadata": b.metadata,
                    "content_preview": b.content[:500],
                }
                for b in self.blocks
            ],
        }
