# Local Development on Windows

Use Git Bash for every command in this guide.

## 1. Create the local environment file

```bash
[ ! -f '.env' ] && cp .env.example .env
source .envrc
```

This loads the version variables used by the install commands below.

## 2. Update Scoop

```bash
scoop update -a
```

## 3. Install Bun and JavaScript dependencies

```bash
scoop install bun@$BUN_VERSION
bun install
```

If you want to update JavaScript dependencies instead:

```bash
bun outdated
bun update --latest
```

## 4. Install PHP and enable required extensions

```bash
scoop bucket add versions
scoop install php$PHP_CI_VERSION
pushd "$USERPROFILE/scoop/apps/php$PHP_CI_VERSION/current"
cp php.ini-production php.ini
sed -i 's/^;extension=openssl/extension=openssl/' php.ini
sed -i 's/^;extension=curl/extension=curl/' php.ini
php --ini
php -m | rg "openssl|curl"
popd
```

The last command should show both `openssl` and `curl`.

## 5. Install Composer and PHP dependencies

```bash
scoop install composer@$PHP_COMPOSER_VERSION
composer self-update --update-keys
composer install --working-dir "core/php"
```

If you want to refresh PHP dependencies instead:

```bash
composer update --working-dir "core/php" --no-ansi --prefer-dist
```

## 6. Prepare the repo

```bash
bun run prepare
```

This sets up the pre-commit hook.

## 7. Validate the setup

```bash
bun run lint:all
bun run test:all
bun run build
```

If all three commands pass, your local environment is ready.
