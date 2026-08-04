"""Database source loader — live read-only or uploaded dump."""

from __future__ import annotations

import csv
import io
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession

from gtm_api.config import get_settings
from gtm_api.models import Source, SourceCredential
from gtm_api.services.credentials import decrypt_secret
from gtm_api.services.loaders.base import page_from_text
from gtm_api.services.storage import storage_service

settings = get_settings()


class DatabaseLoader:
    async def load(self, source: Source, db: AsyncSession) -> list:
        meta = source.metadata_ or {}
        mode = meta.get("mode", "live")

        if mode == "upload" or source.storage_key:
            return self._load_upload(source)

        return await self._load_live(source, db)

    def _load_upload(self, source: Source) -> list:
        if not source.storage_key:
            raise ValueError("Database upload source missing file")

        data = storage_service.get_object(source.storage_key)
        filename = source.display_name or Path(source.storage_key).name
        ext = Path(filename).suffix.lower()
        raw = data.decode("utf-8", errors="replace")
        url = source.url or f"file://{filename}"

        if ext == ".csv":
            return [page_from_text(url, filename, raw)]

        if ext == ".sql":
            return [page_from_text(url, filename, raw[:50000])]

        return [page_from_text(url, filename, raw)]

    async def _load_live(self, source: Source, db: AsyncSession) -> list:
        if not source.credential_id:
            raise ValueError("Live database source missing credentials")

        cred = await db.get(SourceCredential, source.credential_id)
        if not cred:
            raise ValueError("Credential not found")

        secrets = decrypt_secret(cred.encrypted_token)
        meta = source.metadata_ or {}
        tables = meta.get("tables") or []
        if not tables:
            raise ValueError("No tables specified for database source")

        engine_name = secrets.get("engine", "postgresql")
        url = self._build_url(secrets)
        engine = create_engine(url, connect_args=self._connect_args(engine_name))

        pages = []
        max_rows = settings.db_source_max_rows_per_table

        with engine.connect() as conn:
            for table in tables:
                if not self._safe_identifier(table):
                    continue
                result = conn.execute(
                    text(f'SELECT * FROM "{table}" LIMIT :limit'),
                    {"limit": max_rows},
                )
                rows = result.fetchall()
                columns = list(result.keys())
                lines = [f"# Table: {table}", "", "| " + " | ".join(columns) + " |"]
                lines.append("| " + " | ".join(["---"] * len(columns)) + " |")
                for row in rows:
                    cells = [str(v) if v is not None else "" for v in row]
                    lines.append("| " + " | ".join(cells) + " |")
                pages.append(
                    page_from_text(
                        f"db://{secrets.get('database')}/{table}",
                        f"DB table {table}",
                        "\n".join(lines),
                    )
                )

        engine.dispose()
        if not pages:
            raise ValueError("No data exported from database tables")
        return pages

    def _build_url(self, secrets: dict) -> str:
        engine = secrets.get("engine", "postgresql")
        user = secrets.get("username", "")
        password = secrets.get("password", "")
        host = secrets.get("host", "localhost")
        port = secrets.get("port")
        database = secrets.get("database", "")

        if engine == "postgresql":
            port = port or 5432
            return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"
        if engine in ("mysql", "mariadb"):
            port = port or 3306
            return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
        raise ValueError(f"Unsupported database engine: {engine}")

    def _connect_args(self, engine: str) -> dict:
        if engine == "postgresql":
            return {"options": "-c default_transaction_read_only=on"}
        return {}

    def _safe_identifier(self, name: str) -> bool:
        return bool(name) and all(c.isalnum() or c in "_." for c in name)

    @staticmethod
    def test_connection(secrets: dict) -> list[str]:
        """Return list of table names (read-only introspection)."""
        loader = DatabaseLoader()
        url = loader._build_url(secrets)
        engine_name = secrets.get("engine", "postgresql")
        engine = create_engine(url, connect_args=loader._connect_args(engine_name))
        tables = []
        with engine.connect() as conn:
            if engine_name == "postgresql":
                result = conn.execute(
                    text(
                        "SELECT tablename FROM pg_tables "
                        "WHERE schemaname = 'public' ORDER BY tablename"
                    )
                )
                tables = [r[0] for r in result.fetchall()]
            elif engine_name in ("mysql", "mariadb"):
                result = conn.execute(text("SHOW TABLES"))
                tables = [r[0] for r in result.fetchall()]
        engine.dispose()
        return tables
