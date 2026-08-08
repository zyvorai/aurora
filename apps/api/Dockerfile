# syntax=docker/dockerfile:1
FROM python:3.12-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build
COPY pyproject.toml ./
RUN mkdir gtm_api && touch gtm_api/__init__.py \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir ".[external-mcp]"

COPY . .
RUN pip install --no-cache-dir --no-deps .


FROM python:3.12-slim-bookworm AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi8 \
    fonts-liberation \
    shared-mime-info \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -u 1000 -m appuser

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY --chown=appuser:appuser alembic ./alembic
COPY --chown=appuser:appuser alembic.ini ./
COPY --chown=appuser:appuser docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["uvicorn", "gtm_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
