ARG BUN_IMAGE=oven/bun:1.3.10-alpine@sha256:32f1fcccb1523960b254c4f80973bee1a910d60be000a45c20c9129a1efcffee
ARG NGINX_IMAGE=cgr.dev/chainguard/nginx:latest@sha256:ff2a257e03689363e7dabc3456030c58b790604c3a8f91902fe89a604ec05ce3
ARG PHP_FPM_IMAGE=cgr.dev/chainguard/php:latest-fpm
ARG PHP_COMPOSER_IMAGE=composer:2.9.5

FROM ${PHP_COMPOSER_IMAGE} AS composer-dev-deps

WORKDIR /workspace

COPY core/php/composer.* core/php/

RUN composer --working-dir core/php install \
	--no-ansi \
	--no-interaction \
	--no-progress \
	--prefer-dist


FROM ${PHP_COMPOSER_IMAGE} AS composer-prod-deps

WORKDIR /workspace

COPY core/php/composer.* core/php/

RUN composer --working-dir core/php install \
  --no-ansi \
  --no-dev \
  --no-interaction \
  --no-progress \
  --prefer-dist \
  --optimize-autoloader


FROM ${BUN_IMAGE} AS site

WORKDIR /workspace

COPY bunfig.toml bunfig.toml
COPY bun.lock bun.lock
COPY jsconfig.json jsconfig.json
COPY package.json package.json
COPY version.txt version.txt
COPY core/bun core/bun
COPY core/public_html core/public_html

RUN bun install --frozen-lockfile

RUN bun run build


FROM site AS build

ARG RUN_LINT=true
ARG RUN_TESTS=true
ARG PHP_VER=84

RUN apk add --no-cache \
  php${PHP_VER} \
  php${PHP_VER}-dom \
  php${PHP_VER}-mbstring \
  && ln -sf "/usr/bin/php${PHP_VER}" /usr/local/bin/php

COPY core/php/bootstrap core/php/bootstrap
COPY core/php/composer.* core/php/
COPY core/php/language core/php/language
COPY core/php/*.xml core/php/
COPY core/php/src core/php/src
COPY core/php/test core/php/test
COPY --from=composer-dev-deps /workspace/core/php/vendor core/php/vendor

RUN if [ "${RUN_LINT}" = "true" ]; then bun run lint:all; fi

RUN if [ "${RUN_TESTS}" = "true" ]; then bun run test:all; fi


FROM scratch AS export-artifacts

COPY --from=build /workspace/build/public_html /var/www/public_html
COPY --from=build /workspace/core/php /var/www/core/php
COPY --from=composer-prod-deps /workspace/core/php/vendor /var/www/core/php/vendor


FROM ${NGINX_IMAGE} AS runtime-nginx

COPY --from=export-artifacts /var/www/public_html /var/www/public_html
COPY ci/nginx/http.conf ci/nginx/nginx.conf ci/nginx/server.conf /etc/nginx/

EXPOSE 8080


FROM ${NGINX_IMAGE} AS runtime-static

# The built site without its PHP pages, which only the full profile's backend runs.
COPY --from=site --exclude=**/*.php /workspace/build/public_html /var/www/public_html
COPY --chmod=0644 ci/nginx/http.conf ci/nginx/server.conf /etc/nginx/
COPY --chmod=0644 ci/nginx/static.conf /etc/nginx/nginx.conf

USER 65532:65532

EXPOSE 8080


FROM ${PHP_FPM_IMAGE} AS runtime-php

WORKDIR /var/www

COPY --from=export-artifacts /var/www/public_html /var/www/public_html
COPY --from=export-artifacts /var/www/core/php /var/www/core/php
COPY ci/php/container-init.php /var/www/core/php/bootstrap/container-init.php

EXPOSE 9000

ENTRYPOINT ["php-fpm"]
CMD ["-F", \
  "-d", "auto_prepend_file=/var/www/core/php/bootstrap/container-init.php", \
  "-d", "variables_order=EGPCS", \
  "-d", "zend.assertions=-1", \
  "-d", "assert.active=0"]
