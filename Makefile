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

build_app: ## Build Application docker image.
	npm run gen:dates
	docker build -f Dockerfile --build-arg DOCS_ENV=$(DOCS_ENV) \
		--build-arg RELEASE_SHA=$(RELEASE_SHA) \
		--build-arg GOOGLE_SITE_VERIFICATION=$(GOOGLE_SITE_VERIFICATION) \
		--build-arg YANDEX_VERIFICATION=$(YANDEX_VERIFICATION) \
		-t $(HOST_FOR_DOCKER_IMAGE)/$(PROJECT_NAME):$(VERSION) .

push_app: ## Push Application docker image.
	docker push $(HOST_FOR_DOCKER_IMAGE)/$(PROJECT_NAME):$(VERSION)

docker: ## Build and push all necessary docker images.
	make build_app push_app
