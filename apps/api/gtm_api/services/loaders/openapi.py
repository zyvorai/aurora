"""OpenAPI / Swagger spec loader."""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import yaml
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Source
from gtm_api.services.loaders.base import page_from_text
from gtm_api.services.storage import storage_service


class OpenAPILoader:
    async def load(self, source: Source, db: AsyncSession) -> list:
        raw = await self._fetch_spec(source)
        spec = self._parse_spec(raw)
        text = self._spec_to_text(spec)
        title = spec.get("info", {}).get("title", "OpenAPI Spec")
        url = source.url or source.display_name or "openapi"
        return [page_from_text(url, title, text)]

    async def _fetch_spec(self, source: Source) -> str:
        if source.storage_key:
            data = storage_service.get_object(source.storage_key)
            return data.decode("utf-8", errors="replace")
        if source.url and source.url.startswith("http"):
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.get(source.url)
                r.raise_for_status()
                return r.text
        if source.url:
            return source.url
        raise ValueError("OpenAPI source requires url or uploaded file")

    def _parse_spec(self, raw: str) -> dict:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return yaml.safe_load(raw)

    def _spec_to_text(self, spec: dict) -> str:
        info = spec.get("info", {})
        lines = [
            f"# {info.get('title', 'API')}",
            "",
            info.get("description", ""),
            f"Version: {info.get('version', 'unknown')}",
            "",
            "## Paths",
            "",
        ]
        paths = spec.get("paths", {})
        for path, methods in paths.items():
            lines.append(f"### {path}")
            for method, detail in methods.items():
                if method.startswith("x-"):
                    continue
                summary = detail.get("summary", "")
                desc = detail.get("description", "")
                lines.append(f"- **{method.upper()}** {summary}")
                if desc:
                    lines.append(f"  {desc}")
            lines.append("")
        return "\n".join(lines)
