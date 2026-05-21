// ── app.js — DOM wiring, application logic, event handlers ──

// Depends on: data.js, calc.js, state.js, charts.js

// SC is defined in charts.js (loads before app.js)



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
const SHARE_DEFAULTS_ARR = [1000000,25000,7,38,55,55,85,80000,0,100,0,0,0.1,0,67,0];



function getAlloc(){
  const s=parseInt(document.getElementById('allocS').value)||0;
  const b=parseInt(document.getElementById('allocB').value)||0;
  const c=parseInt(document.getElementById('allocC').value)||0;
  return{s:s/100, b:b/100, c:c/100, total:s+b+c, valid:s+b+c===100};
}

function toggleAlloc(){
  const panel=document.getElementById('allocPanel');
  const chevron=document.getElementById('allocChevron');
  const open=panel.style.display==='none';
  panel.style.display=open?'':'none';
  chevron.style.transform=open?'rotate(180deg)':'';
}

function clampAlloc(id){
  const el=document.getElementById(id);
  let v=parseInt(el.value)||0;
  v=Math.max(0,Math.min(100,v));
  el.value=v;
}

function resetAlloc(){
  document.getElementById('allocS').value=100;
  document.getElementById('allocB').value=0;
  document.getElementById('allocC').value=0;
  updAlloc();
}

function updAlloc(){
  const s=Math.max(0,parseInt(document.getElementById('allocS').value)||0);
  const b=Math.max(0,parseInt(document.getElementById('allocB').value)||0);
  const c=Math.max(0,parseInt(document.getElementById('allocC').value)||0);
  const total=s+b+c;
  const ok=total===100;
  // Stacked bar
  const sf=ok?s:s/Math.max(total,1)*100;
  const bf=ok?b:b/Math.max(total,1)*100;
  const cf=ok?c:c/Math.max(total,1)*100;
  document.getElementById('allocBarS').style.width=sf+'%';
  document.getElementById('allocBarB').style.width=bf+'%';
  document.getElementById('allocBarC').style.width=cf+'%';
  // Total label
  const totalEl=document.getElementById('allocTotal');
  totalEl.textContent=total+'%'+(ok?' ✓':' — must equal 100');
  totalEl.style.color=ok?'var(--bull)':'#E24B4A';
  // Summary
  document.getElementById('allocSummary').innerHTML=
    `<span style="color:#1D9E75;">S</span><span>${s}</span>`+
    `<span style="color:#3B9EFF;margin-left:3px;">B</span><span>${b}</span>`+
    `<span style="color:#4A5568;margin-left:3px;">C</span><span>${c}</span>`;
  // Expected return
  const expEl=document.getElementById('allocExpReturn');
  const card=document.getElementById('allocReturnCard');
  if(ok){
    const exp=((s/100)*AVG_EQUITY+(b/100)*AVG_BONDS+(c/100)*AVG_CASH)*100;
    expEl.textContent=exp.toFixed(1)+'%';
    expEl.style.color='var(--bull)';
    card.style.opacity='1';
  } else {
    expEl.textContent='—';
    card.style.opacity='.4';
  }
  if(ok) upd();
}

function setAccumMode(mode){
  State.accumMode=mode;
  document.getElementById('accumSimpleBtn').classList.toggle('active',mode==='simple');
  document.getElementById('accumAdvBtn').classList.toggle('active',mode==='advanced');
  document.getElementById('accumSimplePanel').style.display=mode==='simple'?'':'none';
  document.getElementById('accumAdvPanel').style.display=mode==='advanced'?'':'none';
  document.getElementById('accumModeHint').textContent=mode==='simple'?'3 return scenarios':'Shiller historical 1871–2023';
  document.getElementById('rateRow').style.display=mode==='advanced'?'none':'';
  upd();
}

function addEvent(){
  const label  = document.getElementById('evtLabel').value.trim() || 'Event';
  const age    = parseInt(document.getElementById('evtAge').value);
  const amount = pm(document.getElementById('evtAmt').value);
  if(!age || !amount) return;
  State.oneTimeEvents.push({label, age, amount});
  document.getElementById('evtLabel').value = '';
  document.getElementById('evtAge').value   = '';
  document.getElementById('evtAmt').value   = '';
  renderEvents();
  upd();
}

function removeEvent(i){ State.oneTimeEvents.splice(i,1); renderEvents(); upd(); }

function renderEvents(){
  document.getElementById('eventList').innerHTML = State.oneTimeEvents.map((e,i) =>
    `<div class="event-item">
      <button class="event-del" onclick="removeEvent(${i})">✕</button>
      <span style="color:var(--warn);font-size:11px;">${e.label}</span>
      <span style="color:var(--muted);font-size:10px;">age ${e.age}</span>
      <span style="color:var(--text);font-size:11px;margin-left:auto;">${e.amount>0?'-':'+'}${fmtM(Math.abs(e.amount))}</span>
    </div>`
  ).join('');
}

function fmtEvt(el){ const v=pm(el.value); if(v>0) el.value='$'+v.toLocaleString('en-US',{maximumFractionDigits:0}); }

function fmt(el){ const v=pm(el.value); if(v>0) el.value='$'+v.toLocaleString('en-US',{maximumFractionDigits:0}); }

function switchTab(tab){
  State.currentTab = tab;
  document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('active',['accumulation','withdrawal'][i]===tab));
  const isWd = tab==='withdrawal';

  // Panel visibility
  document.getElementById('wdrawOnlyPanel').style.display      = isWd ? 'flex' : 'none';
  document.getElementById('wdrawOnlyPanel').style.flexDirection = 'column';
  document.getElementById('accumChartPanel').style.display     = isWd ? 'none' : 'block';
  document.getElementById('wdrawRight').style.display          = isWd ? 'flex' : 'none';
  document.getElementById('rateRow').style.display             = isWd ? 'none' : '';

  // Accumulation-only inputs — hide on withdrawal tab
  ['fieldContrib','divContrib','fieldTarget','rowMC'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display=isWd?'none':'';
  });

  // Return rate slider hint changes by tab
  const hint=document.getElementById('rateSliderHint');
  if(hint) hint.innerHTML=isWd
    ?'<span>1%</span><span style="color:#1D9E75;">sets your retirement portfolio ↑</span><span>12%</span>'
    :'<span>1%</span><span>after inflation · scenarios ±2%</span><span>12%</span>';

  // Open allocation panel by default on withdrawal tab
  if(isWd){
    const ap=document.getElementById('allocPanel');
    const ac=document.getElementById('allocChevron');
    if(ap&&ap.style.display==='none'){
      ap.style.display='';
      if(ac) ac.style.transform='rotate(180deg)';
    }
  }
  State.prevSurvPct = null; // reset delta tracker on tab switch
  upd();
}

function showSeqExplorer(idx) {
  if(!State.sorrExplorerCtx) return;
  const {h, retireAge, planUntil, annualSpend, taxRate, portBase, stkPct, bndPct, cshPct} = State.sorrExplorerCtx;
  const withdrawYears = planUntil - retireAge;
  const r = h.results[idx];
  if(!r) return;

  const survived = r.survived;
  const yr = r.yr;
  const color = survived ? '#1D9E75' : '#FB923C';
  const border = survived ? 'rgba(29,158,117,0.25)' : 'rgba(251,146,60,0.25)';
  const bg = survived ? 'rgba(29,158,117,0.04)' : 'rgba(251,146,60,0.04)';

  // Rank this sequence vs all by a continuous score: depleted = dep/withdrawYears (0–1), survived = 1 + estate normalised
  const maxEst = Math.max(...h.results.filter(x=>x.survived).map(x=>x.val), 1);
  const score = x => x.survived ? 1 + x.val/maxEst : (x.dep||0)/withdrawYears;
  const allSorted = [...h.results].sort((a,b)=>score(a)-score(b));
  const rank = allSorted.findIndex(x=>x.yr===yr);
  const pctRank = Math.round((rank / (h.results.length-1)) * 100);
  const rankLabel = pctRank<=10?'Bottom 10% — very rough':pctRank<=25?'Bottom 25% — rough':pctRank<=50?'Below median':pctRank<=75?'Above median':pctRank<=90?'Top 25% — favorable':'Top 10% — excellent';
  const rankColor = pctRank<=25?'#FB923C':pctRank<=50?'#F59E0B':'#1D9E75';

  // Walk wdSeries for lowest point
  const series = r.wdSeries || [];
  let lowestVal = Infinity, lowestAge = retireAge;
  for(let i=1;i<series.length;i++){ if(series[i]<lowestVal){lowestVal=series[i];lowestAge=retireAge+i;} }
  // Recovery after lowest — find highest point after the lowest
  const lowestIdx = series.findIndex(v=>v===lowestVal);
  let recoveredAge=null, recoveredVal=null;
  let highAfterLow=0, highAfterLowAge=null;
  for(let i=lowestIdx+1;i<series.length;i++){
    if(series[i]>highAfterLow){highAfterLow=series[i];highAfterLowAge=retireAge+i;}
    if(series[i]>lowestVal*2&&series[i]>portBase*0.25){recoveredAge=retireAge+i;recoveredVal=series[i];break;}
  }

  // Worst/best single-year blended return within this sequence
  let worstRet=0,worstRetCalYr=yr,bestRet=-Infinity,bestRetCalYr=yr;
  const si=yr-SY;
  for(let y=0;y<withdrawYears&&(si+y)<SHILLER.length;y++){
    const ret=blendReturn(si+y, stkPct||1, bndPct||0, cshPct||0);
    if(ret<worstRet){worstRet=ret;worstRetCalYr=SY+si+y;}
    if(ret>bestRet){bestRet=ret;bestRetCalYr=SY+si+y;}
  }
  // Label showing what mix the returns reflect
  const s100=Math.round((stkPct||1)*100), b100=Math.round((bndPct||0)*100);
  const mixLabel=b100>0?` · ${s100}/${b100}`:`· equity`;

  const depAge = !survived ? retireAge+(r.dep||0) : null;
  const extraRunway = survived&&series.length>0 ? Math.max(0,Math.floor(series[series.length-1]/(annualSpend*(1-taxRate)))) : null;
  const ctx = HIST_CONTEXT[yr]||'';

  document.getElementById('wdSeqExplorer').style.display='block';
  document.getElementById('wdSeqExplorer').innerHTML=`
    <div style="border-radius:13px;border:1px solid ${border};background:${bg};padding:18px 20px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
        <div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:3px;">Sequence explorer · click another bar to switch</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-family:var(--fd);font-size:28px;font-weight:700;color:${color};">Retired ${yr}</span>
            <span style="font-size:11px;padding:2px 9px;border-radius:12px;background:${survived?'rgba(29,158,117,0.12)':'rgba(251,146,60,0.12)'};color:${color};">${survived?'Survived ✓':'Depleted'}</span>
          </div>
          ${ctx?`<div style="margin-top:8px;padding:8px 12px;border-left:3px solid ${color};background:rgba(255,255,255,0.03);border-radius:0 6px 6px 0;font-size:11px;color:var(--text);opacity:.85;line-height:1.55;max-width:520px;">${ctx}</div>`:''}
        </div>
        <button onclick="clearSeqExplorer()" style="background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:6px;color:var(--muted);font-family:var(--fm);font-size:10px;padding:4px 9px;cursor:pointer;flex-shrink:0;margin-left:12px;">✕ close</button>
      </div>

      <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(0,0,0,0.2);border-radius:6px;padding:4px 10px;margin-bottom:14px;">
        <div style="width:64px;height:4px;border-radius:2px;background:rgba(255,255,255,0.08);overflow:hidden;">
          <div style="height:100%;width:${pctRank}%;background:${rankColor};border-radius:2px;"></div>
        </div>
        <span style="font-size:10px;color:${rankColor};font-weight:500;">${rankLabel}</span>
        <span style="font-size:10px;color:var(--muted);">· better than ${pctRank}% of all sequences</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">Started with</div>
          <div style="font-size:13px;font-weight:600;">${fmtFull(portBase)}</div>
        </div>
        ${survived
          ?`<div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
              <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">Final estate</div>
              <div style="font-size:13px;font-weight:600;color:#1D9E75;">${fmtFull(r.val)}</div>
            </div>
            <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
              <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">Extra runway</div>
              <div style="font-size:13px;font-weight:600;color:#1D9E75;">~${extraRunway} more yrs</div>
            </div>`
          :`<div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
              <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">Depleted at age</div>
              <div style="font-size:13px;font-weight:600;color:#FB923C;">${depAge}</div>
            </div>
            <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
              <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">Lasted</div>
              <div style="font-size:13px;font-weight:600;color:#FB923C;">${r.dep} of ${withdrawYears} yrs</div>
            </div>`
        }
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">${"Worst yr"+mixLabel}</div>
          <div style="font-size:13px;font-weight:600;color:#FB923C;">${(worstRet*100).toFixed(1)}%</div>
          <div style="font-size:9px;color:var(--muted);margin-top:1px;">in ${worstRetCalYr}</div>
        </div>
      </div>

      ${lowestVal<portBase?`
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">Lowest balance</div>
          <div style="font-size:13px;font-weight:600;color:#FB923C;">${fmtFull(lowestVal)}</div>
          <div style="font-size:9px;color:var(--muted);margin-top:1px;">age ${lowestAge}</div>
        </div>
        ${recoveredAge
          ?`<div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
               <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">Recovered to</div>
               <div style="font-size:13px;font-weight:600;color:#1D9E75;">${fmtFull(recoveredVal)}</div>
               <div style="font-size:9px;color:var(--muted);margin-top:1px;">by age ${recoveredAge}</div>
             </div>`
          :`<div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
               <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">Best after low</div>
               <div style="font-size:13px;font-weight:600;color:var(--muted);">${highAfterLowAge?fmtFull(highAfterLow):'—'}</div>
               ${highAfterLowAge?`<div style="font-size:9px;color:var(--muted);margin-top:1px;">age ${highAfterLowAge}</div>`:''}
             </div>`
        }
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">${"Best yr"+mixLabel}</div>
          <div style="font-size:13px;font-weight:600;color:#1D9E75;">${(bestRet*100).toFixed(1)}%</div>
          <div style="font-size:9px;color:var(--muted);margin-top:1px;">in ${bestRetCalYr}</div>
        </div>
      </div>`:`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">${"Best yr"+mixLabel}</div>
          <div style="font-size:13px;font-weight:600;color:#1D9E75;">${(bestRet*100).toFixed(1)}%</div>
          <div style="font-size:9px;color:var(--muted);margin-top:1px;">in ${bestRetCalYr}</div>
        </div>
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:3px;">${"Worst yr"+mixLabel}</div>
          <div style="font-size:13px;font-weight:600;color:#FB923C;">${(worstRet*100).toFixed(1)}%</div>
          <div style="font-size:9px;color:var(--muted);margin-top:1px;">in ${worstRetCalYr}</div>
        </div>
      </div>`}
    </div>`;
}

function clearSeqExplorer(){
  State.sorrSelectedIdx=-1;
  document.getElementById('wdSeqExplorer').style.display='none';
  document.getElementById('wdSeqExplorer').innerHTML='';
  if(window._sorrChart){
    // Reset bar colors
    if(window._sorrChart.data.datasets[0]){
      window._sorrChart.data.datasets[0].backgroundColor=window._sorrChart._sorrColors;
      window._sorrChart.update('none');
    }
  }
}

function upd(){
  // ── Read inputs ──
  const startVal     = pm(document.getElementById('startVal').value);
  const contrib      = pm(document.getElementById('contrib').value);
  const baseRatePct  = parseFloat(document.getElementById('baseRate').value);
  const annualSpend  = parseInt(document.getElementById('spendSlider').value) || 80000;
  // Target: auto = 25× spend unless user has manually set it
  const targetInputEl = document.getElementById('targetInput');
  const targetManualVal = pm(targetInputEl?targetInputEl.value:'');
  if(!_targetManual && annualSpend>0 && targetInputEl){
    const auto=annualSpend*25;
    targetInputEl.value='$'+auto.toLocaleString('en-US',{maximumFractionDigits:0});
    const hint=document.getElementById('targetHint');
    if(hint) hint.textContent='Auto · 25× spend = '+fmtM(auto);
  }
  const target = _targetManual&&targetManualVal>0 ? targetManualVal : annualSpend*25;
  const useMC        = document.getElementById('mcToggle').checked;
  const taxRate      = parseInt(document.getElementById('taxRate').value)/100;
  const ssOn         = document.getElementById('ssToggle').checked;
  const ssIncome     = ssOn ? pm(document.getElementById('ssIncome').value) : 0;
  const ssAge        = ssOn ? (parseInt(document.getElementById('ssAge').value)||67) : 999;

  const startAge     = parseInt(document.getElementById('ageNow').value)    || 0;
  const contribUntil = parseInt(document.getElementById('ageCoast').value)  || 0;
  const retireAge    = parseInt(document.getElementById('ageRetire').value) || 0;
  const planUntil    = parseInt(document.getElementById('ageEnd').value)    || 0;

  // Don't render until we have the minimum required inputs
  if(!startVal || !startAge || !contribUntil || !retireAge || !planUntil) return;
  const xMin = startAge, xMax = planUntil;

  const feesOn   = document.getElementById('feesToggle').checked;
  const feesRate = feesOn ? parseFloat(document.getElementById('feesSlider').value)/100 : 0;
  document.getElementById('feesPanel').style.display = feesOn ? '' : 'none';
  document.getElementById('lblFees').textContent = feesOn ? (parseFloat(document.getElementById('feesSlider').value)).toFixed(2)+'%/yr' : '';

  document.getElementById('lblT').textContent    = fmtM(target);
  document.getElementById('lblRate').textContent  = baseRatePct.toFixed(1)+'%';
  document.getElementById('lblTax').textContent   = (taxRate*100).toFixed(0)+'%';
  document.getElementById('spendDisp').innerHTML  =
    `$${annualSpend.toLocaleString()} <span>/yr &nbsp;·&nbsp; $${Math.round(annualSpend/12).toLocaleString()}/mo</span>`;

  document.getElementById('ssPanel').style.display = ssOn ? '' : 'none';
  const effectiveContrib = contrib;

  // Scenario rates: base ± 2%, minus expense ratio if fees toggle on
  const rates = SC.map(s => Math.max(0.001, (baseRatePct + s.offset) / 100 - feesRate));

  // ── Rate cards ──
  // Always show portfolio at retireAge in left slot (matches hero card & accum stat row)
  // Right slot: accumulation tab shows planUntil value; withdrawal tab hides rate cards entirely
  SC.forEach((s,i) => {
    const r      = rates[i];
    const nomRetire = calcAt(r, effectiveContrib, startAge, contribUntil, startVal, retireAge);
    const nomEnd    = calcAt(r, effectiveContrib, startAge, contribUntil, startVal, xMax);
    const dispRetire = nomRetire;
    const dispEnd    = nomEnd;
    document.getElementById('pct_'+s.key).textContent = (r*100).toFixed(1)+'%';
    document.getElementById('lra_'+s.key).textContent = 'age '+retireAge;
    document.getElementById('lea_'+s.key).textContent = 'age '+xMax;
    document.getElementById('vra_'+s.key).textContent = fmtM(dispRetire);
    document.getElementById('vea_'+s.key).textContent = fmtM(dispEnd);
  });

  // ══════════════════════════════════════════
  // WITHDRAWAL TAB — unified historical simulation
  // ══════════════════════════════════════════
  if(State.currentTab==='withdrawal'){
    if(planUntil <= retireAge) return;

    // Portfolio at retirement — override input takes priority, else slider-calculated
    const portOverride = pm(document.getElementById('wdPortOverride').value);
    const portBase = portOverride > 0 ? portOverride : calcAt(rates[1], effectiveContrib, startAge, contribUntil, startVal, retireAge);

    // Allocation — read current values (default 100% stocks if invalid)
    const alloc = getAlloc();
    const stkPct = alloc.valid ? alloc.s : 1;
    const bndPct = alloc.valid ? alloc.b : 0;
    const cshPct = alloc.valid ? alloc.c : 0;
    const rebal  = document.getElementById('rebalToggle').checked;

    const h = histWithdraw(portBase, annualSpend, retireAge, planUntil, State.oneTimeEvents, ssIncome, ssAge, feesRate, stkPct, bndPct, cshPct, rebal);

    // ── Summary card + sequence explorer ──
    const withdrawYears = planUntil - retireAge;
    const nDepleted = h.results.filter(r=>!r.survived).length;
    const nSurvived = h.results.filter(r=>r.survived).length;
    const depletedResults = h.results.filter(r=>!r.survived);
    const survivedResults = h.results.filter(r=>r.survived);
    const takeHome = Math.round(annualSpend*(1-taxRate));

    // Depletion stats
    const depAges = depletedResults.map(r=>retireAge+(r.dep||0));
    const depMin = depAges.length ? Math.min(...depAges) : null;
    const depMax = depAges.length ? Math.max(...depAges) : null;
    const depAvg = depAges.length ? Math.round(depAges.reduce((a,b)=>a+b,0)/depAges.length) : null;

    // Survived estate stats
    const estateVals = survivedResults.map(r=>r.val).sort((a,b)=>a-b);
    const estMin = estateVals.length ? estateVals[0] : null;
    const estMax = estateVals.length ? estateVals[estateVals.length-1] : null;
    const estMedian = estateVals.length ? estateVals[Math.floor(estateVals.length/2)] : null;

    const survPct = parseFloat(h.pct);
    const survColor = survPct>=80?'var(--bull)':survPct>=50?'#F59E0B':'var(--warn)';

    // Delta indicator — what just changed
    const delta = State.prevSurvPct !== null ? survPct - State.prevSurvPct : null;
    const deltaHtml = delta !== null && Math.abs(delta) >= 0.5 ? `
      <span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;
        padding:2px 8px;border-radius:12px;margin-left:8px;
        background:${delta>0?'rgba(29,158,117,0.15)':'rgba(251,146,60,0.15)'};
        color:${delta>0?'#1D9E75':'#FB923C'};">
        ${delta>0?'↑':'↓'} ${Math.abs(delta).toFixed(1)}%
      </span>` : '';
    State.prevSurvPct = survPct;

    document.getElementById('wdHero').innerHTML = `
      <div style="border-radius:13px;border:1px solid rgba(255,255,255,0.07);background:var(--surface2);padding:18px 20px;">
        <!-- Top row: survival rate hero + take-home -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;gap:12px;">
          <div>
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px;">Survival rate · ${h.total} historical sequences</div>
            <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">
              <span style="font-family:var(--fd);font-size:42px;font-weight:700;line-height:1;color:${survColor};">${h.pct}%</span>
              <span style="font-size:12px;color:var(--muted);">made it to age ${planUntil}</span>
              ${deltaHtml}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px;">Take-home / yr</div>
            <div style="font-family:var(--fd);font-size:20px;font-weight:700;color:var(--text);">${fmtM(takeHome)}</div>
            <div style="font-size:9px;color:var(--muted);margin-top:2px;">$${Math.round(takeHome/12).toLocaleString()}/mo after tax</div>
          </div>
        </div>

        <!-- Progress bar -->
        <div style="height:6px;border-radius:3px;background:rgba(255,255,255,0.06);margin-bottom:16px;overflow:hidden;">
          <div style="height:100%;border-radius:3px;width:${h.pct}%;background:${survColor};transition:width .4s;"></div>
        </div>

        <!-- Two buckets: depleted vs survived -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <!-- Depleted bucket -->
          <div style="background:rgba(251,146,60,0.06);border:1px solid rgba(251,146,60,0.18);border-radius:10px;padding:12px 14px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
              <div style="width:6px;height:6px;border-radius:50%;background:#FB923C;flex-shrink:0;"></div>
              <span style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#FB923C;font-weight:600;">Ran out of money</span>
            </div>
            ${nDepleted===0
              ? `<div style="font-family:var(--fd);font-size:22px;font-weight:700;color:var(--bull);">None ✓</div>
                 <div style="font-size:10px;color:var(--muted);margin-top:2px;">every sequence survived</div>`
              : `<div style="font-family:var(--fd);font-size:22px;font-weight:700;color:#FB923C;">${nDepleted} <span style="font-size:13px;font-weight:400;color:var(--muted);">sequences</span></div>
                 <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:8px;">
                   <div style="background:rgba(0,0,0,.2);border-radius:6px;padding:5px 7px;">
                     <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:1px;">Earliest</div>
                     <div style="font-size:11px;font-weight:500;color:#FB923C;">Age ${depMin}</div>
                   </div>
                   <div style="background:rgba(0,0,0,.2);border-radius:6px;padding:5px 7px;">
                     <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:1px;">Average</div>
                     <div style="font-size:11px;font-weight:500;color:#FB923C;">Age ${depAvg}</div>
                   </div>
                   <div style="background:rgba(0,0,0,.2);border-radius:6px;padding:5px 7px;">
                     <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:1px;">Latest</div>
                     <div style="font-size:11px;font-weight:500;color:#FB923C;">Age ${depMax}</div>
                   </div>
                 </div>`
            }
          </div>

          <!-- Survived bucket -->
          <div style="background:rgba(29,158,117,0.06);border:1px solid rgba(29,158,117,0.18);border-radius:10px;padding:12px 14px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
              <div style="width:6px;height:6px;border-radius:50%;background:#1D9E75;flex-shrink:0;"></div>
              <span style="font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#1D9E75;font-weight:600;">Survived · estate left</span>
            </div>
            ${nSurvived===0
              ? `<div style="font-family:var(--fd);font-size:22px;font-weight:700;color:var(--warn);">None</div>
                 <div style="font-size:10px;color:var(--muted);margin-top:2px;">no sequences survived</div>`
              : `<div style="font-family:var(--fd);font-size:22px;font-weight:700;color:#1D9E75;">${fmtM(estMedian)} <span style="font-size:12px;font-weight:400;color:var(--muted);">median</span></div>
                 <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px;">
                   <div style="background:rgba(0,0,0,.2);border-radius:6px;padding:5px 7px;">
                     <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:1px;">Lowest estate</div>
                     <div style="font-size:11px;font-weight:500;color:#1D9E75;">${fmtM(estMin)}</div>
                   </div>
                   <div style="background:rgba(0,0,0,.2);border-radius:6px;padding:5px 7px;">
                     <div style="font-size:8px;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin-bottom:1px;">Highest estate</div>
                     <div style="font-size:11px;font-weight:500;color:#1D9E75;">${fmtM(estMax)}</div>
                   </div>
                 </div>`
            }
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;background:rgba(29,158,117,0.06);border:1px solid rgba(29,158,117,0.18);border-radius:8px;padding:10px 14px;margin-top:12px;">
          <span style="font-size:18px;line-height:1;flex-shrink:0;">👇</span>
          <div>
            <div style="font-size:11px;font-weight:600;color:#1D9E75;margin-bottom:2px;">Explore any historical sequence</div>
            <div style="font-size:10px;color:var(--muted);line-height:1.5;">Click any bar in the chart below to see exactly what happened — drawdowns, recovery, best and worst years, and the historical context behind that era.</div>
          </div>
        </div>
      </div>`;

  } else {
  const chartLabels = Array.from({length: xMax-xMin+1}, (_,i) => xMin+i);
  const retireIdx   = Math.max(0, Math.min(contribUntil-xMin, chartLabels.length-1));
  let datasets = [], allVals = [];

  rates.forEach((r, idx) => {
    const s   = SC[idx];
    const raw = calcSeries(r, effectiveContrib, startAge, contribUntil, startVal, xMin, xMax);
    const data= raw.map(v => v);
    allVals = allVals.concat(data);
    datasets.push({label:s.label+' '+(r*100).toFixed(1)+'%',
      data: data.map((v,i) => i<=retireIdx ? v : null),
      borderColor:s.color, backgroundColor:'transparent', borderWidth:2.5, pointRadius:0, tension:0.3, spanGaps:false});
    datasets.push({label:'_c'+idx,
      data: data.map((v,i) => i>=retireIdx ? v : null),
      borderColor:s.color, backgroundColor:'transparent', borderWidth:2, borderDash:[5,4], pointRadius:0, tension:0.3, spanGaps:false});
  });

  // Monte Carlo band
  if(useMC){
    const {p10, p50, p90} = runMonteCarlo(baseRatePct/100, effectiveContrib, startAge, contribUntil, startVal, xMin, xMax);
    const adjP10 = p10;
    const adjP50 = p50;
    const adjP90 = p90;
    allVals = allVals.concat(adjP90);
    // P90 fill top
    datasets.push({label:'MC P90', data:adjP90, borderColor:'rgba(167,139,250,0.4)', backgroundColor:'rgba(167,139,250,0.08)', fill:'+1', borderWidth:1, pointRadius:0, tension:0.3});
    // P10 fill bottom
    datasets.push({label:'MC P10', data:adjP10, borderColor:'rgba(167,139,250,0.4)', backgroundColor:'rgba(167,139,250,0.08)', fill:false, borderWidth:1, pointRadius:0, tension:0.3});
    // P50 median
    datasets.push({label:'MC Median', data:adjP50, borderColor:'#A78BFA', backgroundColor:'transparent', borderWidth:1.5, borderDash:[3,3], pointRadius:0, tension:0.3});
  }

  // No target line — removed

  // Y scale
  const fv  = allVals.filter(v => v>0 && isFinite(v));
  const mn  = Math.min(...fv);
  const mx  = Math.max(...fv);
  const rng = mx - mn;
  const yMin = Math.max(0, mn - rng * 0.05);
  const yMax = mx + rng * 0.08;

  // Key annotation ages: coast, retire, and plan end
  const annotAges  = [...new Set([contribUntil, retireAge, planUntil])].filter(a => a >= xMin && a <= xMax);
  const annotPlugin = {
    id: 'annotations',
    afterDraw(chart){
      const ctx    = chart.ctx;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      const ca     = chart.chartArea;

      // Hairlines at key ages
      annotAges.forEach(age => {        const xi  = chartLabels.indexOf(age);
        if(xi < 0) return;
        const xPx = xScale.getPixelForValue(xi);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth   = 1;
        ctx.setLineDash([3,4]);
        ctx.beginPath();
        ctx.moveTo(xPx, ca.top);
        ctx.lineTo(xPx, ca.bottom);
        ctx.stroke();
        // Age label at top of hairline
        ctx.setLineDash([]);
        ctx.font      = "400 9px 'DM Mono', monospace";
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.textAlign = 'center';
        ctx.fillText(age, xPx, ca.top - 4);
        ctx.restore();
      });
    }
  };

  const ySc = {
    x:{
      ticks:{
        color:'#4A5568',
        font:{size:10,family:"'DM Mono',monospace"},
        callback:(val, i) => {
          const age  = chartLabels[i];
          if(!age) return '';
          const span = xMax - xMin;
          const step = span <= 20 ? 2 : span <= 40 ? 5 : 10;
          return (age - xMin) % step === 0 ? age : '';
        },
        maxRotation: 0
      },
      grid:{color:'rgba(255,255,255,0.03)'}
    },
    y:{
      min: yMin, max: yMax,
      // Keep display:true so getPixelForValue works, but hide all visual elements
      ticks:{ display:false },
      grid:{ display:false },
      border:{ display:false }
    }
  };

  // Custom crosshair plugin — vertical line + fixed top-right panel showing 3 values
  const crosshairPlugin = {
    id: 'crosshair',
    _hoverIdx: -1,
    afterEvent(chart, args){
      const e = args.event;
      if(e.type === 'mousemove'){
        const ca = chart.chartArea;
        if(e.x < ca.left || e.x > ca.right){ this._hoverIdx = -1; chart.draw(); return; }
        const totalPts = chart.data.labels.length;
        const pct      = (e.x - ca.left) / (ca.right - ca.left);
        this._hoverIdx = Math.max(0, Math.min(totalPts-1, Math.round(pct*(totalPts-1))));
        chart.draw();
      } else if(e.type === 'mouseout'){
        this._hoverIdx = -1;
        chart.draw();
      }
    },
    afterDraw(chart){
      const idx = this._hoverIdx;
      if(idx < 0) return;
      const ctx    = chart.ctx;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      const ca     = chart.chartArea;
      const age    = chart.data.labels[idx];
      const xPx    = xScale.getPixelForValue(idx);

      // Vertical crosshair line only
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(xPx, ca.top);
      ctx.lineTo(xPx, ca.bottom);
      ctx.stroke();
      ctx.restore();

      // Dots on the 3 scenario lines only (never on target)
      const scVals = [];
      SC.forEach((s, si) => {
        const sDs = chart.data.datasets[si*2];
        const cDs = chart.data.datasets[si*2+1];
        // Safety: skip if this slot is not a scenario dataset
        if(!sDs || sDs.label === 'target' || (sDs.label||'').startsWith('MC')) return;
        const val = sDs?.data[idx] ?? cDs?.data[idx];
        if(!val || val <= 0){ scVals.push(null); return; }
        scVals.push(val);
        const yPx = yScale.getPixelForValue(val);
        ctx.save();
        ctx.beginPath();
        ctx.arc(xPx, yPx, 3.5, 0, Math.PI*2);
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      });

      // Fixed info panel — top right corner of chart area
      const panelW = 130, rowH = 22, padX = 12, padY = 10;
      const rows   = SC.length + 1; // 3 scenarios + age header
      const panelH = rows * rowH + padY * 2;
      const px     = ca.right - panelW - 8;
      const py     = ca.top + 8;

      // Panel background
      ctx.save();
      ctx.fillStyle   = 'rgba(14,20,25,0.92)';
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(px, py, panelW, panelH, 7);
      ctx.fill();
      ctx.stroke();

      // Age header
      ctx.font      = "500 10px 'DM Mono', monospace";
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'left';
      ctx.fillText('Age ' + age, px + padX, py + padY + 12);

      // Divider
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(px + 6, py + padY + rowH);
      ctx.lineTo(px + panelW - 6, py + padY + rowH);
      ctx.stroke();

      // One row per scenario
      SC.forEach((s, si) => {
        const val = scVals[si];
        const rowY = py + padY + rowH * (si + 1);
        // Color swatch
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.roundRect(px + padX, rowY + 6, 8, 8, 2);
        ctx.fill();
        // Rate label
        ctx.font      = "400 9px 'DM Mono', monospace";
        ctx.fillStyle = s.color;
        ctx.textAlign = 'left';
        ctx.fillText((rates[si]*100).toFixed(1)+'%', px + padX + 12, rowY + 14);
        // Value
        ctx.font      = "600 11px 'DM Mono', monospace";
        ctx.fillStyle = val ? s.color : 'rgba(255,255,255,0.2)';
        ctx.textAlign = 'right';
        ctx.fillText(val ? fmtM(val) : '—', px + panelW - padX, rowY + 14);
      });

      ctx.restore();
    }
  };

  // Destroy chart if annotation key or crosshair plugin needs refresh
  const annotKey = annotAges.join(',');
  if(accumChart && accumChart._annotKey !== annotKey){
    accumChart.destroy();
    accumChart = null;
  }

  if(accumChart){ 
    accumChart.data.labels   = chartLabels; 
    accumChart.data.datasets = datasets; 
    accumChart.options.scales = ySc;
    accumChart.update('none'); 
  } else { 
    accumChart = new Chart(document.getElementById('gc'), {
      type:'line', 
      data:{labels:chartLabels, datasets},
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:'index', intersect:false },
        plugins:{
          legend:{display:false},
          tooltip:{enabled:false}
        },
        scales: ySc,
        animation:{duration:200}
      },
      plugins:[annotPlugin, crosshairPlugin]
    });
    accumChart._annotKey = annotKey;
  }

  // ── Goal bar — 25× spend target vs base rate projection ──
  if(State.currentTab==='accumulation'&&annualSpend>0){
    const projPort=calcAt(rates[1],effectiveContrib,startAge,contribUntil,startVal,retireAge);
    renderGoalBar(projPort,annualSpend,retireAge);
  } else {
    const gb=document.getElementById('goalBar');
    if(gb) gb.innerHTML='';
  }

  // ── Breakeven — compact cards matching stat row aesthetic ──
  const beRow = document.getElementById('beRow');
  const beItems = SC.map((s,idx) => {
    const series = calcSeries(rates[idx], effectiveContrib, startAge, contribUntil, startVal, xMin, xMax);
    const hi     = series.findIndex((v,i) => v >= target);
    const age    = hi >= 0 ? xMin + hi : null;
    return `<div class="stat" style="flex:1;">
      <div class="stat-label" style="color:${s.color}">${(rates[idx]*100).toFixed(1)}%</div>
      <div class="stat-val" style="color:${age?'var(--bull)':'var(--warn)'}">${age ? 'Age '+age : '—'}</div>
      <div class="stat-sub">${age ? 'hits '+fmtM(target) : 'not reached'}</div>
    </div>`;
  }).join('');
  beRow.innerHTML = `
    <span style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);white-space:nowrap;align-self:center;">Hits ${fmtM(target)}</span>
    ${beItems}`;

  // ── Legend ──
  const legItems=SC.map((s,i)=>`<span class="li"><span class="ll"><span class="ls" style="background:${s.color}"></span><span class="ld" style="border-color:${s.color};opacity:.5;"></span></span>${(rates[i]*100).toFixed(1)}%</span>`);
  if(useMC) legItems.push(`<span class="li"><span class="ls" style="background:#A78BFA"></span>Monte Carlo P10–P90</span>`);
  document.getElementById('legend').innerHTML=legItems.join('');
  document.getElementById('explainer').innerHTML=
    `<span style="color:#3B9EFF;">─── solid</span> = contributing ${fmtM(Math.round(effectiveContrib))}/yr &nbsp;·&nbsp; <span style="color:var(--muted);">- - - dashed</span> = coasting after age ${contribUntil}`;
  } // end accumulation else block

  // ── Advanced: accumulation historical ──
  if(State.accumMode==='advanced'){
    const years=retireAge-startAge;
    if(years>0&&years<=SHILLER.length){
      const h=histAccum(startVal,effectiveContrib,contribUntil,startAge,years,feesRate);
      document.getElementById('accumHistStats').innerHTML=`
        <div class="hist-cell"><div class="hist-lbl">P10 (rough start)</div><div class="hist-val">${fmtM(h.p10)}</div></div>
        <div class="hist-cell"><div class="hist-lbl">Median</div><div class="hist-val" style="color:var(--bull)">${fmtM(h.p50)}</div></div>
        <div class="hist-cell"><div class="hist-lbl">P90 (great start)</div><div class="hist-val">${fmtM(h.p90)}</div></div>
        <div class="hist-cell"><div class="hist-lbl">Worst (${h.worst.yr})</div><div class="hist-val" style="color:var(--warn)">${fmtM(h.worst.val)}</div></div>
        <div class="hist-cell"><div class="hist-lbl">Best (${h.best.yr})</div><div class="hist-val" style="color:var(--bull)">${fmtM(h.best.val)}</div></div>
        <div class="hist-cell"><div class="hist-lbl">Windows tested</div><div class="hist-val">${h.results.length}</div></div>`;

      // Chart subtitle
      document.getElementById('accumHistDetail').innerHTML=`
        <div style="font-size:10px;color:var(--muted);margin-bottom:8px;line-height:1.6;">
          <strong style="color:var(--text);">X-axis = year you started investing.</strong> Each bar shows your portfolio at retirement
          if you had followed this exact plan starting that year, using actual US market returns.
          Hover any bar for details.
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:var(--muted);">
          <span><span style="color:var(--bull);">■</span> Hit ${fmtM(target)} target</span>
          <span><span style="color:var(--warn);">■</span> Missed target</span>
          <span>${h.results.length} historical ${years}-year windows</span>
        </div>`;

      const labels=h.results.map(r=>r.yr);
      const vals=h.results.map(r=>r.val);
      const colors=vals.map(v=>v>=target?'rgba(34,211,160,0.7)':'rgba(251,146,60,0.7)');
      const scAdv={
        x:{
          ticks:{color:'#4A5568',font:{size:9,family:"'DM Mono',monospace"},
            maxTicksLimit:20, // show more ticks so 1930s are visible
            callback:(val,i)=>{ const y=labels[i]; return y%10===0?y:''; }
          },
          grid:{display:false}
        },
        y:{ticks:{color:'#4A5568',font:{size:9,family:"'DM Mono',monospace"},callback:v=>fmtMs(v),maxTicksLimit:5},grid:{color:'rgba(255,255,255,0.04)'}}
      };
      const accumTooltip={callbacks:{label:ctx=>{
        const yr=labels[ctx.dataIndex];
        const val=ctx.parsed.y;
        const hit=val>=target;
        return [` Started investing: ${yr}`,` Portfolio at retirement: ${fmtM(val)}`,` ${hit?'✓ Hit target':'✗ Missed target'} (${fmtM(target)})`];
      }}};
      if(State.advAccumChart){State.advAccumChart.destroy();State.advAccumChart=null;}
      State.advAccumChart=new Chart(document.getElementById('gcAdv'),{
        type:'bar',
        data:{labels,datasets:[{data:vals,backgroundColor:colors,borderWidth:0,borderRadius:2}]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:accumTooltip},
          scales:scAdv}
      });
    }
  }

  // ── Fan chart + SORR: always shown on withdrawal tab ──
  if(State.currentTab==='withdrawal'){
    const years=planUntil-retireAge;
    if(years>0&&years<=SHILLER.length){
      const portOverrideFan = pm(document.getElementById('wdPortOverride').value);
      const portBase = portOverrideFan > 0 ? portOverrideFan : calcAt(rates[1], effectiveContrib, startAge, contribUntil, startVal, retireAge);
      const allocFan = getAlloc();
      const h=histWithdraw(portBase,annualSpend,retireAge,planUntil,State.oneTimeEvents,ssIncome,ssAge,feesRate,
        allocFan.valid?allocFan.s:1, allocFan.valid?allocFan.b:0, allocFan.valid?allocFan.c:0,
        document.getElementById('rebalToggle').checked);

      const withdrawYears=planUntil-retireAge;
      const ages=Array.from({length:withdrawYears+1},(_,i)=>retireAge+i);

      // Values already in real terms (real Shiller returns + flat real spend)
      const deflSeries=r=>r.wdSeries; // no deflation needed

      // Percentile bands
      const p10s=[],p25s=[],p50s=[],p75s=[],p90s=[];
      for(let i=0;i<=withdrawYears;i++){
        const vals=h.results.map(r=>r.wdSeries[i]).filter(v=>isFinite(v)&&v>=0).sort((a,b)=>a-b);
        p10s.push(vals[Math.floor(vals.length*.10)]||0);
        p25s.push(vals[Math.floor(vals.length*.25)]||0);
        p50s.push(vals[Math.floor(vals.length*.50)]||0);
        p75s.push(vals[Math.floor(vals.length*.75)]||0);
        p90s.push(vals[Math.floor(vals.length*.90)]||0);
      }

      const inflLabel='real · Shiller';
      const worstLine=h.results.reduce((a,b)=>a.val<b.val?a:b);
      const wdYMax=Math.ceil(Math.max(...p90s.filter(v=>isFinite(v)&&v>0),100000)*1.15/100000)*100000;

      if(State.advWdChart){State.advWdChart.destroy();State.advWdChart=null;}

      const fanDatasets=[];
      fanDatasets.push({data:p90s,borderColor:'rgba(29,158,117,0)',backgroundColor:'rgba(29,158,117,0.07)',fill:'+1',borderWidth:0,pointRadius:0,tension:0.4});
      fanDatasets.push({data:p10s,borderColor:'rgba(29,158,117,0)',backgroundColor:'rgba(29,158,117,0.07)',fill:false,borderWidth:0,pointRadius:0,tension:0.4});
      fanDatasets.push({data:p75s,borderColor:'rgba(29,158,117,0)',backgroundColor:'rgba(29,158,117,0.13)',fill:'+1',borderWidth:0,pointRadius:0,tension:0.4});
      fanDatasets.push({data:p25s,borderColor:'rgba(29,158,117,0)',backgroundColor:'rgba(29,158,117,0.13)',fill:false,borderWidth:0,pointRadius:0,tension:0.4});
      fanDatasets.push({label:'Worst ('+worstLine.yr+')',data:deflSeries(worstLine),borderColor:'rgba(186,117,23,0.75)',backgroundColor:'transparent',borderWidth:1.5,borderDash:[5,3],pointRadius:0,tension:0.4});
      fanDatasets.push({label:'Median',data:p50s,borderColor:'#1D9E75',backgroundColor:'transparent',borderWidth:2.5,pointRadius:0,tension:0.4});

      const fanAnnotPlugin={id:'fanAnnot',afterDraw(chart){
        const ctx=chart.ctx,xSc=chart.scales.x,ySc=chart.scales.y,ca=chart.chartArea;
        ctx.save();
        // Depleted zone
        const zeroY=ySc.getPixelForValue(0);
        ctx.fillStyle='rgba(226,75,74,0.05)';
        ctx.fillRect(ca.left,zeroY,ca.right-ca.left,ca.bottom-zeroY);
        ctx.strokeStyle='rgba(226,75,74,0.25)';ctx.lineWidth=0.75;ctx.setLineDash([3,4]);
        ctx.beginPath();ctx.moveTo(ca.left,zeroY);ctx.lineTo(ca.right,zeroY);ctx.stroke();
        ctx.setLineDash([]);ctx.font="9px 'DM Mono',monospace";
        ctx.fillStyle='rgba(226,75,74,0.55)';ctx.textAlign='left';
        ctx.fillText('depleted',ca.left+6,Math.min(zeroY+12,ca.bottom-3));
        // Retirement start point — prominent dot + pill label
        if(p50s[0]>0){
          const startY=ySc.getPixelForValue(p50s[0]);
          // Tick on left axis
          ctx.strokeStyle='rgba(29,158,117,0.6)';ctx.lineWidth=2;ctx.setLineDash([]);
          ctx.beginPath();ctx.moveTo(ca.left-6,startY);ctx.lineTo(ca.left+6,startY);ctx.stroke();
          // Dot on median line start
          ctx.beginPath();ctx.arc(ca.left,startY,5,0,Math.PI*2);
          ctx.fillStyle='#1D9E75';ctx.fill();
          ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=1.5;ctx.stroke();
          // Pill label
          const lbl='Start: '+fmtMs(portBase);
          ctx.font="600 11px 'DM Mono',monospace";
          const lw=ctx.measureText(lbl).width,lp=lw+14,lh=22;
          const lx=ca.left+14,ly=startY-lh/2;
          ctx.fillStyle='rgba(29,158,117,0.18)';ctx.strokeStyle='rgba(29,158,117,0.5)';ctx.lineWidth=1;
          ctx.beginPath();ctx.roundRect(lx,ly,lp,lh,5);ctx.fill();ctx.stroke();
          ctx.fillStyle='#1D9E75';ctx.textAlign='left';ctx.fillText(lbl,lx+7,ly+15);
        }
        // End labels
        const ex=ca.right+8;
        const endLabels=[
          {val:p90s[p90s.length-1],label:'p90',color:'rgba(29,158,117,0.65)'},
          {val:p50s[p50s.length-1],label:'median',color:'#1D9E75',bold:true},
          {val:p10s[p10s.length-1],label:'p10',color:'rgba(29,158,117,0.65)'},
          {val:worstLine.wdSeries[withdrawYears],label:'worst',color:'rgba(186,117,23,0.8)'},
        ];
        const placed=[];
        endLabels.forEach(el=>{
          let ey=ySc.getPixelForValue(Math.max(0,el.val));
          placed.forEach(p=>{if(Math.abs(ey-p)<20)ey=p+20;});
          placed.push(ey);
          ctx.font=(el.bold?'500 ':'400 ')+"10px 'DM Mono',monospace";
          ctx.fillStyle=el.color;ctx.textAlign='left';
          ctx.fillText(el.val>0?fmtMs(el.val):'$0',ex,ey);
          ctx.font="8px 'DM Mono',monospace";ctx.fillStyle='rgba(74,85,104,0.8)';
          ctx.fillText(el.label,ex,ey+11);
        });
        ctx.restore();
      }};

      // Hover pill plugin — shows median value pill as mouse moves along x-axis
      const hoverPillPlugin={id:'hoverPill',_hoverIdx:-1,
        afterEvent(chart,args){
          const e=args.event;
          if(e.type==='mousemove'){
            const ca=chart.chartArea;
            if(e.x<ca.left||e.x>ca.right){this._hoverIdx=-1;chart.draw();return;}
            const pct=(e.x-ca.left)/(ca.right-ca.left);
            this._hoverIdx=Math.max(0,Math.min(ages.length-1,Math.round(pct*(ages.length-1))));
            chart.draw();
          } else if(e.type==='mouseout'){this._hoverIdx=-1;chart.draw();}
        },
        afterDraw(chart){
          const idx=this._hoverIdx;
          if(idx<0) return;
          const ctx=chart.ctx,xSc=chart.scales.x,ySc=chart.scales.y,ca=chart.chartArea;
          const xPx=xSc.getPixelForValue(idx);
          const medVal=p50s[idx];
          if(!medVal||medVal<=0) return;
          const yPx=ySc.getPixelForValue(medVal);
          // Dot on median line
          ctx.save();
          ctx.beginPath();ctx.arc(xPx,yPx,4,0,Math.PI*2);
          ctx.fillStyle='#1D9E75';ctx.fill();
          ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1;ctx.stroke();
          // Pill label — age + median value, flip left near right edge
          const txt='age '+ages[idx]+' · '+fmtMs(medVal);
          ctx.font="500 10px 'DM Mono',monospace";
          const tw=ctx.measureText(txt).width,pw=tw+14,ph=20;
          const flipLeft=xPx+pw+12>ca.right;
          const px=flipLeft?xPx-pw-8:xPx+8, py=yPx-ph/2;
          ctx.fillStyle='rgba(14,20,25,0.9)';ctx.strokeStyle='rgba(29,158,117,0.5)';ctx.lineWidth=1;
          ctx.beginPath();ctx.roundRect(px,py,pw,ph,5);ctx.fill();ctx.stroke();
          ctx.fillStyle='#1D9E75';ctx.textAlign='left';ctx.fillText(txt,px+7,py+14);
          ctx.restore();
        }
      };

      State.advWdChart=new Chart(document.getElementById('gcWdAdv'),{
        type:'line',data:{labels:ages,datasets:fanDatasets},
        options:{responsive:true,maintainAspectRatio:false,
          layout:{padding:{right:55}},
          plugins:{legend:{display:false},tooltip:{enabled:false}},
          scales:{
            x:{ticks:{color:'#4A5568',font:{size:10,family:"'DM Mono',monospace"},maxTicksLimit:8},grid:{color:'rgba(255,255,255,0.025)'},title:{display:true,text:'Age during retirement',color:'#4A5568',font:{size:9}}},
            y:{min:0,max:wdYMax,ticks:{color:'#4A5568',font:{size:10,family:"'DM Mono',monospace"},callback:v=>fmtMs(v),maxTicksLimit:7},grid:{color:'rgba(255,255,255,0.025)'},title:{display:true,text:'Portfolio value · today\'s $',color:'#4A5568',font:{size:9}}}
          },animation:{duration:200}},
        plugins:[fanAnnotPlugin,hoverPillPlugin]
      });

      // portBase shown in hero cards above — no separate stats grid needed

      const notableTxt=h.notable.map(({yr,r})=>
        `<span style="color:${r.survived?'var(--bull)':'var(--warn)'};">${yr}: ${r.survived?fmtM(r.val)+' left':'depleted yr '+(r.dep||'?')}</span>`
      ).join(' &nbsp;·&nbsp; ');
      document.getElementById('wdHistDetail').innerHTML=`
        <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:var(--muted);margin-bottom:5px;align-items:center;">
          <span><span style="display:inline-block;width:14px;height:2.5px;background:#1D9E75;vertical-align:middle;margin-right:3px;border-radius:1px;"></span>median</span>
          <span><span style="display:inline-block;width:14px;height:8px;background:rgba(29,158,117,0.2);vertical-align:middle;margin-right:3px;border-radius:2px;"></span>p25–p75</span>
          <span><span style="display:inline-block;width:14px;height:8px;background:rgba(29,158,117,0.08);vertical-align:middle;margin-right:3px;border-radius:2px;"></span>p10–p90</span>
          <span><span style="display:inline-block;width:14px;height:2px;background:rgba(186,117,23,0.7);vertical-align:middle;margin-right:3px;border-radius:1px;"></span>worst (${worstLine.yr})</span>
          <span>${h.total} windows · each line = one starting year · $${(annualSpend/1000).toFixed(0)}k/yr · real $</span>
        </div>
        <div style="font-size:10px;color:var(--muted);">Notable: ${notableTxt}</div>`;

      // ── SORR bar chart: years survived + estate line overlay ──
      document.getElementById('sorrTitle').innerHTML=`
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px;">Sequence of Returns Risk · by retirement start year<span class="tip" data-tip="Same portfolio, same spending — but retiring into a crash (1966, 2000) vs a bull market (1982) produces wildly different outcomes. Click any bar to explore that sequence.">?</span></div>
        <div style="font-size:10px;color:var(--muted);margin-bottom:10px;">
          <span style="color:rgba(29,158,117,0.8);">■</span> bars = years portfolio lasted &nbsp;·&nbsp;
          <span style="color:rgba(250,210,60,0.9);">─</span> line = final estate (survived only) · real $
        </div>`;
      const sorrLabels=h.results.map(r=>r.yr);
      const sorrYrs=h.results.map(r=>r.survived?withdrawYears:(r.dep||0));
      const sorrEstate=h.results.map(r=>r.survived?r.val:null);
      const sorrColors=h.results.map(r=>r.survived?'rgba(29,158,117,0.55)':'rgba(251,146,60,0.70)');
      const maxEstate=Math.max(...sorrEstate.filter(v=>v!=null),1);
      const sorrSc={
        x:{ticks:{color:'#4A5568',font:{size:9,family:"'DM Mono',monospace"},callback:(_,i)=>sorrLabels[i]%10===0?sorrLabels[i]:'',maxRotation:0},grid:{display:false}},
        yLeft:{type:'linear',position:'left',min:0,max:withdrawYears,
           ticks:{color:'#4A5568',font:{size:9,family:"'DM Mono',monospace"},callback:v=>'yr '+v,maxTicksLimit:6},
           grid:{color:'rgba(255,255,255,0.04)'},
           title:{display:true,text:'Years lasted',color:'#4A5568',font:{size:9}}},
        yRight:{type:'linear',position:'right',min:0,max:Math.ceil(maxEstate*1.1/100000)*100000,
           ticks:{color:'rgba(250,210,60,0.7)',font:{size:9,family:"'DM Mono',monospace"},callback:v=>fmtMs(v),maxTicksLimit:6},
           grid:{display:false},
           title:{display:true,text:'Estate · real $',color:'rgba(250,210,60,0.7)',font:{size:9}}}
      };
      if(window._sorrChart){window._sorrChart.destroy();window._sorrChart=null;}
      // Store context for explorer — read allocation locally for this block
      const sorrAlloc=getAlloc();
      const sorrS=sorrAlloc.valid?sorrAlloc.s:1, sorrB=sorrAlloc.valid?sorrAlloc.b:0, sorrC=sorrAlloc.valid?sorrAlloc.c:0;
      State.sorrExplorerCtx={h, retireAge, planUntil, annualSpend, taxRate, portBase, stkPct:sorrS, bndPct:sorrB, cshPct:sorrC};
      // If a year was previously selected, refresh explorer with new data instead of clearing
      if(State.sorrSelectedIdx>=0) showSeqExplorer(State.sorrSelectedIdx);

      // Custom hover plugin for SORR — pill on estate line, bar info in tooltip
      const sorrHoverPlugin={id:'sorrHover',_idx:-1,
        afterEvent(chart,args){
          const e=args.event;
          const ca=chart.chartArea;
          if(!ca) return;
          if(e.type==='mousemove'){
            if(e.x<ca.left||e.x>ca.right){this._idx=-1;chart.draw();return;}
            const pct=(e.x-ca.left)/(ca.right-ca.left);
            this._idx=Math.max(0,Math.min(sorrLabels.length-1,Math.round(pct*(sorrLabels.length-1))));
            chart.draw();
          } else if(e.type==='mouseout'){this._idx=-1;chart.draw();}
        },
        afterDraw(chart){
          const idx=this._idx;
          if(idx<0) return;
          const ctx=chart.ctx,xSc=chart.scales.x,yR=chart.scales.yRight,yL=chart.scales.yLeft,ca=chart.chartArea;
          const xPx=xSc.getPixelForValue(idx);
          const estateVal=sorrEstate[idx];
          const yr=sorrLabels[idx];
          const r=h.results[idx];
          const yrs=r.survived?withdrawYears:(r.dep||0);

          // Bar hover: vertical line + bar info pill on left axis
          ctx.save();
          ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1;ctx.setLineDash([]);
          ctx.beginPath();ctx.moveTo(xPx,ca.top);ctx.lineTo(xPx,ca.bottom);ctx.stroke();

          // Bar pill (years info) — rendered near top to avoid overlap with short bars
          const barTxt=yr+' · '+(r.survived?yrs+' yrs ✓':'depleted yr '+yrs);
          ctx.font="500 10px 'DM Mono',monospace";
          const btw=ctx.measureText(barTxt).width, bpw=btw+14, bph=18;
          const bFlip=xPx+bpw+10>ca.right;
          const bpx=bFlip?xPx-bpw-6:xPx+6, bpy=ca.top+8;
          ctx.fillStyle='rgba(14,20,25,0.88)';
          ctx.strokeStyle=r.survived?'rgba(29,158,117,0.5)':'rgba(251,146,60,0.5)';ctx.lineWidth=1;
          ctx.beginPath();ctx.roundRect(bpx,bpy,bpw,bph,4);ctx.fill();ctx.stroke();
          ctx.fillStyle=r.survived?'#1D9E75':'#FB923C';ctx.textAlign='left';
          ctx.fillText(barTxt,bpx+7,bpy+13);

          // Estate pill on the line (only if survived)
          if(estateVal!=null&&yR){
            const eyPx=yR.getPixelForValue(estateVal);
            // Dot on line
            ctx.beginPath();ctx.arc(xPx,eyPx,4,0,Math.PI*2);
            ctx.fillStyle='rgba(250,210,60,0.9)';ctx.fill();
            ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1;ctx.stroke();
            // Pill
            const etxt='$'+fmtMs(estateVal)+' estate';
            ctx.font="500 10px 'DM Mono',monospace";
            const etw=ctx.measureText(etxt).width,epw=etw+14,eph=18;
            const eFlip=xPx+epw+10>ca.right;
            const epx=eFlip?xPx-epw-6:xPx+6, epy=eyPx-eph/2;
            ctx.fillStyle='rgba(14,20,25,0.88)';ctx.strokeStyle='rgba(250,210,60,0.5)';ctx.lineWidth=1;
            ctx.beginPath();ctx.roundRect(epx,epy,epw,eph,4);ctx.fill();ctx.stroke();
            ctx.fillStyle='rgba(250,210,60,0.95)';ctx.textAlign='left';
            ctx.fillText(etxt,epx+7,epy+13);
          }
          ctx.restore();
        }
      };

      // Click handler for SORR bars
      const sorrClickPlugin={id:'sorrClick',
        afterEvent(chart,args){
          const e=args.event;
          if(e.type!=='click') return;
          const ca=chart.chartArea;
          if(!ca||e.x<ca.left||e.x>ca.right) return;
          const pct=(e.x-ca.left)/(ca.right-ca.left);
          const idx=Math.max(0,Math.min(sorrLabels.length-1,Math.round(pct*(sorrLabels.length-1))));
          if(State.sorrSelectedIdx===idx){
            // Deselect
            State.sorrSelectedIdx=-1;
            chart.data.datasets[0].backgroundColor=sorrColors;
            chart.update('none');
            document.getElementById('wdSeqExplorer').style.display='none';
          } else {
            State.sorrSelectedIdx=idx;
            State.sorrPulseShown=true; // dismiss pulse after first interaction
            // Dim all bars, highlight selected
            chart.data.datasets[0].backgroundColor=sorrColors.map((c,i)=>
              i===idx?c:c.replace(/[\d.]+\)$/,'0.18)')
            );
            chart.update('none');
            showSeqExplorer(idx);
            document.getElementById('wdSeqExplorer').scrollIntoView({behavior:'smooth',block:'nearest'});
          }
        }
      };

      // Pulse plugin — draws animated dot on worst bar on first load
      const worstIdx = h.results.findIndex(r=>r.yr===h.worst.yr);
      const sorrPulsePlugin={id:'sorrPulse',
        afterDraw(chart){
          if(State.sorrPulseShown||State.sorrSelectedIdx>=0||worstIdx<0) return;
          const ctx=chart.ctx,xSc=chart.scales.x,yL=chart.scales.yLeft,ca=chart.chartArea;
          if(!xSc||!yL) return;
          const xPx=xSc.getPixelForValue(worstIdx);
          const barTopY=yL.getPixelForValue(sorrYrs[worstIdx]); // top of the worst bar
          const dotY=barTopY-10; // just above the bar
          const now=Date.now();
          const t=(Math.sin(now/500)+1)/2;
          ctx.save();
          // Pulse ring
          ctx.beginPath();
          ctx.arc(xPx,dotY,5+t*7,0,Math.PI*2);
          ctx.fillStyle=`rgba(29,158,117,${0.2*(1-t)})`;
          ctx.fill();
          // Solid dot
          ctx.beginPath();
          ctx.arc(xPx,dotY,5,0,Math.PI*2);
          ctx.fillStyle='#1D9E75';ctx.fill();
          ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=1;ctx.stroke();
          // Callout pill — above the dot, clamped inside canvas
          const lbl=`↓ Click to explore ${h.worst.yr}`;
          ctx.font="600 10px 'DM Mono',monospace";
          const lw=ctx.measureText(lbl).width,pw=lw+16,ph=20;
          const idealX=xPx-pw/2;
          const pillX=Math.max(ca.left+2,Math.min(ca.right-pw-2,idealX));
          const pillY=Math.max(ca.top+4,dotY-ph-10);
          ctx.fillStyle='rgba(14,20,25,0.92)';
          ctx.strokeStyle='rgba(29,158,117,0.6)';ctx.lineWidth=1;
          ctx.beginPath();ctx.roundRect(pillX,pillY,pw,ph,5);ctx.fill();ctx.stroke();
          ctx.fillStyle='#1D9E75';ctx.textAlign='left';
          ctx.fillText(lbl,pillX+8,pillY+14);
          ctx.restore();
        }
      };

      // Drive the pulse animation with a standalone rAF loop
      (function animatePulse(){
        if(State.sorrPulseShown) return;
        if(window._sorrChart) window._sorrChart.draw();
        requestAnimationFrame(animatePulse);
      })();

      window._sorrChart=new Chart(document.getElementById('gcSorr'),{
        data:{labels:sorrLabels,datasets:[
          {type:'bar',data:sorrYrs,backgroundColor:sorrColors,borderWidth:0,borderRadius:2,yAxisID:'yLeft'},
          {type:'line',data:sorrEstate,borderColor:'rgba(250,210,60,0.85)',backgroundColor:'transparent',borderWidth:2,pointRadius:0,tension:0.3,yAxisID:'yRight',spanGaps:false}
        ]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{enabled:false}},
          scales:sorrSc,
          onClick:(e,els,chart)=>{}},
        plugins:[sorrHoverPlugin,sorrClickPlugin,sorrPulsePlugin]
      });
      // Store base colors for reset
      window._sorrChart._sorrColors=[...sorrColors];
    }
  }
}



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