#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────
# NetTapu — Performance Benchmark Report Generator
#
# Parses k6 JSON output + telemetry snapshots → benchmark summary
#
# Usage:
#   ./load-tests/generate-report.sh [results_dir]
#
# Default results_dir: load-tests/results/
# ─────────────────────────────────────────────────────────────────

RESULTS_DIR="${1:-load-tests/results}"
REPORT_FILE="${RESULTS_DIR}/benchmark-report.txt"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$RESULTS_DIR"

# ── Helpers ─────────────────────────────────────────────────────
bold()  { printf "\033[1m%s\033[0m" "$1"; }
red()   { printf "\033[31m%s\033[0m" "$1"; }
green() { printf "\033[32m%s\033[0m" "$1"; }
yellow(){ printf "\033[33m%s\033[0m" "$1"; }

# Parse k6 JSON summary (end-of-test summary lines)
parse_k6_metric() {
  local file="$1" metric="$2" stat="$3"
  if [ ! -f "$file" ]; then echo "N/A"; return; fi
  # k6 JSON output has lines like: {"type":"Point","metric":"http_req_duration","data":{"time":"...","value":123.45}}
  # For summary, look for type=Metric
  local val
  val=$(grep "\"metric\":\"${metric}\"" "$file" 2>/dev/null \
    | grep '"type":"Point"' \
    | tail -1000 \
    | python3 -c "
import sys, json
values = []
for line in sys.stdin:
    try:
        d = json.loads(line.strip())
        if d.get('type') == 'Point':
            values.append(d['data']['value'])
    except: pass
if not values:
    print('N/A')
elif '${stat}' == 'avg':
    print(f'{sum(values)/len(values):.2f}')
elif '${stat}' == 'p95':
    values.sort()
    idx = int(len(values) * 0.95)
    print(f'{values[min(idx, len(values)-1)]:.2f}')
elif '${stat}' == 'p99':
    values.sort()
    idx = int(len(values) * 0.99)
    print(f'{values[min(idx, len(values)-1)]:.2f}')
elif '${stat}' == 'max':
    print(f'{max(values):.2f}')
elif '${stat}' == 'count':
    print(len(values))
elif '${stat}' == 'sum':
    print(f'{sum(values):.0f}')
elif '${stat}' == 'last':
    print(f'{values[-1]:.2f}')
elif '${stat}' == 'rate':
    total = len(values)
    fails = sum(1 for v in values if v > 0)
    print(f'{(fails/total)*100:.1f}%' if total > 0 else 'N/A')
" 2>/dev/null || echo "N/A")
  echo "$val"
}

# Count k6 requests by status
count_status() {
  local file="$1" metric="$2"
  if [ ! -f "$file" ]; then echo "0"; return; fi
  grep "\"metric\":\"${metric}\"" "$file" 2>/dev/null \
    | grep '"type":"Point"' \
    | python3 -c "
import sys, json
total = 0
for line in sys.stdin:
    try:
        d = json.loads(line.strip())
        total += d['data']['value']
    except: pass
print(int(total))
" 2>/dev/null || echo "0"
}

# Get max VU count from k6 JSON
get_max_vus() {
  local file="$1"
  if [ ! -f "$file" ]; then echo "N/A"; return; fi
  grep '"vus"' "$file" 2>/dev/null \
    | python3 -c "
import sys, json
max_vus = 0
for line in sys.stdin:
    try:
        d = json.loads(line.strip())
        v = d.get('data', {}).get('value', 0)
        if v > max_vus: max_vus = int(v)
    except: pass
print(max_vus if max_vus > 0 else 'N/A')
" 2>/dev/null || echo "N/A"
}

# Get total requests from k6 JSON
get_total_requests() {
  local file="$1"
  if [ ! -f "$file" ]; then echo "N/A"; return; fi
  grep '"http_reqs"' "$file" 2>/dev/null \
    | grep '"type":"Point"' \
    | wc -l \
    | tr -d ' '
}

# Get test duration from k6 JSON (first and last timestamp)
get_test_duration() {
  local file="$1"
  if [ ! -f "$file" ]; then echo "N/A"; return; fi
  python3 -c "
import json, sys
times = []
with open('$file') as f:
    for line in f:
        try:
            d = json.loads(line)
            t = d.get('data', {}).get('time', '')
            if t: times.append(t)
        except: pass
if len(times) >= 2:
    from datetime import datetime
    fmt = '%Y-%m-%dT%H:%M:%S'
    try:
        start = datetime.fromisoformat(times[0].replace('Z', '+00:00'))
        end = datetime.fromisoformat(times[-1].replace('Z', '+00:00'))
        print(f'{(end - start).total_seconds():.0f}s')
    except: print('N/A')
else:
    print('N/A')
" 2>/dev/null || echo "N/A"
}

# Calculate RPS from k6 JSON
get_rps() {
  local file="$1"
  if [ ! -f "$file" ]; then echo "N/A"; return; fi
  python3 -c "
import json
times = []
with open('$file') as f:
    for line in f:
        try:
            d = json.loads(line)
            if d.get('metric') == 'http_reqs' and d.get('type') == 'Point':
                times.append(d['data']['time'])
        except: pass
if len(times) >= 2:
    from datetime import datetime
    start = datetime.fromisoformat(times[0].replace('Z', '+00:00'))
    end = datetime.fromisoformat(times[-1].replace('Z', '+00:00'))
    dur = (end - start).total_seconds()
    if dur > 0:
        print(f'{len(times) / dur:.1f}')
    else:
        print('N/A')
else:
    print('N/A')
" 2>/dev/null || echo "N/A"
}

# ── Collect telemetry snapshots from running services ───────────
collect_telemetry() {
  local label="$1" url="$2"
  echo "  ${label}:"
  local resp
  resp=$(curl -s --max-time 3 "${url}/pool-stats" 2>/dev/null || echo '{"error":"unreachable"}')
  echo "    Pool: ${resp}"
  resp=$(curl -s --max-time 3 "${url}/runtime-metrics" 2>/dev/null || echo '{"error":"unreachable"}')
  echo "    Runtime: ${resp}"
}

# ── Generate Report ─────────────────────────────────────────────

{
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          NetTapu Performance Benchmark Report               ║"
echo "║          Generated: ${TIMESTAMP}               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Capacity Discovery Results ──────────────────────────────
CAPACITY_FILE="${RESULTS_DIR}/capacity.json"
if [ -f "$CAPACITY_FILE" ]; then
  echo "┌──────────────────────────────────────────────────────────────┐"
  echo "│ 1. CAPACITY DISCOVERY                                        │"
  echo "└──────────────────────────────────────────────────────────────┘"
  echo ""
  echo "  Max VUs reached:      $(get_max_vus "$CAPACITY_FILE")"
  echo "  Test duration:        $(get_test_duration "$CAPACITY_FILE")"
  echo "  Total requests:       $(get_total_requests "$CAPACITY_FILE")"
  echo "  Effective RPS:        $(get_rps "$CAPACITY_FILE")"
  echo ""
  echo "  Latency:"
  echo "    p95:                $(parse_k6_metric "$CAPACITY_FILE" "request_latency" "p95") ms"
  echo "    p99:                $(parse_k6_metric "$CAPACITY_FILE" "request_latency" "p99") ms"
  echo "    max:                $(parse_k6_metric "$CAPACITY_FILE" "request_latency" "max") ms"
  echo ""
  echo "  Status codes:"
  echo "    2xx:                $(count_status "$CAPACITY_FILE" "status_200")"
  echo "    429 (rate limit):   $(count_status "$CAPACITY_FILE" "status_429")"
  echo "    503 (nginx limit):  $(count_status "$CAPACITY_FILE" "status_503")"
  echo "    Other errors:       $(count_status "$CAPACITY_FILE" "http_errors")"
  echo ""
  echo "  Telemetry peaks:"
  echo "    DB pool waiting:    $(parse_k6_metric "$CAPACITY_FILE" "db_pool_waiting" "max")"
  echo "    Event loop lag:     $(parse_k6_metric "$CAPACITY_FILE" "event_loop_lag_ms" "max") ms"
  echo "    CPU usage:          $(parse_k6_metric "$CAPACITY_FILE" "cpu_usage_percent" "max")%"
  echo "    Heap used:          $(parse_k6_metric "$CAPACITY_FILE" "heap_used_mb" "max") MB"
  echo ""

  # Determine bottleneck
  POOL_WAIT=$(parse_k6_metric "$CAPACITY_FILE" "db_pool_waiting" "max")
  EL_LAG=$(parse_k6_metric "$CAPACITY_FILE" "event_loop_lag_ms" "max")
  P95_LAT=$(parse_k6_metric "$CAPACITY_FILE" "request_latency" "p95")

  echo "  BOTTLENECK ANALYSIS:"
  if [ "$POOL_WAIT" != "N/A" ] && [ "$(echo "$POOL_WAIT > 0" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
    echo "    ⚠  DB POOL SATURATION: ${POOL_WAIT} clients waiting"
    echo "       → Increase pool size or optimize query duration"
  fi
  if [ "$EL_LAG" != "N/A" ] && [ "$(echo "$EL_LAG > 50" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
    echo "    ⚠  EVENT LOOP BLOCKED: ${EL_LAG}ms lag"
    echo "       → Profile with --prof, check sync operations"
  fi
  if [ "$P95_LAT" != "N/A" ] && [ "$(echo "$P95_LAT > 200" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
    echo "    ⚠  LATENCY BREACH: p95=${P95_LAT}ms (threshold: 200ms)"
  fi
  if [ "$POOL_WAIT" = "N/A" ] && [ "$EL_LAG" = "N/A" ]; then
    echo "    ℹ  No telemetry data — run with INTERNAL_* env vars for full analysis"
  fi
  echo ""
else
  echo "┌──────────────────────────────────────────────────────────────┐"
  echo "│ 1. CAPACITY DISCOVERY — No results found                     │"
  echo "│    Run: k6 run --out json=${CAPACITY_FILE}                   │"
  echo "│         load-tests/k6-capacity-discovery.js                  │"
  echo "└──────────────────────────────────────────────────────────────┘"
  echo ""
fi

# ── 2. HTTP Load Test Results ──────────────────────────────────
HTTP_FILE="${RESULTS_DIR}/http-load.json"
if [ -f "$HTTP_FILE" ]; then
  echo "┌──────────────────────────────────────────────────────────────┐"
  echo "│ 2. HTTP LOAD TEST                                            │"
  echo "└──────────────────────────────────────────────────────────────┘"
  echo ""
  echo "  Total requests:       $(get_total_requests "$HTTP_FILE")"
  echo "  Effective RPS:        $(get_rps "$HTTP_FILE")"
  echo ""
  echo "  Auction browse:"
  echo "    p95:                $(parse_k6_metric "$HTTP_FILE" "auction_list_latency" "p95") ms"
  echo "    p99:                $(parse_k6_metric "$HTTP_FILE" "auction_list_latency" "p99") ms"
  echo ""
  echo "  Payment initiation:"
  echo "    p95:                $(parse_k6_metric "$HTTP_FILE" "payment_init_latency" "p95") ms"
  echo "    p99:                $(parse_k6_metric "$HTTP_FILE" "payment_init_latency" "p99") ms"
  echo ""
else
  echo "┌──────────────────────────────────────────────────────────────┐"
  echo "│ 2. HTTP LOAD TEST — No results found                         │"
  echo "│    Run: k6 run --out json=${HTTP_FILE}                       │"
  echo "│         load-tests/k6-http-load.js                           │"
  echo "└──────────────────────────────────────────────────────────────┘"
  echo ""
fi

# ── 3. WebSocket Load Test Results ─────────────────────────────
WS_FILE="${RESULTS_DIR}/ws-load.json"
if [ -f "$WS_FILE" ]; then
  echo "┌──────────────────────────────────────────────────────────────┐"
  echo "│ 3. WEBSOCKET LOAD TEST                                       │"
  echo "└──────────────────────────────────────────────────────────────┘"
  echo ""
  echo "  Connection success:   $(parse_k6_metric "$WS_FILE" "ws_connect_success" "rate")"
  echo "  Connect time p95:     $(parse_k6_metric "$WS_FILE" "ws_connect_time" "p95") ms"
  echo "  Bids sent:            $(count_status "$WS_FILE" "bids_sent")"
  echo "  Bids accepted:        $(count_status "$WS_FILE" "bids_accepted")"
  echo "  Bids rejected:        $(count_status "$WS_FILE" "bids_rejected")"
  echo "  Bid RTT p95:          $(parse_k6_metric "$WS_FILE" "bid_round_trip_ms" "p95") ms"
  echo "  Bid RTT p99:          $(parse_k6_metric "$WS_FILE" "bid_round_trip_ms" "p99") ms"
  echo "  WS errors:            $(count_status "$WS_FILE" "ws_errors")"
  echo "  Messages received:    $(count_status "$WS_FILE" "messages_received")"
  echo ""
else
  echo "┌──────────────────────────────────────────────────────────────┐"
  echo "│ 3. WEBSOCKET LOAD TEST — No results found                    │"
  echo "│    Run: k6 run --out json=${WS_FILE}                         │"
  echo "│         load-tests/k6-ws-load.js                             │"
  echo "└──────────────────────────────────────────────────────────────┘"
  echo ""
fi

# ── 4. Live Service Telemetry ──────────────────────────────────
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│ 4. LIVE SERVICE TELEMETRY (current snapshot)                   │"
echo "└──────────────────────────────────────────────────────────────┘"
echo ""

collect_telemetry "Auction Service" "http://localhost:3001/internal"
echo ""
collect_telemetry "Monolith"        "http://localhost:3000/internal"
echo ""

# ── 5. Summary ─────────────────────────────────────────────────
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│ 5. QUICK REFERENCE                                             │"
echo "└──────────────────────────────────────────────────────────────┘"
echo ""
echo "  Run benchmarks:"
echo "    # Start services in loadtest mode"
echo "    docker compose -f docker-compose.yml -f docker-compose.loadtest.yml up -d"
echo ""
echo "    # Capacity discovery (auto-aborts on degradation)"
echo "    k6 run --env TEST_TOKEN=\$TOKEN \\"
echo "      --env AUCTION_URL=http://localhost:3001/api/v1/auctions \\"
echo "      --env MONOLITH_URL=http://localhost:3000 \\"
echo "      --out json=${RESULTS_DIR}/capacity.json \\"
echo "      load-tests/k6-capacity-discovery.js"
echo ""
echo "    # HTTP load test"
echo "    k6 run --env TEST_TOKEN=\$TOKEN \\"
echo "      --env AUCTION_URL=http://localhost:3001/api/v1/auctions \\"
echo "      --env MONOLITH_URL=http://localhost:3000 \\"
echo "      --out json=${RESULTS_DIR}/http-load.json \\"
echo "      load-tests/k6-http-load.js"
echo ""
echo "    # WebSocket load test"
echo "    k6 run --env TEST_TOKEN=\$TOKEN \\"
echo "      --env WS_URL=ws://localhost:3001 \\"
echo "      --env AUCTION_ID=<uuid> \\"
echo "      --out json=${RESULTS_DIR}/ws-load.json \\"
echo "      load-tests/k6-ws-load.js"
echo ""
echo "    # Generate this report"
echo "    ./load-tests/generate-report.sh ${RESULTS_DIR}"
echo ""
echo "═══════════════════════════════════════════════════════════════"

} | tee "$REPORT_FILE"

echo ""
echo "Report saved to: ${REPORT_FILE}"
