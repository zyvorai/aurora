"""GitHub repository content loader."""

from __future__ import annotations

import base64
import re
from urllib.parse import urlparse

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.models import Source, SourceCredential
from gtm_api.services.credentials import decrypt_secret
from gtm_api.services.loaders.base import page_from_text


def parse_github_repo(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    parts = [p for p in parsed.path.strip("/").split("/") if p]
    if len(parts) < 2:
        raise ValueError("GitHub URL must be like https://github.com/owner/repo")
    return parts[0], parts[1]


class GitHubLoader:
    async def load(self, source: Source, db: AsyncSession) -> list:
        owner, repo = parse_github_repo(source.url or "")
        token = await self._get_token(source, db)
        headers = {"Accept": "application/vnd.github+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        async with httpx.AsyncClient(timeout=30) as client:
            readme = await self._fetch_readme(client, owner, repo, headers)
            tree_files = await self._list_docs_files(client, owner, repo, headers)

            pages = []
            if readme:
                pages.append(page_from_text(source.url or "", f"{owner}/{repo} README", readme))

            for path in tree_files[:20]:
                content = await self._fetch_file(client, owner, repo, path, headers)
                if content and len(content.strip()) > 50:
                    pages.append(
                        page_from_text(
                            f"https://github.com/{owner}/{repo}/blob/main/{path}",
                            path,
                            content,
                        )
                    )

        if not pages:
            raise ValueError(f"No ingestible content found in {owner}/{repo}")
        return pages

    async def _get_token(self, source: Source, db: AsyncSession) -> str | None:
        if not source.credential_id:
            return None
        cred = await db.get(SourceCredential, source.credential_id)
        if not cred:
            return None
        data = decrypt_secret(cred.encrypted_token)
        return data.get("token") or data.get("password")

    async def _fetch_readme(
        self, client: httpx.AsyncClient, owner: str, repo: str, headers: dict
    ) -> str:
        for name in ("README.md", "readme.md", "README"):
            r = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/contents/{name}",
                headers=headers,
            )
            if r.status_code == 200:
                data = r.json()
                if data.get("encoding") == "base64":
                    return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
        return ""

    async def _list_docs_files(
        self, client: httpx.AsyncClient, owner: str, repo: str, headers: dict
    ) -> list[str]:
        r = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/git/trees/main?recursive=1",
            headers=headers,
        )
        if r.status_code != 200:
            r = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/git/trees/master?recursive=1",
                headers=headers,
            )
        if r.status_code != 200:
            return []

        paths = []
        for item in r.json().get("tree", []):
            path = item.get("path", "")
            if item.get("type") != "blob":
                continue
            if not re.search(r"\.(md|txt|rst)$", path, re.I):
                continue
            if path.startswith("docs/") or path.startswith("doc/") or "/" not in path:
                paths.append(path)
        return paths

    async def _fetch_file(
        self, client: httpx.AsyncClient, owner: str, repo: str, path: str, headers: dict
    ) -> str:
        r = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/contents/{path}",
            headers=headers,
        )
        if r.status_code != 200:
            return ""
        data = r.json()
        if data.get("encoding") == "base64":
            return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
        return ""
