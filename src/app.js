// ── app.js — DOM wiring, application logic, event handlers ──
// Depends on: data.js, calc.js, state.js, charts.js
// Note: SC is defined in charts.js (loads before app.js)

// ── Allocation helpers ──

function getAlloc() {
  const s = parseInt(document.getElementById('allocS').value) || 0;
  const b = parseInt(document.getElementById('allocB').value) || 0;
  const c = parseInt(document.getElementById('allocC').value) || 0;
  return { s: s / 100, b: b / 100, c: c / 100, total: s + b + c, valid: s + b + c === 100 };
}

function toggleAlloc() {
  const panel   = document.getElementById('allocPanel');
  const chevron = document.getElementById('allocChevron');
  const open = panel.style.display === 'none';
  panel.style.display = open ? '' : 'none';
  chevron.style.transform = open ? 'rotate(180deg)' : '';
}

function clampAlloc(id) {
  const el = document.getElementById(id);
  el.value = Math.max(0, Math.min(100, parseInt(el.value) || 0));
}

function resetAlloc() {
  document.getElementById('allocS').value = 100;
  document.getElementById('allocB').value = 0;
  document.getElementById('allocC').value = 0;
  State.targetManual = false;
  updAlloc();
}

function updAlloc() {
  const s = Math.max(0, parseInt(document.getElementById('allocS').value) || 0);
  const b = Math.max(0, parseInt(document.getElementById('allocB').value) || 0);
  const c = Math.max(0, parseInt(document.getElementById('allocC').value) || 0);
  const total = s + b + c;
  const ok = total === 100;
  const sf = ok ? s : s / Math.max(total, 1) * 100;
  const bf = ok ? b : b / Math.max(total, 1) * 100;
  const cf = ok ? c : c / Math.max(total, 1) * 100;
  document.getElementById('allocBarS').style.width = sf + '%';
  document.getElementById('allocBarB').style.width = bf + '%';
  document.getElementById('allocBarC').style.width = cf + '%';
  const totalEl = document.getElementById('allocTotal');
  totalEl.textContent = total + '%' + (ok ? ' ✓' : ' — must equal 100');
  totalEl.style.color = ok ? 'var(--bull)' : '#E24B4A';
  document.getElementById('allocSummary').innerHTML =
    `<span style="color:#1D9E75;">S</span><span>${s}</span>` +
    `<span style="color:#3B9EFF;margin-left:3px;">B</span><span>${b}</span>` +
    `<span style="color:#4A5568;margin-left:3px;">C</span><span>${c}</span>`;
  const expEl  = document.getElementById('allocExpReturn');
  const card   = document.getElementById('allocReturnCard');
  if (ok) {
    const exp = ((s / 100) * AVG_EQUITY + (b / 100) * AVG_BONDS + (c / 100) * AVG_CASH) * 100;
    expEl.textContent = exp.toFixed(1) + '%';
    expEl.style.color = 'var(--bull)';
    card.style.opacity = '1';
  } else {
    expEl.textContent = '—'; card.style.opacity = '.4';
  }
  if (ok) upd();
}

// ── Accumulation mode toggle ──

function setAccumMode(mode) {
  State.accumMode = mode;
  document.getElementById('accumSimpleBtn').classList.toggle('active', mode === 'simple');
  document.getElementById('accumAdvBtn').classList.toggle('active', mode === 'advanced');
  document.getElementById('accumSimplePanel').style.display = mode === 'simple' ? '' : 'none';
  document.getElementById('accumAdvPanel').style.display    = mode === 'advanced' ? '' : 'none';
  document.getElementById('accumModeHint').textContent = mode === 'simple'
    ? '3 return scenarios' : 'Shiller historical 1871–2023';
  document.getElementById('rateRow').style.display = mode === 'advanced' ? 'none' : '';
  upd();
}

// ── One-time events ──

function addEvent() {
  const lbl = document.getElementById('evtLabel').value.trim();
  const age = parseInt(document.getElementById('evtAge').value);
  const amt = pm(document.getElementById('evtAmt').value);
  if (!lbl || !age || !amt) return;
  State.oneTimeEvents.push({ label: lbl, age, amount: amt });
  document.getElementById('evtLabel').value = '';
  document.getElementById('evtAge').value = '';
  document.getElementById('evtAmt').value = '';
  renderEvents(); upd();
}

function removeEvent(i) {
  State.oneTimeEvents.splice(i, 1);
  renderEvents(); upd();
}

function renderEvents() {
  document.getElementById('eventList').innerHTML = State.oneTimeEvents.map((e, i) =>
    `<div class="evt-row">
      <span style="flex:1;font-size:10px;">${esc(e.label)} &nbsp;·&nbsp; age ${e.age} &nbsp;·&nbsp; ${fmtM(e.amount)}</span>
      <button onclick="removeEvent(${i})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;">✕</button>
    </div>`
  ).join('');
}

function fmtEvt(el) {
  const v = pm(el.value);
  if (v > 0) el.value = '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// ── Currency formatting helpers ──

function fmt(el) {
  const v = pm(el.value);
  if (v > 0) el.value = '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// ── Permalink ──

// ── Permalink — compact fixed-order array encoding ──
// Values stored as raw numbers in a fixed position array.
// No key names, no currency symbols/commas → much shorter URLs.
// Order must never change (append new fields at end for backwards compat).
//
// Positions: [startVal, contrib, baseRate, ageNow, ageCoast, ageRetire, ageEnd,
//             spendSlider, taxRate, allocS, allocB, allocC, feesSlider,
//             ssIncome, ssAge, tab(0=accum/1=wd), mcToggle, feesToggle,
//             rebalToggle, ssToggle, targetManual, wdPortOverride]
// One-time events appended as trailing array.

const SHARE_FIELDS = [
  { id: 'startVal',      read: el => pm(el.value),                  write: (el, v) => { el.value = v; fmt(el); } },
  { id: 'contrib',       read: el => pm(el.value),                  write: (el, v) => { el.value = v; fmt(el); } },
  { id: 'baseRate',      read: el => parseFloat(el.value),          write: (el, v) => { el.value = v; } },
  { id: 'ageNow',        read: el => parseInt(el.value),            write: (el, v) => { el.value = v; } },
  { id: 'ageCoast',      read: el => parseInt(el.value),            write: (el, v) => { el.value = v; } },
  { id: 'ageRetire',     read: el => parseInt(el.value),            write: (el, v) => { el.value = v; } },
  { id: 'ageEnd',        read: el => parseInt(el.value),            write: (el, v) => { el.value = v; } },
  { id: 'spendSlider',   read: el => parseInt(el.value),            write: (el, v) => { el.value = v; } },
  { id: 'taxRate',       read: el => parseInt(el.value),            write: (el, v) => { el.value = v; } },
  { id: 'allocS',        read: el => parseInt(el.value),            write: (el, v) => { el.value = v; } },
  { id: 'allocB',        read: el => parseInt(el.value),            write: (el, v) => { el.value = v; } },
  { id: 'allocC',        read: el => parseInt(el.value),            write: (el, v) => { el.value = v; } },
  { id: 'feesSlider',    read: el => parseFloat(el.value),          write: (el, v) => { el.value = v; } },
  { id: 'ssIncome',      read: el => pm(el.value),                  write: (el, v) => { el.value = v; if(v) fmt(el); } },
  { id: 'ssAge',         read: el => parseInt(el.value),            write: (el, v) => { el.value = v; } },
  { id: 'wdPortOverride',read: el => pm(el.value),                  write: (el, v) => { el.value = v; if(v) fmt(el); } },
];

// Boolean flags stored as a single bitmask (position 16)
// bit 0 = currentTab (0=accum, 1=wd)
// bit 1 = mcToggle
// bit 2 = feesToggle
// bit 3 = rebalToggle
// bit 4 = ssToggle
// bit 5 = targetManual

const SHARE_DEFAULTS_ARR = [1000000,25000,7,38,55,55,85,80000,0,100,0,0,0.1,0,67,0];

function shareScenario() {
  // Build values array
  const vals = SHARE_FIELDS.map(f => {
    const el = document.getElementById(f.id);
    return el ? f.read(el) : 0;
  });

  // Build bitmask
  let flags = 0;
  if (State.currentTab === 'withdrawal')                          flags |= 1;
  if (document.getElementById('mcToggle').checked)               flags |= 2;
  if (document.getElementById('feesToggle').checked)             flags |= 4;
  if (document.getElementById('rebalToggle').checked)            flags |= 8;
  if (document.getElementById('ssToggle').checked)               flags |= 16;
  if (State.targetManual)                                        flags |= 32;

  // Drop trailing defaults to keep array short
  let arr = [...vals, flags];
  while (arr.length > 1 && arr[arr.length - 1] === (SHARE_DEFAULTS_ARR[arr.length - 1] ?? 0)) {
    arr.pop();
  }

  // Append one-time events if any
  const payload = State.oneTimeEvents.length
    ? { v: arr, e: State.oneTimeEvents.map(e => [e.age, e.amount, e.label]) }
    : arr;

  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const url = location.href.split('#')[0] + '#' + encoded;

  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('shareBtn');
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  }).catch(() => { prompt('Copy this link:', url); });
}

function loadFromHash() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  try {
    const raw = JSON.parse(decodeURIComponent(escape(atob(hash))));

    // Support both new compact array format and legacy key-value format
    let arr, events = [];
    if (Array.isArray(raw)) {
      arr = raw;
    } else if (raw.v) {
      arr = raw.v;
      events = (raw.e || []).map(([age, amount, label]) => ({ age, amount, label }));
    } else {
      // Legacy format — fall through to old key restore (backwards compat)
      _loadLegacyHash(raw); return;
    }

    // Restore field values
    SHARE_FIELDS.forEach((f, i) => {
      if (arr[i] === undefined) return;
      const el = document.getElementById(f.id);
      if (el) f.write(el, arr[i]);
    });

    // Restore bitmask flags
    const flags = arr[SHARE_FIELDS.length] || 0;
    document.getElementById('mcToggle').checked      = !!(flags & 2);
    document.getElementById('feesToggle').checked    = !!(flags & 4);
    document.getElementById('rebalToggle').checked   = !!(flags & 8);
    document.getElementById('ssToggle').checked      = !!(flags & 16);
    State.targetManual                               = !!(flags & 32);

    // Restore events
    if (events.length) { State.oneTimeEvents = events; renderEvents(); }

    updAlloc();
    const isWd = !!(flags & 1);
    if (isWd) switchTab('withdrawal');
    else upd();

  } catch (e) { /* invalid hash — ignore */ }
}

// Backwards compatibility with old key-value hash format
function _loadLegacyHash(compact) {
  const legacyMap = {
    sv:'startVal',co:'contrib',br:'baseRate',ti:'targetInput',an:'ageNow',
    ac:'ageCoast',ar:'ageRetire',ae:'ageEnd',mc:'mcToggle',ft:'feesToggle',
    fs:'feesSlider',wo:'wdPortOverride',as:'allocS',ab:'allocB',acl:'allocC',
    rb:'rebalToggle',sp:'spendSlider',tr:'taxRate',ss:'ssToggle',si:'ssIncome',sa:'ssAge',
  };
  Object.entries(legacyMap).forEach(([short, id]) => {
    if (compact[short] === undefined) return;
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = compact[short];
    else el.value = compact[short];
  });
  if (compact.ev) { State.oneTimeEvents = compact.ev; renderEvents(); }
  if (compact.tm) State.targetManual = true;
  ['startVal','contrib','wdPortOverride','ssIncome'].forEach(id => {
    const el = document.getElementById(id); if (el && el.value) fmt(el);
  });
  updAlloc();
  if (compact.tb) switchTab(compact.tb); else upd();
}

// ── Goal bar (25× spend target vs projected) ──

function renderGoalBar(projectedPort, annualSpend, retireAge) {
  const el = document.getElementById('goalBar');
  if (!el) return;
  if (annualSpend <= 0) { el.innerHTML = ''; return; }
  const target   = State.targetManual
    ? pm(document.getElementById('targetInput').value) || annualSpend * 25
    : annualSpend * 25;
  const pct      = Math.min(100, (projectedPort / target) * 100);
  const onTrack  = projectedPort >= target;
  const overPct  = onTrack  ? ((projectedPort / target - 1) * 100).toFixed(0) : null;
  const underAmt = !onTrack ? fmtM(target - projectedPort) : null;
  el.innerHTML = `
    <div style="background:rgba(255,255,255,0.03);border:1px solid ${onTrack ? 'rgba(29,158,117,0.25)' : 'rgba(251,146,60,0.25)'};border-radius:9px;padding:10px 14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">
        <div style="font-size:10px;color:var(--muted);">
          <span style="color:${onTrack ? '#1D9E75' : '#FB923C'};font-weight:600;">25× target</span>
          &nbsp;${fmtM(target)} needed at age ${retireAge}
        </div>
        <div style="font-size:10px;font-weight:600;color:${onTrack ? '#1D9E75' : '#FB923C'};">
          ${onTrack ? '✓ on track · +' + overPct + '% above target' : '✗ ' + underAmt + ' short'}
        </div>
      </div>
      <div style="position:relative;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${onTrack ? '#1D9E75' : '#FB923C'};border-radius:3px;transition:width .3s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;">
        <span style="font-size:9px;color:var(--muted);">$0</span>
        <span style="font-size:9px;color:var(--muted);">Projected: ${fmtM(projectedPort)}</span>
        <span style="font-size:9px;color:var(--muted);">Target: ${fmtM(target)}</span>
      </div>
    </div>`;
}

// ── Tab switching ──

function switchTab(tab) {
  State.currentTab = tab;
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', ['accumulation', 'withdrawal'][i] === tab));
  const isWd = tab === 'withdrawal';

  document.getElementById('wdrawOnlyPanel').style.display      = isWd ? 'flex' : 'none';
  document.getElementById('wdrawOnlyPanel').style.flexDirection = 'column';
  document.getElementById('accumChartPanel').style.display     = isWd ? 'none' : 'block';
  document.getElementById('wdrawRight').style.display          = isWd ? 'flex' : 'none';
  document.getElementById('rateRow').style.display             = isWd ? 'none' : '';

  // Hide accumulation-only inputs on withdrawal tab
  ['fieldContrib', 'divContrib', 'fieldTarget', 'rowMC'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isWd ? 'none' : '';
  });

  // Rate slider hint
  const hint = document.getElementById('rateSliderHint');
  if (hint) hint.innerHTML = isWd
    ? '<span>1%</span><span style="color:#1D9E75;">sets your retirement portfolio ↑</span><span>12%</span>'
    : '<span>1%</span><span>after inflation · scenarios ±2%</span><span>12%</span>';

  // Open allocation panel by default on withdrawal tab
  if (isWd) {
    const ap = document.getElementById('allocPanel');
    const ac = document.getElementById('allocChevron');
    if (ap && ap.style.display === 'none') {
      ap.style.display = '';
      if (ac) ac.style.transform = 'rotate(180deg)';
    }
  }

  State.prevSurvPct = null;
  upd();
}

// ── Sequence Explorer ──

function showSeqExplorer(idx) {
  if (!State.sorrExplorerCtx) return;
  const { h, retireAge, planUntil, annualSpend, taxRate, portBase, stkPct, bndPct, cshPct } = State.sorrExplorerCtx;
  const withdrawYears = planUntil - retireAge;
  const r = h.results[idx];
  if (!r) return;

  const yr       = r.yr;
  const series   = r.wdSeries;
  const survived = r.survived;
  const color    = survived ? '#1D9E75' : '#FB923C';

  // Rank
  const sortedByVal = [...h.results].sort((a, b) => a.val - b.val);
  const rank = sortedByVal.findIndex(x => x.yr === yr) + 1;
  const rankPct = Math.round((1 - rank / h.total) * 100);

  // Lowest balance + recovery
  let lowestVal = Infinity, lowestAge = retireAge;
  for (let i = 1; i < series.length; i++) {
    if (series[i] < lowestVal) { lowestVal = series[i]; lowestAge = retireAge + i; }
  }
  const lowestIdx = series.findIndex(v => v === lowestVal);
  let recoveredAge = null, recoveredVal = null;
  let highAfterLow = 0, highAfterLowAge = null;
  for (let i = lowestIdx + 1; i < series.length; i++) {
    if (series[i] > highAfterLow) { highAfterLow = series[i]; highAfterLowAge = retireAge + i; }
    if (series[i] > lowestVal * 2 && series[i] > portBase * 0.25) {
      recoveredAge = retireAge + i; recoveredVal = series[i]; break;
    }
  }

  // Best/worst blended return year
  let worstRet = 0, worstRetCalYr = yr, bestRet = -Infinity, bestRetCalYr = yr;
  const si = yr - SY;
  for (let y = 0; y < withdrawYears && (si + y) < SHILLER.length; y++) {
    const ret = blendReturn(si + y, stkPct || 1, bndPct || 0, cshPct || 0);
    if (ret < worstRet) { worstRet = ret; worstRetCalYr = SY + si + y; }
    if (ret > bestRet)  { bestRet  = ret; bestRetCalYr  = SY + si + y; }
  }

  const s100 = Math.round((stkPct || 1) * 100), b100 = Math.round((bndPct || 0) * 100);
  const mixLabel = b100 > 0 ? ` · ${s100}/${b100}` : ' · equity';

  const ctx = HIST_CONTEXT[yr] || '';

  const el = document.getElementById('wdSeqExplorer');
  el.style.display = 'block';
  el.innerHTML = `
    <div style="background:rgba(255,255,255,0.03);border:1px solid ${color}40;border-radius:12px;padding:16px 18px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
        <div>
          <div style="font-family:var(--fd);font-size:26px;font-weight:700;color:${color};">Retired ${yr}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">
            <span style="color:${color};font-weight:600;">${survived ? 'Survived ✓' : 'Depleted · yr ' + (r.dep || '?')}</span>
            &nbsp;·&nbsp; better than ${rankPct}% of sequences
          </div>
          ${ctx ? `<div style="margin-top:8px;padding:7px 12px;border-left:3px solid ${color};background:rgba(255,255,255,0.03);border-radius:0 6px 6px 0;font-size:11px;color:var(--text);opacity:.85;line-height:1.55;">${esc(ctx)}</div>` : ''}
        </div>
        <button onclick="clearSeqExplorer()" style="background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:6px;color:var(--muted);font-size:11px;padding:4px 10px;cursor:pointer;flex-shrink:0;">✕ Close</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">Started with</div>
          <div style="font-size:13px;font-weight:600;">${fmtFull(portBase)}</div>
        </div>
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">${survived ? 'Final estate' : 'Depleted after'}</div>
          <div style="font-size:13px;font-weight:600;color:${color};">${survived ? fmtFull(r.val) : (r.dep || '?') + ' years'}</div>
        </div>
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">${survived ? 'Extra runway' : 'Yrs lasted'}</div>
          <div style="font-size:13px;font-weight:600;color:${color};">${survived ? '+' + (withdrawYears - (r.dep || withdrawYears)) + ' yrs' : (r.dep || 0) + ' / ' + withdrawYears + ' yrs'}</div>
        </div>
      </div>
      ${lowestVal < portBase ? `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">Lowest balance</div>
          <div style="font-size:13px;font-weight:600;color:#FB923C;">${fmtFull(lowestVal)}</div>
          <div style="font-size:9px;color:var(--muted);margin-top:1px;">age ${lowestAge}</div>
        </div>
        ${recoveredAge
          ? `<div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
               <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">Recovered to</div>
               <div style="font-size:13px;font-weight:600;color:#1D9E75;">${fmtFull(recoveredVal)}</div>
               <div style="font-size:9px;color:var(--muted);margin-top:1px;">by age ${recoveredAge}</div>
             </div>`
          : `<div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
               <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">Best after low</div>
               <div style="font-size:13px;font-weight:600;color:var(--muted);">${highAfterLowAge ? fmtFull(highAfterLow) : '—'}</div>
               ${highAfterLowAge ? `<div style="font-size:9px;color:var(--muted);margin-top:1px;">age ${highAfterLowAge}</div>` : ''}
             </div>`}
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">${'Best yr' + mixLabel}</div>
          <div style="font-size:13px;font-weight:600;color:#1D9E75;">${(bestRet * 100).toFixed(1)}%</div>
          <div style="font-size:9px;color:var(--muted);margin-top:1px;">in ${bestRetCalYr}</div>
        </div>
      </div>` : `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">${'Best yr' + mixLabel}</div>
          <div style="font-size:13px;font-weight:600;color:#1D9E75;">${(bestRet * 100).toFixed(1)}%</div>
          <div style="font-size:9px;color:var(--muted);margin-top:1px;">in ${bestRetCalYr}</div>
        </div>
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">${'Worst yr' + mixLabel}</div>
          <div style="font-size:13px;font-weight:600;color:#FB923C;">${(worstRet * 100).toFixed(1)}%</div>
          <div style="font-size:9px;color:var(--muted);margin-top:1px;">in ${worstRetCalYr}</div>
        </div>
      </div>`}
    </div>`;
}

// ── Main update function ──

function upd() {
  try {
    _upd();
  } catch(e) {
    console.error('Sequra upd() error:', e.message, e.stack);
    // Show error visually for debugging
    const errEl = document.getElementById('accumChartPanel') || document.getElementById('wdrawRight');
    if (errEl) errEl.innerHTML = `<div style="color:#F87171;padding:20px;font-family:monospace;font-size:12px;">
      <strong>Debug error:</strong><br>${e.message}<br><pre>${e.stack}</pre></div>`;
  }
}

function _upd() {
  // ── Read inputs ──
  const startVal     = pm(document.getElementById('startVal').value);
  const contrib      = pm(document.getElementById('contrib').value);
  const baseRatePct  = parseFloat(document.getElementById('baseRate').value);
  const useMC        = document.getElementById('mcToggle').checked;
  const taxRate      = parseInt(document.getElementById('taxRate').value) / 100;
  const ssOn         = document.getElementById('ssToggle').checked;
  const ssIncome     = ssOn ? pm(document.getElementById('ssIncome').value) : 0;
  const ssAge        = ssOn ? (parseInt(document.getElementById('ssAge').value) || 67) : 999;
  const startAge     = parseInt(document.getElementById('ageNow').value)    || 0;
  const contribUntil = parseInt(document.getElementById('ageCoast').value)  || 0;
  const retireAge    = parseInt(document.getElementById('ageRetire').value) || 0;
  const planUntil    = parseInt(document.getElementById('ageEnd').value)    || 0;
  const feesOn       = document.getElementById('feesToggle').checked;
  const feesRate     = feesOn ? parseFloat(document.getElementById('feesSlider').value) / 100 : 0;
  const annualSpend  = parseInt(document.getElementById('spendSlider').value) || 80000;

  // Target — auto 25× spend unless manually overridden
  const targetInputEl   = document.getElementById('targetInput');
  const targetManualVal = pm(targetInputEl ? targetInputEl.value : '');
  if (!State.targetManual && annualSpend > 0 && targetInputEl) {
    const auto = annualSpend * 25;
    targetInputEl.value = '$' + auto.toLocaleString('en-US', { maximumFractionDigits: 0 });
    const hint = document.getElementById('targetHint');
    if (hint) hint.textContent = 'Auto · 25× spend = ' + fmtM(auto);
  }
  const target = (State.targetManual && targetManualVal > 0) ? targetManualVal : annualSpend * 25;

  // ── Guards ──
  if (!startAge || !retireAge || !planUntil || retireAge <= startAge) return;

  // ── spendDisp ──
  document.getElementById('spendDisp').innerHTML =
    `$${annualSpend.toLocaleString()} <span>/yr &nbsp;·&nbsp; $${Math.round(annualSpend / 12).toLocaleString()}/mo</span>`;

  // ── Fees label ──
  document.getElementById('feesPanel').style.display = feesOn ? '' : 'none';
  if (feesOn) document.getElementById('lblFees').textContent =
    (parseFloat(document.getElementById('feesSlider').value)).toFixed(2) + '%/yr';

  // ── WITHDRAWAL TAB ──
  if (State.currentTab === 'withdrawal') {
    if (planUntil <= retireAge) return;

    const portOverride = pm(document.getElementById('wdPortOverride').value);
    const portBase = portOverride > 0
      ? portOverride
      : calcAt(rates[1], effectiveContrib, startAge, contribUntil, startVal, retireAge);

    const alloc  = getAlloc();
    const stkPct = alloc.valid ? alloc.s : 1;
    const bndPct = alloc.valid ? alloc.b : 0;
    const cshPct = alloc.valid ? alloc.c : 0;
    const rebal  = document.getElementById('rebalToggle').checked;

    const h = histWithdraw(portBase, annualSpend, retireAge, planUntil,
      State.oneTimeEvents, ssIncome, ssAge, feesRate, stkPct, bndPct, cshPct, rebal);

    // ── Hero card ──
    const survPct  = parseFloat(h.pct);
    const survColor = survPct >= 80 ? 'var(--bull)' : survPct >= 50 ? '#F59E0B' : 'var(--warn)';
    const nDepleted = h.results.filter(r => !r.survived).length;
    const nSurvived = h.ns;

    // Delta indicator
    const delta = State.prevSurvPct !== null ? survPct - State.prevSurvPct : null;
    const deltaHtml = (delta !== null && Math.abs(delta) >= 0.5)
      ? `<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;padding:2px 8px;border-radius:12px;margin-left:8px;background:${delta > 0 ? 'rgba(29,158,117,0.15)' : 'rgba(251,146,60,0.15)'};color:${delta > 0 ? '#1D9E75' : '#FB923C'};">${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)}%</span>`
      : '';
    State.prevSurvPct = survPct;

    // Sort results by years survived for P10/P50/P90 cards
    const withdrawYears = planUntil - retireAge;
    const sortedByYears = [...h.results].sort((a, b) => {
      const aY = a.survived ? withdrawYears : (a.dep || 0);
      const bY = b.survived ? withdrawYears : (b.dep || 0);
      return aY !== bY ? aY - bY : a.val - b.val;
    });
    const pctResult = pct => sortedByYears[Math.max(0, Math.floor((pct / 100) * sortedByYears.length) - 1)];

    const CARDS = [
      { label: 'Rough sequence',    pct: 10, color: '#FB923C', border: 'rgba(251,146,60,0.3)',  bg: 'rgba(251,146,60,0.05)' },
      { label: 'Typical sequence',  pct: 50, color: '#1D9E75', border: 'rgba(29,158,117,0.3)',  bg: 'rgba(29,158,117,0.05)' },
      { label: 'Favorable sequence',pct: 90, color: '#3B9EFF', border: 'rgba(59,158,255,0.3)',  bg: 'rgba(59,158,255,0.05)' },
    ];

    document.getElementById('wdHero').innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;grid-column:1/-1;">
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
          <span style="font-family:var(--fd);font-size:42px;font-weight:700;line-height:1;color:${survColor};">${h.pct}%</span>
          <span style="font-size:12px;color:var(--muted);">made it to age ${planUntil}</span>
          ${deltaHtml}
        </div>
        <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;margin-bottom:10px;">
          <div style="height:100%;border-radius:3px;width:${h.pct}%;background:${survColor};transition:width .4s;"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:rgba(251,146,60,0.06);border:1px solid rgba(251,146,60,0.18);border-radius:8px;padding:10px 12px;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#FB923C;font-weight:600;margin-bottom:4px;">Ran out of money · ${nDepleted} sequences</div>
            ${nDepleted > 0 ? (() => {
              const depResults = h.results.filter(r => !r.survived);
              const depAges = depResults.map(r => retireAge + (r.dep || 0));
              return `<div style="font-size:10px;color:var(--muted);">Earliest age ${Math.min(...depAges)} · avg ${Math.round(depAges.reduce((a,b)=>a+b,0)/depAges.length)} · latest ${Math.max(...depAges)}</div>`;
            })() : '<div style="font-size:10px;color:var(--muted);">None depleted ✓</div>'}
          </div>
          <div style="background:rgba(29,158,117,0.06);border:1px solid rgba(29,158,117,0.18);border-radius:8px;padding:10px 12px;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#1D9E75;font-weight:600;margin-bottom:4px;">Survived · estate left · ${nSurvived} sequences</div>
            ${nSurvived > 0 ? (() => {
              const survResults = h.results.filter(r => r.survived);
              const estates = survResults.map(r => r.val).sort((a,b)=>a-b);
              const median = estates[Math.floor(estates.length/2)];
              return `<div style="font-size:10px;color:var(--muted);">Median ${fmtM(median)} · low ${fmtM(estates[0])} · high ${fmtM(estates[estates.length-1])}</div>`;
            })() : '<div style="font-size:10px;color:var(--muted);">None survived</div>'}
          </div>
        </div>
      </div>
      ${CARDS.map(c => {
        const r = pctResult(c.pct);
        const survived = r.survived;
        const runYears = survived ? withdrawYears : (r.dep || 0);
        const verdict  = survived ? `Past age ${planUntil} ✓` : `Runs out at ${retireAge + (r.dep || 0)}`;
        const sub      = survived ? 'money lasts your full plan' : `depleted after ${runYears} yrs`;
        return `<div style="border-radius:11px;padding:14px 15px;border:1px solid ${c.border};background:${c.bg};">
          <div style="font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${c.color};margin-bottom:8px;">${c.label}</div>
          <div style="font-family:var(--fd);font-size:22px;font-weight:700;line-height:1;color:${survived ? 'var(--bull)' : 'var(--warn)'};">${verdict}</div>
          <div style="font-size:10px;opacity:.6;margin-bottom:10px;">${sub}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;">
            <div style="background:rgba(0,0,0,.2);border-radius:6px;padding:5px 7px;">
              <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:1px;">At retirement${portOverride > 0 ? ' · manual' : ''}</div>
              <div style="font-size:11px;font-weight:500;color:${c.color};">${fmtM(portBase)}</div>
            </div>
            <div style="background:rgba(0,0,0,.2);border-radius:6px;padding:5px 7px;">
              <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:1px;">Years lasted</div>
              <div style="font-size:11px;font-weight:500;color:${survived ? 'var(--bull)' : 'var(--warn)'};">${runYears}${survived ? '+' : ''} yrs</div>
            </div>
            <div style="background:rgba(0,0,0,.2);border-radius:6px;padding:5px 7px;grid-column:1/-1;">
              <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:1px;">Take-home / yr · after tax</div>
              <div style="font-size:11px;font-weight:500;">${fmtM(Math.round(annualSpend * (1 - taxRate)))}</div>
            </div>
          </div>
        </div>`;
      }).join('')}`;

    // Fan chart
    const ages = Array.from({ length: withdrawYears + 1 }, (_, i) => retireAge + i);
    buildFanChart({ h, ages, portBase, rates, retireAge });

    // SORR chart
    document.getElementById('sorrTitle').innerHTML = `
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px;">
        Sequence of Returns Risk · by retirement start year
        <span class="tip" data-tip="Same portfolio, same spending — but retiring into a crash (1966, 2000) vs a bull market (1982) produces wildly different outcomes. Click any bar to explore that sequence.">?</span>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:10px;">
        <span style="color:rgba(29,158,117,0.8);">■</span> bars = years portfolio lasted &nbsp;·&nbsp;
        <span style="color:rgba(250,210,60,0.9);">─</span> line = final estate (survived only) · real $
      </div>`;

    const sorrAlloc = getAlloc();
    const sS = sorrAlloc.valid ? sorrAlloc.s : 1;
    const sB = sorrAlloc.valid ? sorrAlloc.b : 0;
    const sC = sorrAlloc.valid ? sorrAlloc.c : 0;
    State.sorrExplorerCtx = { h, retireAge, planUntil, annualSpend, taxRate, portBase, stkPct: sS, bndPct: sB, cshPct: sC };

    buildSorrChart({ h, withdrawYears, retireAge, onBarClick: showSeqExplorer });
    if (State.sorrSelectedIdx >= 0) showSeqExplorer(State.sorrSelectedIdx);

    // wdHistDetail (notable sequences note)
    const notableHtml = h.notable.map(({ yr, r }) =>
      `<span style="color:${r.survived ? '#1D9E75' : '#FB923C'};">${yr}</span>`).join(' · ');
    document.getElementById('wdHistDetail').innerHTML = h.notable.length
      ? `<div style="font-size:9px;color:var(--muted);">Notable: ${notableHtml}</div>`
      : '';
    return;
  }

  // ── ACCUMULATION TAB ──
  const chartLabels = Array.from({ length: xMax - xMin + 1 }, (_, i) => xMin + i);
  const retireIdx   = Math.max(0, Math.min(contribUntil - xMin, chartLabels.length - 1));
  const datasets = [], allVals = [];

  rates.forEach((r, idx) => {
    const s   = SC[idx];
    const raw = calcSeries(r, effectiveContrib, startAge, contribUntil, startVal, xMin, xMax);
    allVals.push(...raw);
    datasets.push({
      label: s.label + ' ' + (r * 100).toFixed(1) + '%',
      data: raw.map((v, i) => i <= retireIdx ? v : null),
      borderColor: s.color, backgroundColor: 'transparent',
      borderWidth: 2.5, pointRadius: 0, tension: 0.3, spanGaps: false,
    });
    datasets.push({
      label: '_c' + idx,
      data: raw.map((v, i) => i >= retireIdx ? v : null),
      borderColor: s.color, backgroundColor: 'transparent',
      borderWidth: 2, borderDash: [5, 4], pointRadius: 0, tension: 0.3, spanGaps: false,
    });
  });

  // Goal bar
  if (annualSpend > 0) {
    const projPort = calcAt(rates[1], effectiveContrib, startAge, contribUntil, startVal, retireAge);
    renderGoalBar(projPort, annualSpend, retireAge);
  } else {
    const gb = document.getElementById('goalBar');
    if (gb) gb.innerHTML = '';
  }

  // Breakeven cards
  const beRow = document.getElementById('beRow');
  const hitAges = SC.map((s, idx) => {
    const raw = calcSeries(rates[idx], effectiveContrib, startAge, contribUntil, startVal, xMin, xMax);
    const hi = raw.findIndex((v, i) => v >= target);
    const age = hi >= 0 ? xMin + hi : null;
    return { s, r: rates[idx], age };
  });
  beRow.innerHTML = hitAges.map(({ s, r, age }) => `
    <div class="rc ${s.cls}">
      <div class="rc-top">
        <span class="rc-label" style="color:${s.color}" id="pct_${s.key}">${(r * 100).toFixed(1)}%</span>
        <span style="font-size:9px;color:${s.color};opacity:.5;">${s.offset === 0 ? 'base' : s.offset > 0 ? '+2%' : '−2%'}</span>
      </div>
      <div class="rc-pct" style="color:${s.color};">${fmtM(calcAt(r, effectiveContrib, startAge, contribUntil, startVal, retireAge))}</div>
      <div class="rc-vals">
        <div class="rc-val">
          <div class="rc-age" id="lra_${s.key}">age ${retireAge}</div>
          <div class="rc-amt" style="color:${s.color};" id="vra_${s.key}">${fmtM(calcAt(r, effectiveContrib, startAge, contribUntil, startVal, retireAge))}</div>
        </div>
        <div class="rc-val">
          <div class="rc-age" id="lea_${s.key}">age ${xMax}</div>
          <div class="rc-amt" style="color:${s.color};" id="vea_${s.key}">${fmtM(calcAt(r, 0, retireAge, retireAge, calcAt(r, effectiveContrib, startAge, contribUntil, startVal, retireAge), planUntil))}</div>
        </div>
      </div>
      <div class="stat-sub" style="margin-top:8px;">${age ? 'hits ' + fmtM(target) + ' at age ' + age : 'target not reached'}</div>
    </div>`).join('');

  // Monte Carlo
  const mcData = useMC
    ? runMonteCarlo(baseRate, effectiveContrib, startAge, contribUntil, startVal, xMin, xMax)
    : null;

  // Legend
  const legItems = SC.map(s =>
    `<span class="li"><span class="ls" style="background:${s.color}"></span>${s.label} ${(baseRate + s.offset / 100) * 100}%</span>`);
  legItems.push('<span class="li"><span class="ls" style="background:rgba(255,255,255,0.2);"></span>solid = contributing · dashed = coast</span>');
  if (useMC) legItems.push('<span class="li"><span class="ls" style="background:#A78BFA"></span>Monte Carlo P10–P90</span>');
  document.getElementById('legend').innerHTML = legItems.join('');
  document.getElementById('explainer').textContent =
    `Projections from age ${startAge} to ${xMax} · Contributing $${contrib.toLocaleString()} until age ${contribUntil} · After that, portfolio coasts · All values in today's dollars`;

  // Simple chart
  if (State.accumMode === 'simple') {
    buildAccumSimpleChart({ rates, datasets, labels: chartLabels, retireIdx, allVals, target, useMC, mcData, startAge, xMin });
  }

  // Advanced (Shiller bar chart)
  if (State.accumMode === 'advanced') {
    const years = retireAge - startAge;
    if (years > 0 && years <= SHILLER.length) {
      const ha = histAccum(startVal, effectiveContrib, contribUntil, startAge, years, feesRate);
      document.getElementById('accumHistStats').innerHTML = `
        <div class="hist-cell"><div class="hist-lbl">P10 outcome</div><div class="hist-val">${fmtM(ha.p10)}</div></div>
        <div class="hist-cell"><div class="hist-lbl">P50 outcome</div><div class="hist-val" style="color:var(--bull)">${fmtM(ha.p50)}</div></div>
        <div class="hist-cell"><div class="hist-lbl">P90 outcome</div><div class="hist-val">${fmtM(ha.p90)}</div></div>
        <div class="hist-cell"><div class="hist-lbl">Best start</div><div class="hist-val">${ha.best.yr}: ${fmtM(ha.best.val)}</div></div>
        <div class="hist-cell"><div class="hist-lbl">Worst start</div><div class="hist-val" style="color:var(--warn)">${ha.worst.yr}: ${fmtM(ha.worst.val)}</div></div>
        <div class="hist-cell"><div class="hist-lbl">Windows</div><div class="hist-val">${ha.results.length}</div></div>`;
      buildAccumAdvChart({ results: ha.results, p10: ha.p10, p50: ha.p50, p90: ha.p90 });
      document.getElementById('accumHistDetail').innerHTML =
        `<div style="font-size:9px;color:var(--muted);margin-top:4px;">Each bar = portfolio if you had started investing in that year · ${years}-year accumulation · Shiller real returns 1871–2023</div>`;
    }
  }
}
