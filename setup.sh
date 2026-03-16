#!/bin/bash
# @author
# Sébastien Kéroack <code@sebastienkeroack.com>
# @copyright
# 2026 Sébastien Kéroack. All rights reserved.
# @license
# https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
# Apache License
# ==============================================================================

# Shell options:
# -e: abort script if one command fails
# -u: error if undefined variable used
# -x: log all commands
# -o pipefail: entire command fails if pipe fails. watch out for yes | ...
# -o history: record shell history
# -o allexport: export all functions and variables to be available to subscripts
set -a; source .envrc; set +a
set -eu

# Generate .env if it does not exist
if [ ! -f ".env" ]; then
  cp .env.example \
     .env
  source .env
fi

ACTION="${1:-help}"
case "$ACTION" in
  docker)
    # Create build directory if it doesn't exist
    mkdir -p "$PROJECT_ROOT/build"

    # Generate docker-compose.yaml
    envsubst < "$PROJECT_ROOT/ci/docker-compose.yaml" \
             > "$PROJECT_ROOT/build/docker-compose.yaml"

    # Build backend image
    docker build \
      --build-arg "RUN_LINT=$BUILD_RUN_LINT" \
      --build-arg "RUN_TESTS=$BUILD_RUN_TESTS" \
      --build-arg "BUN_IMAGE=$BUN_IMAGE" \
      --build-arg "NGINX_IMAGE=$NGINX_IMAGE" \
      --build-arg "PHP_VER=$PHP_CI_VERSION" \
      --build-arg "PHP_FPM_IMAGE=$PHP_FPM_IMAGE" \
      --build-arg "PHP_COMPOSER_IMAGE=$PHP_COMPOSER_IMAGE" \
      --target "runtime-php" \
      -t "sebastienkeroack-portfolio-backend:$PROJECT_VERSION" \
      -f "$PROJECT_ROOT/ci/Dockerfile" \
      "$PROJECT_ROOT"

    # Build frontend image
    docker build \
      --build-arg "RUN_LINT=$BUILD_RUN_LINT" \
      --build-arg "RUN_TESTS=$BUILD_RUN_TESTS" \
      --build-arg "BUN_IMAGE=$BUN_IMAGE" \
      --build-arg "NGINX_IMAGE=$NGINX_IMAGE" \
      --build-arg "PHP_VER=$PHP_CI_VERSION" \
      --build-arg "PHP_FPM_IMAGE=$PHP_FPM_IMAGE" \
      --build-arg "PHP_COMPOSER_IMAGE=$PHP_COMPOSER_IMAGE" \
      --target "runtime-nginx" \
      -t "sebastienkeroack-portfolio-frontend:$PROJECT_VERSION" \
      -f "$PROJECT_ROOT/ci/Dockerfile" \
      "$PROJECT_ROOT"

    echo
    echo "Docker images built. You can now run 'docker-compose -f build/docker-compose.yaml up' to start the services."
    ;;
  kubernetes)
    # Create build directory if it doesn't exist
    mkdir -p "$PROJECT_ROOT/build/manifests/"

    # Generate Kubernetes manifests
    envsubst < "$PROJECT_ROOT/ci/kubernetes/frontend.yaml" \
             > "$PROJECT_ROOT/build/manifests/frontend.yaml"
    envsubst < "$PROJECT_ROOT/ci/kubernetes/backend.yaml" \
             > "$PROJECT_ROOT/build/manifests/backend.yaml"

    # Generate configmap for nginx
    {
      cat <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: portfolio-frontend-nginx-config
  namespace: sebastienkeroack-dot-com
data:
  nginx.conf: |
EOF
      sed \
        -e 's/ backend:9000;/ portfolio-backend:9000;/' \
        -e 's/^/    /' \
        "$PROJECT_ROOT/ci/nginx/nginx.conf"
    } > "$PROJECT_ROOT/build/manifests/frontend-configmap.yaml"

    # Build backend image
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
      -t "sebastienkeroack-portfolio-backend:$PROJECT_VERSION" \
      -f "$PROJECT_ROOT/ci/Dockerfile" \
      "$PROJECT_ROOT"

    # Build frontend image
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
      -t "sebastienkeroack-portfolio-frontend:$PROJECT_VERSION" \
      -f "$PROJECT_ROOT/ci/Dockerfile" \
      "$PROJECT_ROOT"
    ;;
  *)
    echo "sebastienkeroack-portfolio setup script"
    echo ""
    echo "Usage: $0 <action>"
    echo ""
    echo "Actions:"
    echo "  docker       - Build Docker images"
    echo "  kubernetes   - Build Kubernetes images"
    ;;
esac
