// ── state.js — Shared mutable application state ──
// Single source of truth for runtime state.
// Charts and app.js read from this object instead of closing over local vars.

const State = {
  // Tab
  currentTab: 'accumulation',
  accumMode:  'simple',

  // Chart instances (Chart.js objects, replaced on each upd())
  accumChart:    null,
  advAccumChart: null,
  advWdChart:    null,
  sorrChart:     null,

  // SORR sequence explorer
  sorrSelectedIdx: -1,
  sorrExplorerCtx: null, // { h, retireAge, planUntil, annualSpend, taxRate, portBase, stkPct, bndPct, cshPct }

  // Withdrawal delta indicator
  prevSurvPct: null,

  // SORR pulse hint (shown once per session)
  sorrPulseShown: false,

  // Target override
  targetManual: false,

  // One-time events (user-entered withdrawals/windfalls)
  oneTimeEvents: [],
};
