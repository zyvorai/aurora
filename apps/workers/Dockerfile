# syntax=docker/dockerfile:1
#
# Build context for this Dockerfile MUST be the repo root (not apps/workers/),
# because apps/workers/pyproject.toml declares a plain "aurora-api" dependency with
# no PyPI/path/git source -- the only way to satisfy it in a container is to
# install apps/api's package into the same venv from local source.
FROM python:3.12-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build
COPY apps/api ./api
COPY apps/workers ./workers

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --no-deps ./api \
    && pip install --no-cache-dir ./workers


FROM python:3.12-slim-bookworm AS runtime

# Defensive: gtm_workers imports gtm_api services wholesale, and any future
# worker task that touches proposal/PDF export needs these at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi8 \
    fonts-liberation \
    shared-mime-info \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -u 1000 -m appuser

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

WORKDIR /app
USER appuser

CMD ["arq", "gtm_workers.main.WorkerSettings"]
