// ── calc.js — Pure financial calculations ──
// All functions are pure: same inputs always produce same outputs.
// No DOM references. Safe to unit-test independently.
// Depends on: data.js (SHILLER, SHILLER_BONDS, CASH_REAL, SY)

// ── Formatters ──

/** Format as compact dollar amount: $X.XXM or $Xk */
function fmtM(v) {
  if (v >= 1e6)  return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1000) return '$' + (v / 1000).toFixed(0) + 'k';
  return '$' + Math.round(v).toLocaleString();
}

/** Short format for chart labels */
function fmtMs(v) {
  if (v >= 1e6)  return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1000) return '$' + (v / 1000).toFixed(0) + 'k';
  return '$' + Math.round(v).toLocaleString();
}

/** Full integer format for sequence explorer detail */
function fmtFull(v) {
  return '$' + Math.round(v).toLocaleString();
}

/** Parse a currency string like "$1,234,567" → 1234567 */
function pm(s) {
  return parseFloat(String(s).replace(/[$,]/g, '')) || 0;
}

/** Escape user-supplied strings before inserting into HTML */
function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

// ── Accumulation ──

/**
 * Portfolio value at a single future age.
 * @param {number} rate      - Annual real return (e.g. 0.07)
 * @param {number} contrib   - Annual contribution in today's dollars
 * @param {number} startAge  - Current age
 * @param {number} contribUntil - Age to stop contributing
 * @param {number} startVal  - Starting portfolio value
 * @param {number} toAge     - Target age
 * @returns {number} Portfolio value (rounded)
 */
function calcAt(rate, contrib, startAge, contribUntil, startVal, toAge) {
  let v = startVal;
  for (let a = startAge; a < toAge; a++) {
    v = v * (1 + rate) + (a < contribUntil ? contrib : 0);
  }
  return Math.round(v);
}

/**
 * Portfolio value series from xMin to xMax age.
 * @returns {number[]} Array of rounded portfolio values, one per age
 */
function calcSeries(rate, contrib, startAge, contribUntil, startVal, xMin, xMax) {
  let v = startVal;
  for (let a = startAge; a < xMin; a++) {
    v = v * (1 + rate) + (a < contribUntil ? contrib : 0);
  }
  return Array.from({ length: xMax - xMin + 1 }, (_, i) => {
    if (i > 0) v = v * (1 + rate) + ((xMin + i - 1) < contribUntil ? contrib : 0);
    return Math.round(v);
  });
}

/**
 * Historical accumulation simulation across all Shiller windows.
 * @returns {{ results, p10, p25, p50, p75, p90, best, worst }}
 */
function histAccum(startVal, contrib, contribUntil, startAge, years, feesRate) {
  const results = [];
  const max = SHILLER.length - years;
  for (let s = 0; s <= max; s++) {
    let v = startVal;
    for (let y = 0; y < years; y++) {
      v = v * (1 + SHILLER[s + y] - feesRate) + ((startAge + y) < contribUntil ? contrib : 0);
    }
    results.push({ yr: SY + s, val: Math.round(v) });
  }
  const sorted = [...results].map(r => r.val).sort((a, b) => a - b);
  const pct = p => sorted[Math.floor(sorted.length * p)];
  return {
    results,
    p10: pct(0.10), p25: pct(0.25), p50: pct(0.50),
    p75: pct(0.75), p90: pct(0.90),
    best:  results.reduce((a, b) => a.val > b.val ? a : b),
    worst: results.reduce((a, b) => a.val < b.val ? a : b),
  };
}

// ── Withdrawal ──

/**
 * Blended real return for a given year index and allocation.
 * @param {number} y       - Index into SHILLER / SHILLER_BONDS arrays
 * @param {number} stkPct  - Stocks weight (0–1)
 * @param {number} bndPct  - Bonds weight (0–1)
 * @param {number} cshPct  - Cash weight (0–1)
 * @returns {number} Blended real return
 */
function blendReturn(y, stkPct, bndPct, cshPct) {
  return stkPct * SHILLER[y] + bndPct * SHILLER_BONDS[y] + cshPct * CASH_REAL;
}

/**
 * Historical withdrawal simulation across all valid Shiller windows.
 *
 * @param {number}   portAtRetire  - Portfolio value at retirement
 * @param {number}   spend         - Annual gross spend (pre-tax)
 * @param {number}   retireAge     - Age at retirement
 * @param {number}   planUntil     - Age to simulate until
 * @param {Array}    events        - One-time events: [{age, amount}]
 * @param {number}   ssIncome      - Annual Social Security income
 * @param {number}   ssAge         - Age SS begins
 * @param {number}   feesRate      - Annual fee rate (e.g. 0.005)
 * @param {number}   stkPct        - Stocks allocation (0–1)
 * @param {number}   bndPct        - Bonds allocation (0–1)
 * @param {number}   cshPct        - Cash allocation (0–1)
 * @param {boolean}  rebal         - Rebalance annually to target weights
 *
 * @returns {{ results, ns, total, pct, p10, p50, p90, worst, notable }}
 */
function histWithdraw(
  portAtRetire, spend, retireAge, planUntil,
  events, ssIncome, ssAge, feesRate,
  stkPct = 1, bndPct = 0, cshPct = 0, rebal = false
) {
  const wdYears = planUntil - retireAge;
  const results = [];
  const max = SHILLER.length - wdYears;

  for (let s = 0; s <= max; s++) {
    let v = portAtRetire;
    let dep = null;
    let curS = stkPct, curB = bndPct, curC = cshPct;
    const wdSeries = [portAtRetire];

    for (let y = 0; y < wdYears; y++) {
      const age = retireAge + y;
      const ss  = (ssIncome > 0 && age >= ssAge) ? ssIncome : 0;
      const evt = events
        .filter(e => e.age === age)
        .reduce((sum, e) => sum + e.amount, 0);

      const ret = curS * SHILLER[s + y]
                + curB * SHILLER_BONDS[s + y]
                + curC * CASH_REAL
                - feesRate;

      v = v * (1 + ret) - Math.max(0, spend - ss) - evt;
      if (v <= 0 && !dep) { dep = y + 1; v = 0; }
      wdSeries.push(Math.round(Math.max(0, v)));

      if (rebal) {
        curS = stkPct; curB = bndPct; curC = cshPct;
      } else {
        const sV = curS * (1 + SHILLER[s + y]);
        const bV = curB * (1 + SHILLER_BONDS[s + y]);
        const cV = curC * (1 + CASH_REAL);
        const tot = sV + bV + cV;
        if (tot > 0) { curS = sV / tot; curB = bV / tot; curC = cV / tot; }
      }
    }
    results.push({
      yr: SY + s, survived: !dep,
      val: Math.round(Math.max(0, v)),
      dep, portAtRetire, wdSeries,
    });
  }

  const ns = results.filter(r => r.survived).length;
  const sorted = results.map(r => r.val).sort((a, b) => a - b);
  const pct = p => sorted[Math.floor(sorted.length * p)];
  const notable = [1929, 1966, 2000, 1937]
    .map(yr => ({ yr, r: results.find(r => r.yr === yr) }))
    .filter(x => x.r);

  return {
    results, ns,
    total: results.length,
    pct: (ns / results.length * 100).toFixed(1),
    p10: pct(0.10), p50: pct(0.50), p90: pct(0.90),
    worst: results.reduce((a, b) => a.val < b.val ? a : b),
    notable,
  };
}

// ── Monte Carlo ──

/** Box-Muller normal random variate */
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Monte Carlo accumulation simulation.
 * @param {number} baseRate - Expected annual real return
 * @param {number} N        - Number of simulations (default 500)
 * @returns {{ p10, p50, p90 }} Percentile series arrays
 */
function runMonteCarlo(baseRate, contrib, startAge, contribUntil, startVal, xMin, xMax, N = 500) {
  const len = xMax - xMin + 1;
  const results = [];

  for (let n = 0; n < N; n++) {
    let v = startVal;
    for (let a = startAge; a < xMin; a++) {
      const r = baseRate + randn() * BEAR_SD / 100;
      v = v * (1 + r) + (a < contribUntil ? contrib : 0);
    }
    const series = Array.from({ length: len }, (_, i) => {
      if (i > 0) {
        const r = baseRate + randn() * BEAR_SD / 100;
        v = v * (1 + r) + ((xMin + i - 1) < contribUntil ? contrib : 0);
      }
      return Math.round(v);
    });
    results.push(series);
  }

  const p10 = [], p50 = [], p90 = [];
  for (let i = 0; i < len; i++) {
    const vals = results.map(r => r[i]).sort((a, b) => a - b);
    p10.push(vals[Math.floor(N * 0.10)]);
    p50.push(vals[Math.floor(N * 0.50)]);
    p90.push(vals[Math.floor(N * 0.90)]);
  }
  return { p10, p50, p90 };
}
