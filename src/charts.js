// ── charts.js — Chart.js chart builders and plugins ──
// Depends on: data.js, calc.js, state.js
// All chart functions receive their data as arguments — no direct DOM reads.

// ── Scenario constants (used by accumulation chart) ──
const SC = [
  { key: 'bear', label: 'Bear', color: '#8892A0', cls: 'bear', offset: -2 },
  { key: 'base', label: 'Base', color: '#3B9EFF', cls: 'base', offset:  0 },
  { key: 'bull', label: 'Bull', color: '#22D3A0', cls: 'bull', offset: +2 },
];

// ── Shared chart defaults ──
Chart.defaults.color = '#4A5568';
Chart.defaults.font.family = "'DM Mono', monospace";

// ─────────────────────────────────────────────
// Accumulation — Simple mode (3-scenario lines)
// ─────────────────────────────────────────────

/**
 * Build or update the simple accumulation line chart.
 * @param {object} params - { rates, datasets, labels, retireIdx, allVals, target, useMC, mcData, startAge, xMin }
 */
function buildAccumSimpleChart(params) {
  const { rates, datasets, labels, retireIdx, allVals, target, useMC, mcData, startAge, xMin } = params;
  const canvas = document.getElementById('gc');
  if (!canvas) return;

  if (State.accumChart) { State.accumChart.destroy(); State.accumChart = null; }

  const yMax = Math.max(...allVals, target) * 1.08;

  // Retire line plugin
  const retireLinePlugin = {
    id: 'retireLine',
    afterDraw(chart) {
      const { ctx, scales: { x, y }, chartArea: ca } = chart;
      if (!x || !y) return;
      const xPx = x.getPixelForValue(retireIdx);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(xPx, ca.top); ctx.lineTo(xPx, ca.bottom); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = "500 9px 'DM Mono',monospace";
      ctx.fillText('retire', xPx + 4, ca.top + 12);
      ctx.restore();
    },
  };

  // Target line plugin
  const targetLinePlugin = {
    id: 'targetLine',
    afterDraw(chart) {
      const { ctx, scales: { x, y }, chartArea: ca } = chart;
      if (!x || !y || target <= 0) return;
      const yPx = y.getPixelForValue(target);
      if (yPx < ca.top || yPx > ca.bottom) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(244,114,182,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(ca.left, yPx); ctx.lineTo(ca.right, yPx); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(244,114,182,0.6)';
      ctx.font = "500 9px 'DM Mono',monospace";
      ctx.textAlign = 'right';
      ctx.fillText('target ' + fmtM(target), ca.right - 4, yPx - 4);
      ctx.restore();
    },
  };

  // Crosshair + tooltip plugin
  const crosshairPlugin = {
    id: 'crosshair',
    _idx: -1,
    afterEvent(chart, args) {
      const e = args.event;
      const ca = chart.chartArea;
      if (!ca) return;
      if (e.type === 'mousemove' && e.x >= ca.left && e.x <= ca.right) {
        const pct = (e.x - ca.left) / (ca.right - ca.left);
        this._idx = Math.round(pct * (labels.length - 1));
        chart.draw();
      } else if (e.type === 'mouseout') {
        this._idx = -1; chart.draw();
      }
    },
    afterDraw(chart) {
      const idx = this._idx;
      if (idx < 0) return;
      const { ctx, scales: { x, y }, chartArea: ca } = chart;
      const xPx = x.getPixelForValue(idx);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xPx, ca.top); ctx.lineTo(xPx, ca.bottom); ctx.stroke();
      const age = xMin + idx;
      SC.forEach((s, si) => {
        const ds = chart.data.datasets[si * 2];
        if (!ds || ds.data[idx] == null) return;
        const val = ds.data[idx];
        const yPx = y.getPixelForValue(val);
        ctx.beginPath(); ctx.arc(xPx, yPx, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = s.color; ctx.fill();
        const lbl = 'age ' + age + ' · ' + fmtM(val);
        ctx.font = "500 10px 'DM Mono',monospace";
        const tw = ctx.measureText(lbl).width;
        const px = Math.min(xPx + 8, ca.right - tw - 8);
        const py = Math.max(yPx - 8, ca.top + 4);
        ctx.fillStyle = s.color;
        ctx.textAlign = 'left';
        ctx.fillText(lbl, px, py);
      });
      ctx.restore();
    },
  };

  const allDS = [...datasets];
  if (useMC && mcData) {
    const mcColor = 'rgba(167,139,250,';
    allDS.push(
      { label: 'MC P90', data: mcData.p90, borderColor: mcColor + '0)', backgroundColor: mcColor + '0.08)', fill: '+1', borderWidth: 0, pointRadius: 0, tension: 0.3 },
      { label: 'MC P10', data: mcData.p10, borderColor: mcColor + '0)', backgroundColor: mcColor + '0.08)', fill: false, borderWidth: 0, pointRadius: 0, tension: 0.3 },
      { label: 'MC P50', data: mcData.p50, borderColor: mcColor + '0.5)', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, tension: 0.3 },
    );
  }

  State.accumChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: allDS },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { ticks: { color: '#4A5568', font: { size: 9 }, callback: (_, i) => labels[i] % 5 === 0 ? labels[i] : '', maxRotation: 0 }, grid: { display: false } },
        y: { min: 0, max: yMax, ticks: { color: '#4A5568', font: { size: 9 }, callback: v => fmtMs(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
    plugins: [retireLinePlugin, targetLinePlugin, crosshairPlugin],
  });
}

// ─────────────────────────────────────────────
// Accumulation — Advanced (Shiller bar chart)
// ─────────────────────────────────────────────

function buildAccumAdvChart(params) {
  const { results, p10, p50, p90, startYear } = params;
  const canvas = document.getElementById('gcAdv');
  if (!canvas) return;
  if (State.advAccumChart) { State.advAccumChart.destroy(); State.advAccumChart = null; }

  const labels = results.map(r => r.yr);
  const vals   = results.map(r => r.val);
  const colors = results.map(r => r.val >= p50 ? 'rgba(29,158,117,0.6)' : 'rgba(251,146,60,0.55)');

  State.advAccumChart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0, borderRadius: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          title: ctx => 'Started ' + labels[ctx[0].dataIndex],
          label: ctx => ' ' + fmtM(ctx.raw),
        }},
      },
      scales: {
        x: { ticks: { color: '#4A5568', font: { size: 9 }, callback: (_, i) => labels[i] % 20 === 0 ? labels[i] : '', maxRotation: 0 }, grid: { display: false } },
        y: { ticks: { color: '#4A5568', font: { size: 9 }, callback: v => fmtMs(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });
}

// ─────────────────────────────────────────────
// Withdrawal — Fan chart
// ─────────────────────────────────────────────

/**
 * Build the withdrawal fan chart (P10–P90 bands + median + worst).
 */
function buildFanChart(params) {
  const { h, ages, portBase, rates, retireAge } = params;
  const canvas = document.getElementById('gcWdAdv');
  if (!canvas) return;
  if (State.advWdChart) { State.advWdChart.destroy(); State.advWdChart = null; }

  const wdYears = ages.length - 1;
  const p10s = [], p25s = [], p50s = [], p75s = [], p90s = [];
  const worstSeries = h.worst.wdSeries;

  for (let i = 0; i <= wdYears; i++) {
    const vals = h.results.map(r => r.wdSeries[i]).filter(v => v != null).sort((a, b) => a - b);
    const p = pct => vals[Math.max(0, Math.floor(vals.length * pct))];
    p10s.push(p(0.10)); p25s.push(p(0.25)); p50s.push(p(0.50));
    p75s.push(p(0.75)); p90s.push(p(0.90));
  }

  const teal = (a) => `rgba(29,158,117,${a})`;
  const datasets = [
    { label: 'P90', data: p90s, borderColor: teal(0), backgroundColor: teal(0.07), fill: '+3', pointRadius: 0, borderWidth: 0, tension: 0.3 },
    { label: 'P75', data: p75s, borderColor: teal(0), backgroundColor: teal(0.07), fill: '+1', pointRadius: 0, borderWidth: 0, tension: 0.3 },
    { label: 'P25', data: p25s, borderColor: teal(0), backgroundColor: teal(0.13), fill: '-1', pointRadius: 0, borderWidth: 0, tension: 0.3 },
    { label: 'P10', data: p10s, borderColor: teal(0), backgroundColor: teal(0.07), fill: false, pointRadius: 0, borderWidth: 0, tension: 0.3 },
    { label: 'Median', data: p50s, borderColor: '#1D9E75', backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 0, tension: 0.3 },
    { label: 'Worst',  data: worstSeries, borderColor: 'rgba(251,146,60,0.6)', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, tension: 0.3 },
  ];

  // Hover pill plugin
  const hoverPillPlugin = {
    id: 'fanHover', _idx: -1,
    afterEvent(chart, args) {
      const e = args.event; const ca = chart.chartArea;
      if (!ca) return;
      if (e.type === 'mousemove' && e.x >= ca.left && e.x <= ca.right) {
        const pct = (e.x - ca.left) / (ca.right - ca.left);
        this._idx = Math.max(0, Math.min(ages.length - 1, Math.round(pct * (ages.length - 1))));
        chart.draw();
      } else if (e.type === 'mouseout') { this._idx = -1; chart.draw(); }
    },
    afterDraw(chart) {
      const idx = this._idx;
      if (idx < 0) return;
      const { ctx, scales: { x, y }, chartArea: ca } = chart;
      const xPx = x.getPixelForValue(idx);
      const medVal = p50s[idx];
      if (medVal == null) return;
      const yPx = y.getPixelForValue(medVal);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xPx, ca.top); ctx.lineTo(xPx, ca.bottom); ctx.stroke();
      ctx.beginPath(); ctx.arc(xPx, yPx, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#1D9E75'; ctx.fill();
      const lbl = 'age ' + ages[idx] + ' · ' + fmtM(medVal);
      ctx.font = "600 10px 'DM Mono',monospace";
      const tw = ctx.measureText(lbl).width, pw = tw + 14, ph = 20;
      const flipped = xPx + pw + 10 > ca.right;
      const px = flipped ? xPx - pw - 6 : xPx + 6;
      const py = yPx - ph / 2;
      ctx.fillStyle = 'rgba(14,20,25,0.88)'; ctx.strokeStyle = 'rgba(29,158,117,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1D9E75'; ctx.textAlign = 'left';
      ctx.fillText(lbl, px + 7, py + 14);
      ctx.restore();
    },
  };

  // Annotation plugin (end labels + start point)
  const fanAnnotPlugin = {
    id: 'fanAnnot',
    afterDraw(chart) {
      const { ctx, scales: { x, y }, chartArea: ca } = chart;
      // Start point pill
      if (p50s[0] > 0) {
        const startY = y.getPixelForValue(p50s[0]);
        ctx.save();
        ctx.strokeStyle = 'rgba(29,158,117,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(ca.left - 6, startY); ctx.lineTo(ca.left + 6, startY); ctx.stroke();
        ctx.beginPath(); ctx.arc(ca.left, startY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#1D9E75'; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
        const lbl = 'Start: ' + fmtMs(portBase);
        ctx.font = "600 11px 'DM Mono',monospace";
        const lw = ctx.measureText(lbl).width, lp = lw + 14, lh = 22;
        const lx = ca.left + 14, ly = startY - lh / 2;
        ctx.fillStyle = 'rgba(29,158,117,0.18)'; ctx.strokeStyle = 'rgba(29,158,117,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(lx, ly, lp, lh, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1D9E75'; ctx.textAlign = 'left';
        ctx.fillText(lbl, lx + 7, ly + 15);
        ctx.restore();
      }
      // End labels
      const lastIdx = ages.length - 1;
      const xEnd = x.getPixelForValue(lastIdx);
      const labeled = [];
      [[p90s, '#3B9EFF', 'P90'], [p50s, '#1D9E75', 'med'], [p10s, '#FB923C', 'P10'],
       [worstSeries, 'rgba(251,146,60,0.7)', 'worst']].forEach(([series, color, tag]) => {
        const val = series[lastIdx];
        if (val == null) return;
        let yPx = y.getPixelForValue(val);
        labeled.forEach(prev => { if (Math.abs(yPx - prev) < 14) yPx = prev - 14; });
        labeled.push(yPx);
        ctx.save();
        ctx.fillStyle = color; ctx.font = "500 9px 'DM Mono',monospace"; ctx.textAlign = 'left';
        ctx.fillText(tag + ' ' + fmtMs(val), xEnd + 6, yPx + 4);
        ctx.restore();
      });
    },
  };

  State.advWdChart = new Chart(canvas, {
    type: 'line',
    data: { labels: ages, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      layout: { padding: { right: 60 } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { ticks: { color: '#4A5568', font: { size: 9 }, callback: v => v, maxRotation: 0 }, grid: { display: false } },
        y: { min: 0, ticks: { color: '#4A5568', font: { size: 9 }, callback: v => fmtMs(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
    plugins: [hoverPillPlugin, fanAnnotPlugin],
  });
}

// ─────────────────────────────────────────────
// Withdrawal — SORR bar + estate line chart
// ─────────────────────────────────────────────

function buildSorrChart(params) {
  const { h, withdrawYears, retireAge, onBarClick } = params;
  const canvas = document.getElementById('gcSorr');
  if (!canvas) return;
  if (State.sorrChart) { State.sorrChart.destroy(); State.sorrChart = null; }

  const sorrLabels = h.results.map(r => r.yr);
  const sorrYrs    = h.results.map(r => r.survived ? withdrawYears : (r.dep || 0));
  const sorrEstate = h.results.map(r => r.survived ? r.val : null);
  const sorrColors = h.results.map(r => r.survived ? 'rgba(29,158,117,0.55)' : 'rgba(251,146,60,0.70)');
  const maxEstate  = Math.max(...sorrEstate.filter(v => v != null), 1);
  const worstIdx   = h.results.findIndex(r => r.yr === h.worst.yr);

  const sorrSc = {
    x: {
      ticks: { color: '#4A5568', font: { size: 9, family: "'DM Mono',monospace" },
               callback: (_, i) => sorrLabels[i] % 10 === 0 ? sorrLabels[i] : '',
               maxRotation: 0, padding: 8 },
      grid: { display: false },
    },
    yLeft: {
      position: 'left', min: 0, max: withdrawYears + 2,
      ticks: { color: '#4A5568', font: { size: 9 }, callback: v => v + 'y' },
      grid: { color: 'rgba(255,255,255,0.04)' },
    },
    yRight: {
      position: 'right', min: 0, max: maxEstate * 1.15,
      ticks: { color: '#4A5568', font: { size: 9 }, callback: v => fmtMs(v) },
      grid: { display: false },
    },
  };

  // Hover plugin (bar pill + estate pill)
  const sorrHoverPlugin = {
    id: 'sorrHover', _idx: -1,
    afterEvent(chart, args) {
      const e = args.event; const ca = chart.chartArea;
      if (!ca) return;
      if (e.type === 'mousemove') {
        if (e.x < ca.left || e.x > ca.right) { this._idx = -1; chart.draw(); return; }
        const pct = (e.x - ca.left) / (ca.right - ca.left);
        this._idx = Math.max(0, Math.min(sorrLabels.length - 1, Math.round(pct * (sorrLabels.length - 1))));
        chart.draw();
      } else if (e.type === 'mouseout') { this._idx = -1; chart.draw(); }
    },
    afterDraw(chart) {
      const idx = this._idx;
      if (idx < 0) return;
      const { ctx, scales: { x, yRight, yLeft }, chartArea: ca } = chart;
      const xPx = x.getPixelForValue(idx);
      const estateVal = sorrEstate[idx];
      const yr = sorrLabels[idx];
      const r = h.results[idx];
      const yrs = r.survived ? withdrawYears : (r.dep || 0);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(xPx, ca.top); ctx.lineTo(xPx, ca.bottom); ctx.stroke();
      const barTxt = yr + ' · ' + (r.survived ? yrs + ' yrs ✓' : 'depleted yr ' + yrs);
      ctx.font = "500 10px 'DM Mono',monospace";
      const btw = ctx.measureText(barTxt).width, bpw = btw + 14, bph = 18;
      const bFlip = xPx + bpw + 10 > ca.right;
      const bpx = bFlip ? xPx - bpw - 6 : xPx + 6;
      const bpy = ca.bottom - bph - 8;
      ctx.fillStyle = 'rgba(14,20,25,0.88)';
      ctx.strokeStyle = r.survived ? 'rgba(29,158,117,0.5)' : 'rgba(251,146,60,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(bpx, bpy, bpw, bph, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = r.survived ? '#1D9E75' : '#FB923C'; ctx.textAlign = 'left';
      ctx.fillText(barTxt, bpx + 7, bpy + 13);
      if (estateVal != null && yRight) {
        const eyPx = yRight.getPixelForValue(estateVal);
        ctx.beginPath(); ctx.arc(xPx, eyPx, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(250,210,60,0.9)'; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
        const etxt = '$' + fmtMs(estateVal) + ' estate';
        const etw = ctx.measureText(etxt).width, epw = etw + 14, eph = 18;
        const eFlip = xPx + epw + 10 > ca.right;
        const epx = eFlip ? xPx - epw - 6 : xPx + 6;
        const epy = eyPx - eph / 2;
        ctx.fillStyle = 'rgba(14,20,25,0.88)'; ctx.strokeStyle = 'rgba(250,210,60,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(epx, epy, epw, eph, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(250,210,60,0.95)'; ctx.textAlign = 'left';
        ctx.fillText(etxt, epx + 7, epy + 13);
      }
      ctx.restore();
    },
  };

  // Click plugin
  const sorrClickPlugin = {
    id: 'sorrClick',
    afterEvent(chart, args) {
      const e = args.event; const ca = chart.chartArea;
      if (e.type !== 'click' || !ca || e.x < ca.left || e.x > ca.right) return;
      const pct = (e.x - ca.left) / (ca.right - ca.left);
      const idx = Math.max(0, Math.min(sorrLabels.length - 1, Math.round(pct * (sorrLabels.length - 1))));
      if (idx === State.sorrSelectedIdx) {
        State.sorrSelectedIdx = -1;
        clearSeqExplorer();
      } else {
        State.sorrSelectedIdx = idx;
        State.sorrPulseShown = true;
        onBarClick(idx);
      }
      chart.draw();
    },
    afterDraw(chart) {
      const idx = State.sorrSelectedIdx;
      if (idx < 0) return;
      const { ctx, scales: { x }, chartArea: ca } = chart;
      const xPx = x.getPixelForValue(idx);
      ctx.save();
      ctx.strokeStyle = 'rgba(59,158,255,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(xPx, ca.top); ctx.lineTo(xPx, ca.bottom); ctx.stroke();
      ctx.restore();
    },
  };

  // Pulse plugin (first-load hint on worst bar)
  const sorrPulsePlugin = {
    id: 'sorrPulse',
    afterDraw(chart) {
      if (State.sorrPulseShown || State.sorrSelectedIdx >= 0 || worstIdx < 0) return;
      const { ctx, scales: { x, yLeft }, chartArea: ca } = chart;
      if (!x || !yLeft) return;
      const xPx = x.getPixelForValue(worstIdx);
      const barTopY = yLeft.getPixelForValue(sorrYrs[worstIdx]);
      const dotY = barTopY - 10;
      const now = Date.now();
      const t = (Math.sin(now / 500) + 1) / 2;
      ctx.save();
      ctx.beginPath(); ctx.arc(xPx, dotY, 5 + t * 7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(29,158,117,${0.2 * (1 - t)})`; ctx.fill();
      ctx.beginPath(); ctx.arc(xPx, dotY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#1D9E75'; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
      const lbl = `↓ Click to explore ${h.worst.yr}`;
      ctx.font = "600 10px 'DM Mono',monospace";
      const lw = ctx.measureText(lbl).width, pw = lw + 16, ph = 20;
      const idealX = xPx - pw / 2;
      const pillX = Math.max(ca.left + 2, Math.min(ca.right - pw - 2, idealX));
      const pillY = Math.max(ca.top + 4, dotY - ph - 10);
      ctx.fillStyle = 'rgba(14,20,25,0.92)'; ctx.strokeStyle = 'rgba(29,158,117,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(pillX, pillY, pw, ph, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1D9E75'; ctx.textAlign = 'left';
      ctx.fillText(lbl, pillX + 8, pillY + 14);
      ctx.restore();
    },
  };

  State.sorrChart = new Chart(canvas, {
    data: {
      labels: sorrLabels,
      datasets: [
        { type: 'bar',  data: sorrYrs,    backgroundColor: sorrColors, borderWidth: 0, borderRadius: 2, yAxisID: 'yLeft' },
        { type: 'line', data: sorrEstate, borderColor: 'rgba(250,210,60,0.85)', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'yRight', spanGaps: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: sorrSc,
    },
    plugins: [sorrHoverPlugin, sorrClickPlugin, sorrPulsePlugin],
  });

  // Drive pulse animation
  (function animatePulse() {
    if (State.sorrPulseShown) return;
    if (State.sorrChart) State.sorrChart.draw();
    requestAnimationFrame(animatePulse);
  })();

  return { sorrLabels, sorrYrs, sorrEstate };
}
