"""Shared types for the enrichment waterfall."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class EnrichmentResult:
    company_name: str
    domain: str | None = None
    industry: str | None = None
    company_size: str | None = None
    geo: str | None = None
    personas: list[dict[str, Any]] = field(default_factory=list)
    emails: list[str] = field(default_factory=list)
    phones: list[str] = field(default_factory=list)
    provider: str = "none"
    confidence: float = 0.0
    raw: dict[str, Any] = field(default_factory=dict)

    def apply_to(self, item: dict[str, Any]) -> dict[str, Any]:
        """Merge enrichment into a discovery candidate dict."""
        out = dict(item)
        if self.domain and not out.get("domain"):
            out["domain"] = self.domain
        if self.industry and not out.get("industry"):
            out["industry"] = self.industry
        if self.company_size and not out.get("company_size"):
            out["company_size"] = self.company_size
        if self.geo and not out.get("geo"):
            out["geo"] = self.geo
        if self.personas and not out.get("personas"):
            out["personas"] = self.personas
        meta = dict(out.get("enrichment") or {})
        meta.update({
            "provider": self.provider,
            "confidence": self.confidence,
            "emails": self.emails,
            "phones": self.phones,
        })
        out["enrichment"] = meta
        if self.provider != "none":
            out["source"] = f"enriched:{self.provider}"
        return out
