# Developer helpers. Deployments are GitOps-only: CI builds/pushes images and Argo CD deploys from Git.
# Build & push all ShopVerse images to GHCR manually (CI does this automatically).
#   echo $GHCR_PAT | docker login ghcr.io -u <github-user> --password-stdin
#   make push TAG=v1
REGISTRY ?= ghcr.io/shaggydesai/microservice-app
TAG      ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
PLATFORM ?= linux/amd64
SERVICES := api-gateway user-service product-service cart-service order-service payment-service

.PHONY: build push up down helm-lint helm-template

build:
	docker build --platform $(PLATFORM) -t $(REGISTRY)/frontend:$(TAG) frontend
	@for s in $(SERVICES); do \
		docker build --platform $(PLATFORM) -t $(REGISTRY)/$$s:$(TAG) services/$$s || exit 1; \
	done

push: build
	docker push $(REGISTRY)/frontend:$(TAG)
	@for s in $(SERVICES); do docker push $(REGISTRY)/$$s:$(TAG) || exit 1; done

up:
	docker compose -f local-dev/docker-compose.yml up --build -d
	@echo "ShopVerse is starting on http://localhost:3000 (admin@shopverse.local / admin123)"

down:
	docker compose -f local-dev/docker-compose.yml down

helm-lint:
	helm lint helm/shopverse
	@for e in gitops/environments/*/; do helm lint helm/shopverse -f $$e/values.yaml || exit 1; done

helm-template:
	helm template shopverse helm/shopverse -f gitops/environments/dev/values.yaml
