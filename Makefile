.PHONY: infra-up infra-down api web workers crm test init-db ollama-pull ollama-pull-lean install-api install-web install setup venv env check-infra stop stop-apps clean start

VENV := apps/api/.venv
VENV_PY := $(VENV)/bin/python
VENV_UVICORN := $(VENV)/bin/uvicorn

venv:
	@test -d $(VENV) || (echo "Run 'make install-api' first to create the Python 3.12 venv." && exit 1)

env:
	@test -f .env || cp .env.example .env
	@grep '^NEXT_PUBLIC_' .env > apps/web/.env.local 2>/dev/null || echo 'NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1' > apps/web/.env.local
	@echo "Created .env from .env.example (edit if needed)."
	@echo "Synced NEXT_PUBLIC_* to apps/web/.env.local for Next.js."

check-infra:
	@echo "Checking Docker..."
	@docker info >/dev/null 2>&1 || (echo "ERROR: Docker is not running. Start Docker Desktop first." && exit 1)
	@echo "Checking Postgres on localhost:5432..."
	@docker compose -f infra/docker-compose.yml ps postgres --format '{{.State}}' 2>/dev/null | grep -q running \
		|| (echo "ERROR: Postgres container is not running. Run: make infra-up" && exit 1)
	@echo "Infrastructure OK."

infra-up: env
	docker compose -f infra/docker-compose.yml up -d
	@echo "Waiting for Postgres..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		docker compose -f infra/docker-compose.yml exec -T postgres pg_isready -U gtm -d gtm_platform >/dev/null 2>&1 && break; \
		sleep 2; \
	done
	@echo "Infrastructure is up. Run 'make init-db' if this is a fresh setup."

infra-down:
	docker compose -f infra/docker-compose.yml down

stop:
	bash infra/scripts/stop.sh

stop-apps:
	bash infra/scripts/stop.sh --processes

start:
	bash infra/scripts/start.sh

clean:
	bash infra/scripts/stop.sh --clean

ollama-pull:
	bash infra/scripts/pull-models.sh

ollama-pull-lean:
	bash infra/scripts/pull-models-lean.sh

init-db: venv check-infra
	cd apps/api && .venv/bin/python scripts/init_db.py

api: venv
	cd apps/api && .venv/bin/uvicorn gtm_api.main:app --reload --port 8000

api-stable: venv
	cd apps/api && .venv/bin/uvicorn gtm_api.main:app --host 127.0.0.1 --port 8000

web:
	cd apps/web && npm run dev

workers: venv
	cd apps/workers && ../api/.venv/bin/python -m gtm_workers.main

crm:
	cd apps/sales-crm && go run .

test: venv
	cd apps/api && .venv/bin/python -m pytest tests/ -v

install-api:
	@test -d apps/api/.venv || (cd apps/api && python3.12 -m venv .venv)
	cd apps/api && .venv/bin/pip install -e ".[dev]"

install-web:
	cd apps/web && npm install

install: install-api install-web

setup: env infra-up install init-db
	@echo "Platform ready. Run 'make api' and 'make web' in separate terminals."
