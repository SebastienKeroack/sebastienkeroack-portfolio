# Container Build And Deployment

From the repository root:

```bash
# Ensure '.env' exists
[ ! -f '.env' ] && cp .env.example .env

# Get environment variables
source .envrc
```

## Deploy on Docker

```bash
docker build \
  --build-arg "RUN_LINT=$BUILD_RUN_LINT" \
  --build-arg "RUN_TESTS=$BUILD_RUN_TESTS" \
  --build-arg "BUN_IMAGE=$BUN_IMAGE" \
  --build-arg "NGINX_IMAGE=$NGINX_IMAGE" \
  --build-arg "PHP_VER=$PHP_CI_VERSION" \
  --build-arg "PHP_FPM_IMAGE=$PHP_FPM_IMAGE" \
  --build-arg "PHP_COMPOSER_IMAGE=$PHP_COMPOSER_IMAGE" \
  --target "runtime-nginx" \
  -t "sebastienkeroack-portfolio-frontend:latest" \
  -f "./ci/Dockerfile" .

docker build \
  --build-arg "RUN_LINT=$BUILD_RUN_LINT" \
  --build-arg "RUN_TESTS=$BUILD_RUN_TESTS" \
  --build-arg "BUN_IMAGE=$BUN_IMAGE" \
  --build-arg "NGINX_IMAGE=$NGINX_IMAGE" \
  --build-arg "PHP_VER=$PHP_CI_VERSION" \
  --build-arg "PHP_FPM_IMAGE=$PHP_FPM_IMAGE" \
  --build-arg "PHP_COMPOSER_IMAGE=$PHP_COMPOSER_IMAGE" \
  --target "runtime-php" \
  -t "sebastienkeroack-portfolio-backend:latest" \
  -f "./ci/Dockerfile" .

docker compose -f ci/docker-compose.yaml up
```

The site will be available on port `8080`.

## Deploy On Kubernetes

```bash
nerdctl -n=k8s.io build \
  --platform "$ARCH" \
  --build-arg "RUN_LINT=$BUILD_RUN_LINT" \
  --build-arg "RUN_TESTS=$BUILD_RUN_TESTS" \
  --build-arg "BUN_IMAGE=$BUN_IMAGE" \
  --build-arg "NGINX_IMAGE=$NGINX_IMAGE" \
  --build-arg "PHP_VER=$PHP_CI_VERSION" \
  --build-arg "PHP_FPM_IMAGE=$PHP_FPM_IMAGE" \
  --build-arg "PHP_COMPOSER_IMAGE=$PHP_COMPOSER_IMAGE" \
  --target "runtime-nginx" \
  -t "sebastienkeroack-portfolio-frontend:latest" \
  -f "./ci/Dockerfile" .

nerdctl -n=k8s.io build \
  --platform "$ARCH" \
  --build-arg "RUN_LINT=$BUILD_RUN_LINT" \
  --build-arg "RUN_TESTS=$BUILD_RUN_TESTS" \
  --build-arg "BUN_IMAGE=$BUN_IMAGE" \
  --build-arg "NGINX_IMAGE=$NGINX_IMAGE" \
  --build-arg "PHP_VER=$PHP_CI_VERSION" \
  --build-arg "PHP_FPM_IMAGE=$PHP_FPM_IMAGE" \
  --build-arg "PHP_COMPOSER_IMAGE=$PHP_COMPOSER_IMAGE" \
  --target "runtime-php" \
  -t "sebastienkeroack-portfolio-backend:latest" \
  -f "./ci/Dockerfile" .

kubectl apply -n=default -f "ci/kubernetes/frontend.yaml"
kubectl apply -n=default -f "ci/kubernetes/backend.yaml"
```

---

The nginx deployment is the public edge. The internal FastCGI service is exposed in-cluster as `php` so it matches the nginx upstream configuration baked into the image.

## Notes

- The runtime images are distroless Chainguard images.
- The build stage is intentionally not distroless because Bun, Composer, linting, and tests require a tool-rich environment.
- Composer dependencies are installed from the committed `core/php/composer.lock` for both dev/test usage and production runtime usage, so the Bun build stage does not need Composer installed.
- The PHP runtime uses a container prepend script to replace the old Apache/XAMPP `auto_prepend_file` and `include_path` setup.
- The PHP runtime explicitly overrides the Chainguard `s6` entrypoint and starts `php-fpm` directly so the container can run correctly with `read_only: true` under Docker Compose and `nerdctl compose`.
