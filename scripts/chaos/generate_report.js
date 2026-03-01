#!/usr/bin/env node
/**
 * Chaos Test Report Generator
 *
 * Reads individual scenario result files from results/ directory
 * and produces a structured PASS/FAIL summary.
 *
 * Usage: node generate_report.js <results_dir>
 */

const fs = require('fs');
const path = require('path');

const resultsDir = process.argv[2] || path.join(__dirname, 'results');

if (!fs.existsSync(resultsDir)) {
  console.error(`Results directory not found: ${resultsDir}`);
  process.exit(1);
}

const SCENARIO_ORDER = ['S9', 'S3', 'S2', 'S8', 'S1', 'S10', 'S7', 'S6', 'S4', 'S5'];
const SCENARIO_NAMES = {
  S1: 'Concurrency Stress (bidding + payments)',
  S2: '3DS Timeout Edge Cases',
  S3: 'Callback Duplication & Replay',
  S4: 'Redis Restart Mid-Auction',
  S5: 'Postgres Restart Mid-Transaction',
  S6: 'Reconciliation Worker Crash',
  S7: 'Circuit Breaker Open',
  S8: 'DB Pool Exhaustion',
  S9: 'Slow POS Provider (timeout)',
  S10: 'Large WebSocket Load (2k+)',
};

const results = [];
let hasFailure = false;
let hasCriticalFailure = false;

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║          NetTapu Pre-Go-Live Chaos Test Report              ║');
console.log('║          ' + new Date().toISOString().slice(0, 19) + '                            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

for (const scenario of SCENARIO_ORDER) {
  const resultFile = path.join(resultsDir, `${scenario.toLowerCase()}.json`);

  if (!fs.existsSync(resultFile)) {
    console.log(`SCENARIO ${scenario}: SKIPPED`);
    console.log(`  ${SCENARIO_NAMES[scenario]}`);
    console.log(`  Reason: Result file not found (${scenario.toLowerCase()}.json)`);
    console.log('');
    results.push({ scenario, name: SCENARIO_NAMES[scenario], status: 'SKIPPED', reason: 'Not executed' });
    continue;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(resultFile, 'utf-8'));
  } catch (e) {
    console.log(`SCENARIO ${scenario}: ERROR`);
    console.log(`  ${SCENARIO_NAMES[scenario]}`);
    console.log(`  Reason: Invalid result file — ${e.message}`);
    console.log('');
    results.push({ scenario, name: SCENARIO_NAMES[scenario], status: 'ERROR', reason: 'Invalid result file' });
    hasFailure = true;
    continue;
  }

  const status = data.passed ? 'PASS' : 'FAIL';
  const isCritical = data.critical === true;

  if (!data.passed) {
    hasFailure = true;
    if (isCritical) hasCriticalFailure = true;
  }

  console.log(`SCENARIO ${scenario}: ${status}`);
  console.log(`  ${SCENARIO_NAMES[scenario]}`);
  console.log(`  Reason: ${data.reason || 'No reason provided'}`);

  if (data.checks && data.checks.length > 0) {
    for (const check of data.checks) {
      const mark = check.passed ? '  ✓' : '  ✗';
      console.log(`${mark} ${check.name}: ${check.detail || ''}`);
    }
  }

  if (data.duration_ms) {
    console.log(`  Duration: ${(data.duration_ms / 1000).toFixed(1)}s`);
  }

  console.log('');
  results.push({
    scenario,
    name: SCENARIO_NAMES[scenario],
    status,
    reason: data.reason,
    critical: isCritical,
    duration_ms: data.duration_ms,
    checks: data.checks,
  });
}

// ── DB Integrity Check ──────────────────────────────────────
const integrityFile = path.join(resultsDir, 'db_integrity.json');
if (fs.existsSync(integrityFile)) {
  let integrity;
  try {
    integrity = JSON.parse(fs.readFileSync(integrityFile, 'utf-8'));
  } catch {
    integrity = { passed: false, violations: ['Could not parse integrity results'] };
  }

  console.log('─── DB Integrity Check ───────────────────────────────────');
  if (integrity.passed) {
    console.log('  PASS: No integrity violations detected.');
  } else {
    console.log('  FAIL: Integrity violations found:');
    hasFailure = true;
    hasCriticalFailure = true;
    for (const v of (integrity.violations || [])) {
      console.log(`    ✗ ${v}`);
    }
  }
  console.log('');
}

// ── Final Verdict ───────────────────────────────────────────
console.log('══════════════════════════════════════════════════════════════');

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const skipped = results.filter(r => r.status === 'SKIPPED').length;
const errored = results.filter(r => r.status === 'ERROR').length;

console.log(`  Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}  Errored: ${errored}`);
console.log('');

if (!hasFailure && skipped === 0) {
  console.log('FINAL RESULT: PASS');
  console.log('  Safe for staged POS activation.');
} else if (hasCriticalFailure) {
  console.log('FINAL RESULT: FAIL — CRITICAL');
  console.log('  Do NOT activate real POS. Critical data integrity or recovery failures detected.');
} else if (hasFailure) {
  console.log('FINAL RESULT: FAIL');
  console.log('  Do NOT activate real POS until all failures are resolved.');
} else {
  console.log('FINAL RESULT: INCOMPLETE');
  console.log(`  ${skipped} scenario(s) were skipped. Run all scenarios before go-live.`);
}

console.log('══════════════════════════════════════════════════════════════');
console.log('');

// Write machine-readable summary
const summaryFile = path.join(resultsDir, 'summary.json');
fs.writeFileSync(summaryFile, JSON.stringify({
  timestamp: new Date().toISOString(),
  passed,
  failed,
  skipped,
  errored,
  go_live_safe: !hasFailure && skipped === 0,
  critical_failure: hasCriticalFailure,
  results,
}, null, 2));

process.exit(hasFailure ? 1 : 0);
