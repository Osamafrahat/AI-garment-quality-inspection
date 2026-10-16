# Convenience targets. Every target mirrors a command documented in README.md,
# so you can use either. On Windows without `make`, just run the commands.
.DEFAULT_GOAL := help

PYTHON ?= python
BACKEND_DIR := backend
FRONTEND_DIR := frontend
DATA_DIR := data

.PHONY: help install-backend install-frontend install-ml install dev-backend \
        dev-frontend dev test synth train docker-build docker-up docker-down \
        clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------- bootstrap
install-backend: ## Create the venv and install Python dependencies
	cd $(BACKEND_DIR) && $(PYTHON) -m venv .venv
	$(BACKEND_DIR)/.venv/Scripts/python -m pip install --upgrade pip
	$(BACKEND_DIR)/.venv/Scripts/python -m pip install -r $(BACKEND_DIR)/requirements.txt

install-frontend: ## Install npm dependencies
	cd $(FRONTEND_DIR) && npm install

install: install-backend install-frontend ## Install everything

install-ml: ## Add torch/torchvision (CPU wheels) for training and real inference
	$(BACKEND_DIR)/.venv/Scripts/python -m pip install -r $(BACKEND_DIR)/requirements-ml.txt --index-url https://download.pytorch.org/whl/cpu

# ------------------------------------------------------------------- run
dev-backend: ## Start the FastAPI server with autoreload
	cd $(BACKEND_DIR) && .venv/Scripts/python -m uvicorn app.main:app --reload

dev-frontend: ## Start the Vite dev server
	cd $(FRONTEND_DIR) && npm run dev

# ------------------------------------------------------------------ test
test: ## Run the backend test suite
	cd $(BACKEND_DIR) && .venv/Scripts/python -m pytest

# ----------------------------------------------------------------- train
synth: ## Generate a synthetic dataset (proves the pipeline works)
	cd $(BACKEND_DIR) && .venv/Scripts/python -m app.training.synth --out ../$(DATA_DIR)

train: ## Train a checkpoint from the dataset in data/
	cd $(BACKEND_DIR) && .venv/Scripts/python -m app.training.train --data ../$(DATA_DIR)

# ------------------------------------------------------------------ docker
docker-build: ## Build the backend image (run from the repo root)
	docker build -t garment-api .

docker-up: ## Build and run the API container on :8000
	docker compose up --build -d

docker-down: ## Stop the container
	docker compose down

# --------------------------------------------------------------- tidy
clean: ## Remove build artifacts and caches (leaves data/ and models/ alone)
	rm -rf $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/node_modules/.vite
	rm -rf $(BACKEND_DIR)/.pytest_cache $(BACKEND_DIR)/app/__pycache__
	find $(BACKEND_DIR) -name "__pycache__" -type d -prune -exec rm -rf {} +
