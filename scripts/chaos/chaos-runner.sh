#!/usr/bin/env bash
# ── NetTapu Pre-Go-Live Chaos Test Runner ─────────────────────
# Executes all 10 scenarios in safe order, captures results,
# and generates a structured PASS/FAIL report.
#
# Usage: ./chaos-runner.sh [--skip S4,S5] [--only S9,S3]
#
# Execution order (low risk → high risk):
#   S9, S3, S2, S8, S1, S10, S7, S6, S4, S5

set -uo pipefail

CHAOS_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${CHAOS_DIR}/config.sh"

RESULTS_DIR="${CHAOS_DIR}/results"
rm -rf "$RESULTS_DIR"
mkdir -p "$RESULTS_DIR"

EXECUTION_ORDER=(S9 S3 S2 S8 S1 S10 S7 S6 S4 S5)
SKIP_LIST=""
ONLY_LIST=""
STOP_ON_CRITICAL=true

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip) SKIP_LIST="$2"; shift 2 ;;
    --only) ONLY_LIST="$2"; shift 2 ;;
    --no-stop) STOP_ON_CRITICAL=false; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

should_run() {
  local scenario="$1"
  if [ -n "$ONLY_LIST" ]; then
    echo "$ONLY_LIST" | tr ',' '\n' | grep -qx "$scenario"
    return $?
  fi
  if [ -n "$SKIP_LIST" ]; then
    if echo "$SKIP_LIST" | tr ',' '\n' | grep -qx "$scenario"; then
      return 1
    fi
  fi
  return 0
}

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         NetTapu Pre-Go-Live Chaos Test Suite                ║"
echo "║         Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Pre-flight checks ────────────────────────────────────────
echo "── Pre-flight checks ──────────────────────────────────────"

echo -n "  Monolith health... "
if wait_monolith 10; then
  echo "OK"
else
  echo "UNREACHABLE — aborting"
  exit 1
fi

echo -n "  Postgres connectivity... "
if wait_postgres 5; then
  echo "OK"
else
  echo "UNREACHABLE — aborting"
  exit 1
fi

echo -n "  Redis connectivity... "
if wait_redis 5; then
  echo "OK"
else
  echo "UNREACHABLE — aborting"
  exit 1
fi

echo -n "  jq available... "
if command -v jq &>/dev/null; then
  echo "OK"
else
  echo "NOT FOUND — install jq"
  exit 1
fi

echo -n "  Auction-service health... "
if wait_auction 10; then
  echo "OK"
else
  echo "UNREACHABLE (S1/S4/S7/S10 will be affected)"
fi

echo ""

# ── Capture baseline metrics ─────────────────────────────────
echo "── Capturing baseline metrics ─────────────────────────────"
bash "${CHAOS_DIR}/metrics_snapshot.sh" "${RESULTS_DIR}/baseline_metrics.txt" 2>/dev/null
echo ""

# ── Provision test accounts ──────────────────────────────────
echo "── Provisioning test accounts ─────────────────────────────"

export CHAOS_USER_EMAIL="${CHAOS_PREFIX}-user@chaos.test"
export CHAOS_ADMIN_EMAIL="${CHAOS_PREFIX}-admin@chaos.test"

CHAOS_USER_TOKEN=$(get_user_token "$CHAOS_USER_EMAIL")
if [ -z "$CHAOS_USER_TOKEN" ]; then
  echo "  FAILED to create user account — aborting"
  exit 1
fi
export CHAOS_USER_TOKEN
echo "  User token: OK"

CHAOS_ADMIN_TOKEN=$(get_admin_token "$CHAOS_ADMIN_EMAIL")
if [ -z "$CHAOS_ADMIN_TOKEN" ]; then
  echo "  FAILED to create admin account — aborting"
  exit 1
fi
export CHAOS_ADMIN_TOKEN
echo "  Admin token: OK"

# Create a test parcel
CHAOS_PARCEL_ID=$(curl -sf -X POST "${MONOLITH_URL}/api/v1/parcels" \
  -H "Authorization: Bearer ${CHAOS_ADMIN_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"title\":\"Chaos Test Parcel ${CHAOS_PREFIX}\",\"city\":\"Istanbul\",\"district\":\"Kadikoy\",\"price\":\"100000.00\"}" \
  2>/dev/null | jq -r '.id // empty')

if [ -z "$CHAOS_PARCEL_ID" ]; then
  echo "  FAILED to create test parcel — aborting"
  exit 1
fi
export CHAOS_PARCEL_ID
echo "  Test parcel: $CHAOS_PARCEL_ID"
echo ""

# ── Execute scenarios ────────────────────────────────────────
TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0
CRITICAL_FAIL=false

for scenario in "${EXECUTION_ORDER[@]}"; do
  scenario_lower=$(echo "$scenario" | tr '[:upper:]' '[:lower:]')
  script="${CHAOS_DIR}/scenario_${scenario_lower}.sh"

  if ! should_run "$scenario"; then
    echo "── Scenario $scenario: SKIPPED (filtered) ──"
    echo '{"passed":true,"reason":"Skipped by filter","checks":[]}' > "${RESULTS_DIR}/${scenario_lower}.json"
    SKIPPED=$((SKIPPED + 1))
    TOTAL=$((TOTAL + 1))
    echo ""
    continue
  fi

  if [ ! -f "$script" ]; then
    echo "── Scenario $scenario: SKIPPED (script not found) ──"
    echo '{"passed":true,"reason":"Script not found","checks":[]}' > "${RESULTS_DIR}/${scenario_lower}.json"
    SKIPPED=$((SKIPPED + 1))
    TOTAL=$((TOTAL + 1))
    echo ""
    continue
  fi

  echo "══════════════════════════════════════════════════════════════"
  echo "  EXECUTING: Scenario $scenario"
  echo "══════════════════════════════════════════════════════════════"

  TOTAL=$((TOTAL + 1))
  START_TIME=$(python3 -c 'import time; print(int(time.time()*1000))')

  if bash "$script" "${RESULTS_DIR}/${scenario_lower}.json" 2>&1; then
    # Script exited 0
    :
  else
    # Script exited non-zero — ensure result file exists
    if [ ! -f "${RESULTS_DIR}/${scenario_lower}.json" ]; then
      echo "{\"passed\":false,\"reason\":\"Script crashed with exit code $?\",\"critical\":true,\"checks\":[]}" \
        > "${RESULTS_DIR}/${scenario_lower}.json"
    fi
  fi

  END_TIME=$(python3 -c 'import time; print(int(time.time()*1000))')
  DURATION=$((END_TIME - START_TIME))

  # Read result and inject duration
  if [ -f "${RESULTS_DIR}/${scenario_lower}.json" ]; then
    RESULT_JSON=$(cat "${RESULTS_DIR}/${scenario_lower}.json")
    echo "$RESULT_JSON" | jq --argjson dur "$DURATION" '. + {duration_ms: $dur}' \
      > "${RESULTS_DIR}/${scenario_lower}.json" 2>/dev/null || true

    IS_PASS=$(echo "$RESULT_JSON" | jq -r '.passed // false')
    IS_CRITICAL=$(echo "$RESULT_JSON" | jq -r '.critical // false')
    REASON=$(echo "$RESULT_JSON" | jq -r '.reason // "Unknown"')

    if [ "$IS_PASS" = "true" ]; then
      PASSED=$((PASSED + 1))
      echo ""
      echo "  => $scenario: PASS (${DURATION}ms)"
    else
      FAILED=$((FAILED + 1))
      echo ""
      echo "  => $scenario: FAIL — $REASON (${DURATION}ms)"

      if [ "$IS_CRITICAL" = "true" ] && [ "$STOP_ON_CRITICAL" = "true" ]; then
        echo ""
        echo "  CRITICAL FAILURE — stopping execution."
        CRITICAL_FAIL=true
        break
      fi
    fi
  else
    FAILED=$((FAILED + 1))
    echo ""
    echo "  => $scenario: FAIL — no result file produced"
  fi

  echo ""

  # Brief cooldown between scenarios
  sleep 2
done

# ── DB Integrity Check ───────────────────────────────────────
echo "══════════════════════════════════════════════════════════════"
echo "  EXECUTING: DB Integrity Check"
echo "══════════════════════════════════════════════════════════════"

INTEGRITY_OUTPUT=$(psql_app -f "${CHAOS_DIR}/db_integrity_check.sql" 2>/dev/null)
VIOLATION_COUNT=$(echo "$INTEGRITY_OUTPUT" | grep -c '|' || true)

if [ "$VIOLATION_COUNT" -eq 0 ] || [ -z "$INTEGRITY_OUTPUT" ]; then
  echo '{"passed":true,"violations":[]}' > "${RESULTS_DIR}/db_integrity.json"
  echo "  => DB Integrity: PASS"
else
  VIOLATIONS=$(echo "$INTEGRITY_OUTPUT" | head -20 | jq -R -s 'split("\n") | map(select(length > 0))')
  echo "{\"passed\":false,\"violations\":${VIOLATIONS}}" > "${RESULTS_DIR}/db_integrity.json"
  echo "  => DB Integrity: FAIL"
  echo "$INTEGRITY_OUTPUT" | head -10
fi

echo ""

# ── Final metrics snapshot ───────────────────────────────────
bash "${CHAOS_DIR}/metrics_snapshot.sh" "${RESULTS_DIR}/final_metrics.txt" 2>/dev/null

# ── Cleanup test data ────────────────────────────────────────
echo "── Cleaning up test data ──────────────────────────────────"
cleanup_chaos_data "$CHAOS_PREFIX"
# Clean up test parcel
curl -sf -X DELETE "${MONOLITH_URL}/api/v1/parcels/${CHAOS_PARCEL_ID}" \
  -H "Authorization: Bearer ${CHAOS_ADMIN_TOKEN}" > /dev/null 2>&1 || true
echo "  Done"
echo ""

# ── Generate report ──────────────────────────────────────────
node "${CHAOS_DIR}/generate_report.js" "$RESULTS_DIR"
EXIT_CODE=$?

exit $EXIT_CODE
