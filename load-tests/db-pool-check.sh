#!/usr/bin/env bash
#
# NetTapu — DB Pool Diagnostic During Load Tests
#
# Usage:
#   ./load-tests/db-pool-check.sh          # one-shot snapshot
#   ./load-tests/db-pool-check.sh --watch   # continuous (every 3s)
#
set -euo pipefail

PG_CONTAINER="${PG_CONTAINER:-nettapu-postgres}"
PG_USER="${PG_USER:-nettapu_migrator}"
PG_DB="${PG_DB:-nettapu}"

run_query() {
  docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -t -c "$1" 2>/dev/null
}

snapshot() {
  echo "═══════════════════════════════════════════════════════════════"
  echo "  DB Pool Diagnostic — $(date '+%H:%M:%S')"
  echo "═══════════════════════════════════════════════════════════════"

  echo ""
  echo "── 1. Connections by state ─────────────────────────────────"
  run_query "
    SELECT state, count(*) AS cnt
    FROM pg_stat_activity
    WHERE datname = '$PG_DB'
    GROUP BY state
    ORDER BY cnt DESC;
  "

  echo "── 2. Connections by client (service) ──────────────────────"
  run_query "
    SELECT client_addr,
           usename,
           count(*) AS total,
           count(*) FILTER (WHERE state = 'active') AS active,
           count(*) FILTER (WHERE state = 'idle') AS idle,
           count(*) FILTER (WHERE wait_event_type = 'Lock') AS waiting_on_lock
    FROM pg_stat_activity
    WHERE datname = '$PG_DB'
    GROUP BY client_addr, usename
    ORDER BY total DESC;
  "

  echo "── 3. Pool saturation indicator ────────────────────────────"
  local total active max_conn
  total=$(run_query "SELECT count(*) FROM pg_stat_activity WHERE datname = '$PG_DB';" | tr -d ' ')
  active=$(run_query "SELECT count(*) FROM pg_stat_activity WHERE datname = '$PG_DB' AND state = 'active';" | tr -d ' ')
  max_conn=$(run_query "SHOW max_connections;" | tr -d ' ')
  echo "  Total connections: $total / $max_conn (postgres max)"
  echo "  Active queries:    $active"
  echo ""
  echo "  Pool config:  auction-service max=25, monolith max=30"
  echo "  Saturation:   if a service's connections = its max → pool exhausted"
  echo ""

  if [ "${active:-0}" -gt 20 ]; then
    echo "  ⚠ HIGH: $active active queries — possible pool pressure"
  else
    echo "  ✓ OK: $active active queries"
  fi

  echo ""
  echo "── 4. Longest running queries ──────────────────────────────"
  run_query "
    SELECT pid,
           now() - query_start AS duration,
           state,
           wait_event_type,
           left(query, 80) AS query
    FROM pg_stat_activity
    WHERE datname = '$PG_DB'
      AND state != 'idle'
      AND query NOT LIKE '%pg_stat%'
    ORDER BY query_start ASC
    LIMIT 10;
  "

  echo "── 5. Lock contention ──────────────────────────────────────"
  local locks
  locks=$(run_query "
    SELECT count(*)
    FROM pg_locks blocked
    JOIN pg_locks blocking ON blocking.locktype = blocked.locktype
      AND blocking.database = blocked.database
      AND blocking.relation = blocked.relation
      AND blocking.pid != blocked.pid
    WHERE NOT blocked.granted;
  " | tr -d ' ')
  echo "  Blocked queries waiting on locks: ${locks:-0}"

  echo ""
  echo "═══════════════════════════════════════════════════════════════"
}

if [ "${1:-}" = "--watch" ]; then
  while true; do
    clear
    snapshot
    sleep 3
  done
else
  snapshot
fi
