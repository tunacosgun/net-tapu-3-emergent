#!/usr/bin/env bash
# ── Metrics Snapshot ──────────────────────────────────────────
# Captures a point-in-time snapshot of all relevant metrics.
# Usage: ./metrics_snapshot.sh <output_file>

set -euo pipefail
source "$(dirname "$0")/config.sh"

OUTPUT="${1:?Usage: metrics_snapshot.sh <output_file>}"

{
  echo "# Snapshot at $(date -u +%Y-%m-%dT%H:%M:%SZ)"

  echo "# ── Monolith metrics ──"
  curl -sf "${MONOLITH_URL}/metrics" 2>/dev/null \
    | grep -E '^(nettapu_|process_resident_memory)' \
    | grep -v '^#' || echo "# monolith unreachable"

  echo "# ── Auction-service metrics ──"
  curl -sf "${AUCTION_URL}/metrics" 2>/dev/null \
    | grep -E '^(nettapu_|settlement_|bid_|ws_|db_pool|process_resident_memory)' \
    | grep -v '^#' || echo "# auction-service unreachable"

} > "$OUTPUT"

echo "Metrics snapshot saved to $OUTPUT"
