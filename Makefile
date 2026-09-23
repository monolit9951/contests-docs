# Variables
VERSION ?= latest
DOCS_ENV ?= prod
RELEASE_SHA ?= development
HOST_FOR_DOCKER_IMAGE ?= contestvibe
PROJECT_NAME ?= contests-docs

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
%:
	@:

docker_login: ## login to docker registry.
	docker login

# Hashed-asset retention inputs have no defaults (see DEPLOY_NOTES.md). Release CD
# passes the digest-pinned committed image, its revision and the commit time. A
# local or DOCS_ENV=dev build names the bare runtime base explicitly, e.g.
#   RETENTION_BASE=nginx:alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752
#   RETENTION_BASE_REVISION=genesis RELEASE_EPOCH=$(git show -s --format=%ct HEAD)
# RETENTION_WINDOW_DAYS is passed only when set: the documented emergency purge.
build_app: ## Build Application docker image (RETENTION_BASE, RETENTION_BASE_REVISION, RELEASE_EPOCH required).
	$(if $(RETENTION_BASE),,$(error RETENTION_BASE is required: a digest-pinned committed image, or the nginx base with RETENTION_BASE_REVISION=genesis))
	$(if $(RETENTION_BASE_REVISION),,$(error RETENTION_BASE_REVISION is required: the 40-hex release RETENTION_BASE serves, or genesis))
	$(if $(RELEASE_EPOCH),,$(error RELEASE_EPOCH is required: the commit time in seconds, git show -s --format=%ct <sha>))
	npm run gen:dates
	docker build -f Dockerfile --build-arg DOCS_ENV=$(DOCS_ENV) \
		--build-arg RELEASE_SHA=$(RELEASE_SHA) \
		--build-arg RETENTION_BASE=$(RETENTION_BASE) \
		--build-arg RETENTION_BASE_REVISION=$(RETENTION_BASE_REVISION) \
		--build-arg RELEASE_EPOCH=$(RELEASE_EPOCH) \
		$(if $(RETENTION_WINDOW_DAYS),--build-arg RETENTION_WINDOW_DAYS=$(RETENTION_WINDOW_DAYS)) \
		--build-arg GOOGLE_SITE_VERIFICATION=$(GOOGLE_SITE_VERIFICATION) \
		--build-arg YANDEX_VERIFICATION=$(YANDEX_VERIFICATION) \
		-t $(HOST_FOR_DOCKER_IMAGE)/$(PROJECT_NAME):$(VERSION) .

push_app: ## Push Application docker image.
	docker push $(HOST_FOR_DOCKER_IMAGE)/$(PROJECT_NAME):$(VERSION)

docker: ## Build and push all necessary docker images.
	make build_app push_app
