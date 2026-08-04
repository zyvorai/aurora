"""MinIO object storage for uploaded source files."""

from __future__ import annotations

import io
import uuid
from typing import Optional

from minio import Minio
from minio.error import S3Error

from gtm_api.config import get_settings

settings = get_settings()


class StorageService:
    def __init__(self) -> None:
        self._client: Optional[Minio] = None

    @property
    def client(self) -> Minio:
        if self._client is None:
            self._client = Minio(
                settings.minio_endpoint,
                access_key=settings.minio_access_key,
                secret_key=settings.minio_secret_key,
                secure=settings.minio_secure,
            )
        return self._client

    def _ensure_bucket(self) -> None:
        bucket = settings.minio_bucket
        if not self.client.bucket_exists(bucket):
            self.client.make_bucket(bucket)

    @staticmethod
    def object_key(
        tenant_id: uuid.UUID,
        product_id: uuid.UUID,
        source_id: uuid.UUID,
        filename: str,
    ) -> str:
        safe = filename.replace("/", "_").replace("\\", "_")
        return f"{tenant_id}/{product_id}/{source_id}/{safe}"

    def put_object(
        self,
        tenant_id: uuid.UUID,
        product_id: uuid.UUID,
        source_id: uuid.UUID,
        filename: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        self._ensure_bucket()
        key = self.object_key(tenant_id, product_id, source_id, filename)
        self.client.put_object(
            settings.minio_bucket,
            key,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
        return key

    def get_object(self, storage_key: str) -> bytes:
        self._ensure_bucket()
        response = self.client.get_object(settings.minio_bucket, storage_key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def delete_object(self, storage_key: str) -> None:
        self._ensure_bucket()
        try:
            self.client.remove_object(settings.minio_bucket, storage_key)
        except S3Error:
            pass

    def presigned_get(self, storage_key: str, expires_hours: int = 1) -> str:
        from datetime import timedelta

        self._ensure_bucket()
        return self.client.presigned_get_object(
            settings.minio_bucket,
            storage_key,
            expires=timedelta(hours=expires_hours),
        )


storage_service = StorageService()
