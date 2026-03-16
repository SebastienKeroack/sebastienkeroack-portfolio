# Git Bash should be used for the following commands:

```bash
# Ensure '.env' exists
[ ! -f '.env' ] && cp .env.example .env

# Get environment variables
source .envrc

# Update Scoop
scoop update -a

# Install Bun via Scoop
scoop install bun@$BUN_VERSION

# Install Bun packages
bun install
# OR
# bun outdated
# bun update --latest

# Install PHP via Scoop
scoop bucket add versions
scoop install php$PHP_CI_VERSION
pushd $USERPROFILE/scoop/apps/php$PHP_CI_VERSION/current
cp php.ini-production php.ini
sed -i 's/^;extension=openssl/extension=openssl/' php.ini
sed -i 's/^;extension=curl/extension=curl/' php.ini
php --ini
php -m | rg "openssl|curl"
popd

# Install Composer via Scoop
scoop install composer@$PHP_COMPOSER_VERSION
composer self-update --update-keys

# Install Composer packages
composer install --working-dir "core/php"
# OR
# composer update --working-dir "core/php" --no-ansi --prefer-dist

# SetUp pre-commit hook
bun run prepare

# Lint repo
bun run lint:all

# Test repo
bun run test:all

# Build repo
bun run build
```
