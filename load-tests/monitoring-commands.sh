#!/usr/bin/env bash
#
# NetTapu — Monitoring Commands During Load Tests
#
# Run each command in a separate terminal tab/pane.
# Assumes Docker Compose stack is running locally.
#

set -euo pipefail

REDIS_PASSWORD="${REDIS_PASSWORD:-redis_secret_change_me}"
PG_USER="${PG_USER:-nettapu_app}"
PG_PASSWORD="${PG_PASSWORD:-app_secret_change_me}"

cat <<'HEADER'
╔══════════════════════════════════════════════════════════════════════╗
║  NetTapu Load Test Monitoring                                       ║
║  Run each command below in a separate terminal                      ║
╚══════════════════════════════════════════════════════════════════════╝
HEADER

echo "
═══════════════════════════════════════════════════════════════════════
 1. DOCKER CONTAINER STATS (CPU, Memory, Network)
═══════════════════════════════════════════════════════════════════════

  docker stats --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.PIDs}}'

═══════════════════════════════════════════════════════════════════════
 2. REDIS MONITORING — Lock Contention + Memory
═══════════════════════════════════════════════════════════════════════

  # Live command monitor (watch SET NX for lock acquisitions):
  docker exec nettapu-redis redis-cli -a '${REDIS_PASSWORD}' MONITOR | grep -E 'bid:lock|settlement|auction:ending'

  # Key count snapshot every 5s:
  watch -n 5 'docker exec nettapu-redis redis-cli -a \"${REDIS_PASSWORD}\" INFO keyspace'

  # Memory usage:
  watch -n 5 'docker exec nettapu-redis redis-cli -a \"${REDIS_PASSWORD}\" INFO memory | grep -E \"used_memory_human|maxmemory_human|mem_fragmentation\"'

  # Active lock count:
  watch -n 2 'docker exec nettapu-redis redis-cli -a \"${REDIS_PASSWORD}\" --scan --pattern \"bid:lock:*\" | wc -l'

  # Pub/Sub channel stats:
  watch -n 5 'docker exec nettapu-redis redis-cli -a \"${REDIS_PASSWORD}\" PUBSUB NUMSUB'

═══════════════════════════════════════════════════════════════════════
 3. POSTGRESQL — Connection Pool + Query Performance
═══════════════════════════════════════════════════════════════════════

  # Active connections (should stay below max=25 for auction-service):
  watch -n 2 \"docker exec nettapu-postgres psql -U ${PG_USER} -d nettapu -c \\\"
    SELECT state, count(*)
    FROM pg_stat_activity
    WHERE datname = 'nettapu'
    GROUP BY state
    ORDER BY count DESC;
  \\\"\"

  # Slowest active queries:
  watch -n 5 \"docker exec nettapu-postgres psql -U nettapu_migrator -d nettapu -c \\\"
    SELECT pid, now() - pg_stat_activity.query_start AS duration,
           left(query, 80) AS query, state, wait_event_type
    FROM pg_stat_activity
    WHERE datname = 'nettapu'
      AND state != 'idle'
      AND query NOT LIKE '%pg_stat%'
    ORDER BY duration DESC
    LIMIT 10;
  \\\"\"

  # Lock waits (contention indicator):
  watch -n 5 \"docker exec nettapu-postgres psql -U nettapu_migrator -d nettapu -c \\\"
    SELECT blocked.pid AS blocked_pid,
           blocking.pid AS blocking_pid,
           left(blocked_activity.query, 60) AS blocked_query,
           left(blocking_activity.query, 60) AS blocking_query
    FROM pg_locks blocked
    JOIN pg_locks blocking ON blocking.locktype = blocked.locktype
      AND blocking.database = blocked.database
      AND blocking.relation = blocked.relation
      AND blocking.pid != blocked.pid
    JOIN pg_stat_activity blocked_activity ON blocked_activity.pid = blocked.pid
    JOIN pg_stat_activity blocking_activity ON blocking_activity.pid = blocking.pid
    WHERE NOT blocked.granted
    LIMIT 10;
  \\\"\"

  # Bid insertion rate (count bids table every 5s):
  watch -n 5 \"docker exec nettapu-postgres psql -U nettapu_migrator -d nettapu -c \\\"
    SELECT count(*) AS total_bids,
           count(*) FILTER (WHERE created_at > now() - interval '5 seconds') AS last_5s
    FROM auction.bids;
  \\\"\"

═══════════════════════════════════════════════════════════════════════
 4. AUCTION-SERVICE LOGS (real-time)
═══════════════════════════════════════════════════════════════════════

  # Full structured logs:
  docker logs -f nettapu-auction 2>&1 | jq -r '. | \"\(.timestamp // .time) [\(.level // .severity)] \(.message // .msg)\"'

  # Filter for errors/warnings only:
  docker logs -f nettapu-auction 2>&1 | jq -r 'select(.level == \"error\" or .level == \"warn\") | \"\(.timestamp) [\(.level)] \(.message)\"'

  # Settlement worker activity:
  docker logs -f nettapu-auction 2>&1 | grep -i 'settlement'

  # Auction-ending worker activity:
  docker logs -f nettapu-auction 2>&1 | grep -i 'ending\|ended'

═══════════════════════════════════════════════════════════════════════
 5. NGINX — Request Rate + Errors
═══════════════════════════════════════════════════════════════════════

  # Live access log with status codes:
  docker logs -f nettapu-nginx 2>&1 | awk '{print \$9}' | sort | uniq -c | sort -rn

  # Rate limit hits (HTTP 429):
  docker logs -f nettapu-nginx 2>&1 | grep ' 429 '

  # WebSocket upgrade requests:
  docker logs -f nettapu-nginx 2>&1 | grep -i 'upgrade\|websocket'

═══════════════════════════════════════════════════════════════════════
 6. NODE.JS PROCESS — Event Loop + GC
═══════════════════════════════════════════════════════════════════════

  # If --expose-gc and process metrics endpoint available:
  watch -n 5 'curl -s http://localhost:3001/metrics 2>/dev/null | grep -E \"process_cpu|process_resident|nodejs_eventloop|nodejs_heap\"'

  # Alternative: exec into container and check /proc:
  watch -n 5 'docker exec nettapu-auction sh -c \"cat /proc/1/status | grep -E VmRSS\\|Threads\"'

═══════════════════════════════════════════════════════════════════════
 7. COMBINED DASHBOARD (single terminal)
═══════════════════════════════════════════════════════════════════════

  # One-shot snapshot every 10s:
  while true; do
    echo \"=== \$(date) ===\"
    echo \"--- Containers ---\"
    docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' | head -6
    echo \"--- PG Connections ---\"
    docker exec nettapu-postgres psql -U nettapu_migrator -d nettapu -t -c \"SELECT state, count(*) FROM pg_stat_activity WHERE datname='nettapu' GROUP BY state;\" 2>/dev/null
    echo \"--- Redis Memory ---\"
    docker exec nettapu-redis redis-cli -a '${REDIS_PASSWORD}' INFO memory 2>/dev/null | grep used_memory_human
    echo \"--- Active Bid Locks ---\"
    docker exec nettapu-redis redis-cli -a '${REDIS_PASSWORD}' --scan --pattern 'bid:lock:*' 2>/dev/null | wc -l
    echo \"\"
    sleep 10
  done
"
