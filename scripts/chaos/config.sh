#!/usr/bin/env bash
# ── Chaos Test Configuration ──────────────────────────────────
# All scripts source this file for shared constants.

export MONOLITH_URL="${MONOLITH_URL:-http://localhost:3000}"
export AUCTION_URL="${AUCTION_URL:-http://localhost:3001}"

export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-5432}"
export DB_NAME="${DB_NAME:-nettapu}"
export DB_USER="${DB_USER:-nettapu_app}"
export DB_PASS="${DB_PASS:-app_secret_change_me}"
export DB_MIGRATOR_USER="${DB_MIGRATOR_USER:-nettapu_migrator}"
export DB_MIGRATOR_PASS="${DB_MIGRATOR_PASS:-migrator_secret_change_me}"
export PGPASSWORD="$DB_PASS"

export REDIS_HOST="${REDIS_HOST:-localhost}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export REDIS_PASS="${REDIS_PASS:-redis_secret_change_me}"

export PG_CONTAINER="${PG_CONTAINER:-nettapu-postgres}"
export REDIS_CONTAINER="${REDIS_CONTAINER:-nettapu-redis}"
export MONOLITH_CONTAINER="${MONOLITH_CONTAINER:-nettapu-monolith}"
export AUCTION_CONTAINER="${AUCTION_CONTAINER:-nettapu-auction}"

export CHAOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export RESULTS_DIR="${CHAOS_DIR}/results"
export CHAOS_PREFIX="chaos-$(date +%s)"

# ── Helper functions ──────────────────────────────────────────

psql_app() {
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A "$@"
}

psql_migrator() {
  PGPASSWORD="$DB_MIGRATOR_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_MIGRATOR_USER" -d "$DB_NAME" -t -A "$@"
}

redis_cmd() {
  redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASS" --no-auth-warning "$@"
}

log_info() {
  echo "  [INFO] $*"
}

log_pass() {
  echo "  [PASS] $*"
}

log_fail() {
  echo "  [FAIL] $*"
}

log_warn() {
  echo "  [WARN] $*"
}

# Wait for monolith health
wait_monolith() {
  local max_wait="${1:-30}"
  local i=0
  while [ $i -lt $max_wait ]; do
    if curl -sf "${MONOLITH_URL}/api/v1/health" > /dev/null 2>&1; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

# Wait for auction-service health
wait_auction() {
  local max_wait="${1:-30}"
  local i=0
  while [ $i -lt $max_wait ]; do
    if curl -sf "${AUCTION_URL}/api/v1/auctions/health" > /dev/null 2>&1; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

# Wait for postgres
wait_postgres() {
  local max_wait="${1:-30}"
  local i=0
  while [ $i -lt $max_wait ]; do
    if PGPASSWORD="$DB_PASS" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

# Wait for redis
wait_redis() {
  local max_wait="${1:-30}"
  local i=0
  while [ $i -lt $max_wait ]; do
    if redis_cmd ping 2>/dev/null | grep -q PONG; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

# Get a user token — registers a new user if needed, returns JWT
get_user_token() {
  local email="$1"
  local password="${2:-ChaosTest123!}"
  local first="${3:-Chaos}"
  local last="${4:-User}"

  # Try register (may fail if exists — that's fine)
  curl -sf -X POST "${MONOLITH_URL}/api/v1/auth/register" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\",\"firstName\":\"${first}\",\"lastName\":\"${last}\"}" \
    > /dev/null 2>&1

  # Login
  local resp
  resp=$(curl -sf -X POST "${MONOLITH_URL}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" 2>/dev/null)

  echo "$resp" | jq -r '.accessToken // empty'
}

# Get admin token — creates user, grants admin role via DB
get_admin_token() {
  local email="$1"
  local password="${2:-ChaosTest123!}"

  # Register
  local reg_resp
  reg_resp=$(curl -sf -X POST "${MONOLITH_URL}/api/v1/auth/register" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\",\"firstName\":\"Chaos\",\"lastName\":\"Admin\"}" 2>/dev/null)

  local user_id
  user_id=$(echo "$reg_resp" | jq -r '.id // empty')

  if [ -z "$user_id" ]; then
    # Already exists — get ID from login
    local login_resp
    login_resp=$(curl -sf -X POST "${MONOLITH_URL}/api/v1/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" 2>/dev/null)
    user_id=$(echo "$login_resp" | jq -r '.userId // empty')
  fi

  # Grant admin role
  if [ -n "$user_id" ]; then
    psql_app -c "
      INSERT INTO auth.user_roles (user_id, role_id)
      SELECT '${user_id}', id FROM auth.roles WHERE name = 'admin'
      ON CONFLICT DO NOTHING;
    " > /dev/null 2>&1
  fi

  # Re-login to get token with admin role
  local resp
  resp=$(curl -sf -X POST "${MONOLITH_URL}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" 2>/dev/null)

  echo "$resp" | jq -r '.accessToken // empty'
}

# Cleanup chaos test data
cleanup_chaos_data() {
  local prefix="$1"
  psql_app -c "
    DELETE FROM payments.payment_ledger WHERE payment_id IN
      (SELECT id FROM payments.payments WHERE idempotency_key LIKE '${prefix}%');
    DELETE FROM payments.pos_transactions WHERE payment_id IN
      (SELECT id FROM payments.payments WHERE idempotency_key LIKE '${prefix}%');
    DELETE FROM payments.idempotency_keys WHERE key LIKE '${prefix}%';
    DELETE FROM payments.payments WHERE idempotency_key LIKE '${prefix}%';
    DELETE FROM payments.reconciliation_runs WHERE details->>'chaos_prefix' = '${prefix}';
  " > /dev/null 2>&1
}
