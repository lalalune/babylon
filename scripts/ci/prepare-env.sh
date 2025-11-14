#!/usr/bin/env bash

set -euo pipefail

# Default local Postgres used during CI build cache warmup
DEFAULT_DB_URL=${DEFAULT_DB_URL:-postgresql://postgres:postgres@localhost:5432/test_db}

create_env_files() {
if [[ -f .env.test ]]; then
  echo "ℹ️  Using existing .env.test"
else
  echo "📝 Creating .env.test from provided variables"
  cat > .env.test <<EOF
DATABASE_URL=${DEFAULT_DB_URL}
DIRECT_DATABASE_URL=${DEFAULT_DB_URL}
POSTGRES_PRISMA_URL=${DEFAULT_DB_URL}
POSTGRES_URL_NON_POOLING=${DEFAULT_DB_URL}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET_VAR:-}
PRIVY_APP_ID=${PRIVY_APP_ID_VAR:-}
PRIVY_APP_SECRET=${PRIVY_APP_SECRET_VAR:-}
PRIVY_TEST_EMAIL=${PRIVY_TEST_EMAIL_VAR:-}
PRIVY_TEST_PASSWORD=${PRIVY_TEST_PASSWORD_VAR:-}
NEXT_PUBLIC_PRIVY_APP_ID=${PRIVY_APP_ID_VAR:-}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY_VAR:-}
OPENAI_API_KEY=${OPENAI_API_KEY_VAR:-}
GROQ_API_KEY=${GROQ_API_KEY_VAR:-}
FAL_KEY=${FAL_KEY_VAR:-}
CRON_SECRET=${CRON_SECRET_VAR:-}
WALLET_SEED_PHRASE=${WALLET_SEED_PHRASE_VAR:-}
WALLET_PASSWORD=${WALLET_PASSWORD_VAR:-}
EOF
fi

  cp .env.test .env
  cp .env.test .env.local
}

override_database_url() {
  if [[ -n "${DATABASE_URL_SECRET:-}" ]]; then
    {
      echo "DATABASE_URL=${DATABASE_URL_SECRET}"
      echo "DIRECT_DATABASE_URL=${DATABASE_URL_SECRET}"
    } >> .env
    {
      echo "DATABASE_URL=${DATABASE_URL_SECRET}"
      echo "DIRECT_DATABASE_URL=${DATABASE_URL_SECRET}"
    } >> .env.local
  fi
}

main() {
  create_env_files
  override_database_url
}

main "$@"

