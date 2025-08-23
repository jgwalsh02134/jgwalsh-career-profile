// Canonicalize text to avoid Unicode pitfalls (smart quotes, dashes, accents)
// Threat Triage widget — online-fix-1 bootstrap glue
// (Scoring & rendering functions below remain unchanged.)

function toast(msg){
  let t = document.getElementById('tt-toast');
  if(!t){ t=document.createElement('div'); t.id='tt-toast'; t.style.cssText='position:fixed;right:16px;bottom:16px;background:#111;color:#fff;padding:8px 12px;border-radius:8px;z-index:9999;font:13px system-ui'; document.body.appendChild(t); }
  t.textContent = msg; setTimeout(()=>{ if(t) t.remove(); }, 2000);
}

console.log('[TT] widget loaded');
if (document.readyState !== 'loading') toast('triage JS ready');
else document.addEventListener('DOMContentLoaded', ()=>toast('triage JS ready'));

function ensureIds(){ 
  ['run','clearText','narrative','caseSelect'].forEach(id=>{
    if(!document.getElementById(id)) console.error('[TT] Missing element:', id);
  });
}

function tt(s){ console.log('[TT]', s); }
function ttStatus(s){ const el=document.getElementById('tt-status'); if(el) el.textContent=s; }
function ttErr(e){ const el=document.getElementById('tt-err'); if(el) el.textContent=e?String(e):'—'; }

// Keep last run state for copy/download/toggle handlers
let __LAST_RESULT__ = null;
let __LAST_TEXT__ = '';
let __LAST_RUBRIC__ = null;

function buildMarkdownReport(result, rawText){
  if(!result) return '# Threat Triage\n\nNo results yet. Use "Run Triage" first.';
  const { totals, flags, sub, conf } = result;
  const esc = s => String(s||'').replace(/[\u0000-\u001F]/g,'').trim();
  return `# Behavioral Threat Triage\n\n`+
    `- Band: **${totals.band.label}**\n`+
    `- Score: **${totals.score}**\n`+
    `- Confidence: **${conf.label}**\n\n`+
    `## Detected Signals\n`+
    `- Direct: ${flags.direct?'yes':'no'}\n`+
    `- Means: ${flags.means?'yes':'no'}\n`+
    `- Time-specific: ${flags.timeSpecific?'yes':'no'}\n`+
    `- Leakage: ${flags.leakage?'yes':'no'}\n`+
    `- Fixation: ${flags.fixation?'yes':'no'}\n\n`+
    `## Subscores\n`+
    `- BTAM: ${sub.btam.score} (${sub.btam.hits.join(', ')||'—'})\n`+
    `- TRAP-18: ${sub.trap18.score} (${sub.trap18.hits.join(', ')||'—'})\n`+
    `- HCR-20: ${sub.hcr20.score} (${sub.hcr20.hits.join(', ')||'—'})\n`+
    `- Lexical: ${sub.lenses.score} (${sub.lenses.hits.join(', ')||'—'})\n`+
    `- Protective: ${sub.protective.score} (${sub.protective.hits.join(', ')||'—'})\n\n`+
    `## Narrative\n`+
    `> ${esc(rawText)}`;
}

async function render(result, rubric, rawText){
  __LAST_RESULT__ = result; __LAST_RUBRIC__ = rubric; __LAST_TEXT__ = rawText;
  ttStatus('rendering'); setDiag({ status:'rendering', err:'' });
  try{
    renderResults(result, rubric, rawText);
    const aiOn = !!document.getElementById('aiAssist')?.checked;
    if (aiOn) {
      setDiag({ ai:'on', status:'ai…' });
      const ai = await fetchAIExplainSafe(rawText, result.totals.band, result.sub, {
        btam: result.sub.btam.hits,
        trap18: result.sub.trap18.hits,
        hcr20: result.sub.hcr20.hits,
        lexical: result.sub.lenses.hits,
        protective: result.sub.protective.hits
      }, result.dampen);
      if (ai) renderComprehensiveReport({ ai });
      else { renderComprehensiveReport({ deterministic: result.trace.matches }); setDiag({ err:'AI unavailable' }); }
    } else {
      setDiag({ ai:'off', status:'ok', err:'' });
      renderComprehensiveReport({ deterministic: result.trace.matches });
    }
    ttStatus('ok');
  }catch(e){ ttErr(e?.message||String(e)); setDiag({ status:'error', err:e?.message||String(e) }); console.error('[TT] render error', e); }
}

function bindButtons(){
  const runBtn = document.getElementById('run');
  const clrBtn = document.getElementById('clearText');
  if (runBtn && !runBtn.__tt){ runBtn.addEventListener('click', runTriageOnce); runBtn.__tt=true; console.log('[TT] bound run'); }
  if (clrBtn && !clrBtn.__tt){ clrBtn.addEventListener('click', ()=>{ const ta=document.getElementById('narrative'); if(ta) ta.value=''; const ra=document.getElementById('resultsArea'); if(ra) ra.style.display='none'; }, { passive:true }); clrBtn.__tt=true; console.log('[TT] bound clear'); }
  const copyBtn = document.getElementById('copyReport');
  if (copyBtn && !copyBtn.__tt){ copyBtn.addEventListener('click', ()=>{ try{ const md = buildMarkdownReport(__LAST_RESULT__, __LAST_TEXT__); navigator.clipboard.writeText(md).then(()=>toast('Report copied')); }catch(e){ toast('Copy failed'); console.error(e); } }, { passive:true }); copyBtn.__tt=true; console.log('[TT] bound copy'); }
  const dlBtn = document.getElementById('downloadBtn');
  if (dlBtn && !dlBtn.__tt){ dlBtn.addEventListener('click', ()=>{ try{ if(!__LAST_RESULT__){ toast('Run triage first'); return; } const data = { input: __LAST_TEXT__, case: __LAST_RESULT__.case||null, results: __LAST_RESULT__ }; const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); const ts=new Date().toISOString().replace(/[:.]/g,'-'); a.download=`triage-result-${ts}.json`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); }catch(e){ toast('Download failed'); console.error(e); } }, { passive:true }); dlBtn.__tt=true; console.log('[TT] bound download'); }
  const benchBtn = document.getElementById('runBenchmarks');
  if (benchBtn && !benchBtn.__tt){ benchBtn.addEventListener('click', async ()=>{ try{ const r = await loadRubricOnce(); runBenchmarksUI(r); toast('Benchmarks ran (see table)'); }catch(e){ toast('Benchmarks failed'); console.error(e); } }, { passive:true }); benchBtn.__tt=true; console.log('[TT] bound benchmarks'); }
  const testsBtn = document.getElementById('ttRunTests');
  if (testsBtn && !testsBtn.__tt){ testsBtn.addEventListener('click', async ()=>{ try{ const r = await loadRubricOnce(); runQuickTests(r); toast('Quick tests logged to console'); }catch(e){ toast('Tests failed'); console.error(e); } }, { passive:true }); testsBtn.__tt=true; console.log('[TT] bound tests'); }
  const aiTgl = document.getElementById('aiAssist');
  if (aiTgl && !aiTgl.__tt){ aiTgl.addEventListener('change', ()=>{ if(__LAST_RESULT__ && __LAST_RUBRIC__){ render(__LAST_RESULT__, __LAST_RUBRIC__, __LAST_TEXT__); } }, { passive:true }); aiTgl.__tt=true; console.log('[TT] bound ai toggle'); }
  const showRubricTgl = document.getElementById('showRubric');
  if (showRubricTgl && !showRubricTgl.__tt){ showRubricTgl.addEventListener('change', ()=>{ if(__LAST_RESULT__ && __LAST_RUBRIC__){ // re-run renderResults to update rubric visibility
      renderResults(__LAST_RESULT__, __LAST_RUBRIC__, __LAST_TEXT__);
    } }, { passive:true }); showRubricTgl.__tt=true; console.log('[TT] bound showRubric'); }
  document.addEventListener('click', (ev)=>{ if (ev.target && ev.target.id === 'run') runTriageOnce(); }, { once: true });
}

// Removed older wireCaseSelect in favor of wireCaseSelector()

let __RUBRIC__=null;
async function loadRubricOnce(){
  if(__RUBRIC__) return __RUBRIC__;
  const r = await fetch('./rubric.json?v=online-fix-1',{cache:'no-store'}).catch(()=>null);
  if(!r || !r.ok) throw new Error('rubric load failed');
  __RUBRIC__ = await r.json(); 
  return __RUBRIC__;
}

async function runTriageOnce(){
  try{
    const txt = document.getElementById('narrative')?.value || '';
    const rubric = await loadRubricOnce();
    if (typeof aggregate !== 'function') throw new Error('aggregate missing');
    const result = aggregate(txt, rubric);
    await render(result, rubric, txt);
    console.log('[TT] triage ok', result?.totals);
  }catch(e){ console.error('[TT] triage error', e); toast('Run failed: '+ (e?.message||e)); }
}

(function boot(){
  const start = ()=>{ 
    try { ensureIds(); wireCaseSelector(); bindButtons(); console.log('[TT] boot ok'); }
    catch(e){ console.error('[TT] boot error', e); toast('Boot error: '+(e?.message||e)); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
function canonicalize(s) {
  if (!s) return '';
  let t = s.normalize ? s.normalize('NFKD') : s;
  t = t.replace(/[\u0300-\u036f]/g, '');          // remove diacritics
  t = t.replace(/[‘’´`]/g, "'")                    // smart apostrophes -> '
       .replace(/[“”]/g, '"')                      // smart quotes -> "
       .replace(/[‐-‒–—―]/g, '-')                  // hyphen/dash variants -> -
       .replace(/\u00A0/g, ' ');                   // non-breaking space -> space
  return t;
}

function normalize(text){
  return canonicalize(String(text||''))
    .toLowerCase()
    .replace(/\s+/g,' ')
    .trim();
}

// Build boundary-safe regex for a SINGLE TOKEN only
function wordBoundaryRegexToken(token){
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startB = /\w/.test(esc[0]) ? '\\b' : '';
  const endB   = /\w/.test(esc[esc.length-1]) ? '\\b' : '';
  return new RegExp(`${startB}${esc}${endB}`, 'i');
}

// Return first index of a pattern in normalized text
function indexOfPattern(normText, pattern){
  const p = normalize(pattern);
  if (!p) return -1;
  const isMultiWord = /\s/.test(p);
  if (isMultiWord) {
    return normText.indexOf(p); // phrase search (no word boundaries)
  } else {
    const rx = wordBoundaryRegexToken(p);
    const m = rx.exec(normText);
    return m ? m.index : -1;
  }
}

// Single source of truth for cases (narratives + labels)
const CASE_EXAMPLES = {
  virginia:  "I’ll get him back tomorrow. He’ll be sorry he ever messed with me. Everyone will see what happens at school.",
  disability:"I might as well bring something to school. People laugh at me every day. Maybe then they’ll take me seriously.",
  employee:  "At the front desk the terminated employee shouted: 'Tell the CEO he’s a dead man walking. You’ll all regret this.'",
  apalachee: "Nobody cares now, but they will after tomorrow. I’ll make sure my name is remembered like the others."
};
const CASE_LABELS = {
  virginia:  "Virginia School Threat",
  disability:"Student With Disability — Non-Specific Threat",
  employee:  "Ex-Employee Lobby Threat",
  apalachee: "Apalachee HS Leakage"
};
let __selectedCaseKey__ = "";
// Benchmarks for validation mode
const BENCHMARKS = [
  { key:'virginia',  label:'Virginia School Threat', text:"I’ll get him back tomorrow. He’ll be sorry he ever messed with me. Everyone will see what happens at school.", expect:'Elevated' },
  { key:'employee',  label:'Ex-Employee Lobby Threat', text:"Tell the CEO he’s a dead man walking. You’ll all regret this.", expect:'Elevated' },
  { key:'disability',label:'Student Disability Non-Specific', text:"I might bring something to school. People laugh at me every day.", expect:'Moderate' },
  { key:'negated',   label:'Negated/Joking', text:"I said I won’t do it, I’m joking — hypothetical.", expect:'Low' }
];
// Rationale dictionary
const INDICATOR_RATIONALE = {
  "Direct threat": "Explicit intent to harm elevates risk beyond vague anger.",
  "Weapon reference": "Mentions of weapons increase capability concerns.",
  "Specific target": "Naming a person/place increases directionality and planning.",
  "Time/place specificity": "Specific timing/location suggests imminence.",
  "Grievance fixation": "Persistent grievance is a common precursor signal.",
  "Leakage language": "Statements that broadcast intent or seriousness.",
  "Pathway hints (behavior)": "Behaviors consistent with preparation (e.g., buying gear, scouting).",
  "Means/access hints": "Indicates access paths or insider capability.",
  "Self-harm with others": "Mixed ideation can signal desperation/last-resort framing.",
  "Fixation": "Preoccupation with a target/issue beyond normal concern.",
  "Identification": "Adopting an avenger/attacker identity indicates escalation.",
  "Energy burst": "Sudden uptick in activity toward a goal.",
  "Novel aggression": "Initial acts of aggression can signal crossing a boundary.",
  "Last resort framing": "All-or-nothing language signals urgency.",
  "History—violence/justice": "Prior violence/justice contact increases base risk.",
  "Clinical—disturbance cues": "Active symptoms/agitation may impair judgment.",
  "Risk—situational stressors": "Acute stressors can precipitate action.",
  "Risk—lack of supports": "Isolation removes buffers against escalation."
};
function includesAny(text, patterns){return (patterns||[]).some(p=>text.includes(p));}
function bandClass(label){const L=label.toLowerCase(); if(L.startsWith('crit')) return 'badge crit'; if(L.startsWith('elev')) return 'badge elev'; if(L.startsWith('mod')) return 'badge mod'; return 'badge low';}
function clamp(x,min,max){return Math.max(min,Math.min(max,x));}

async function loadRubric(){
  const res = await fetch('./rubric.json?v=6',{cache:'no-store'});
  if(!res.ok) throw new Error(`HTTP ${res.status} loading rubric.json`);
  return res.json();
}

function findHitsBoundaryAware(text, section, negationList, windowChars){
  const t = normalize(text);
  let score = 0;
  const hits = new Set();
  const matches = [];
  (section||[]).forEach(ind=>{
    let matched=false;
    (ind.patterns||[]).forEach(rawP=>{
      const idx = indexOfPattern(t, rawP);
      if(idx>=0){
        const start = Math.max(0, idx - (windowChars||14));
        const end = Math.min(t.length, idx + (windowChars||14));
        const span = t.slice(start, end);
        const neg = (negationList||[]).some(n => span.includes(normalize(n)));
        if(!neg){ matched=true; matches.push({indicator:ind.name, pattern:normalize(rawP), index:idx}); }
      }
    });
    if(matched){ score += (ind.weight||0); hits.add(ind.name); }
  });
  return {score, hits:Array.from(hits), matches};
}

function scoreLexical(text, lenses, negationList, windowChars){
  const t = normalize(text);
  let score = 0, hits=new Set(), matches=[];
  (lenses.categories||[]).forEach(cat=>{
    let matched=false;
    (cat.patterns||[]).forEach(p=>{
      const idx = indexOfPattern(t, p);
      if(idx>=0){
        const start = Math.max(0, idx - (windowChars||14));
        const end = Math.min(t.length, idx + (windowChars||14));
        const span = t.slice(start, end);
        const neg = (negationList||[]).some(n => span.includes(normalize(n)));
        if(!neg){ matched=true; matches.push({indicator:cat.name, pattern:normalize(p), index:idx}); }
      }
    });
    if(matched){ score += (cat.weight||0); hits.add(cat.name); }
  });
  const cap = Number((lenses||{}).cap_total||3);
  return {score: Math.min(cap, Math.round(score*10)/10), hits:Array.from(hits), matches};
}

function scoreProtective(text, prot, negationList, windowChars){
  const t = normalize(text);
  let score = 0, hits=new Set(), matches=[];
  (prot.categories||[]).forEach(cat=>{
    let matched=false;
    (cat.patterns||[]).forEach(p=>{
      const idx = indexOfPattern(t, p);
      if(idx>=0){
        const start = Math.max(0, idx - (windowChars||14));
        const end = Math.min(t.length, idx + (windowChars||14));
        const span = t.slice(start, end);
        const neg = (negationList||[]).some(n => span.includes(normalize(n)));
        if(!neg){ matched=true; matches.push({indicator:cat.name, pattern:normalize(p), index:idx}); }
      }
    });
    if(matched){ score += (cat.weight||0); hits.add(cat.name); }
  });
  const cap = Number((prot||{}).cap_abs||2);
  return {score: Math.min(cap, score), hits:Array.from(hits), matches};
}

function applyDampeners(text, base, damp){
  const t = normalize(text); let s=base, applied=[];
  if(includesAny(t, damp.stopwords||[])){ s=Math.max(0,s-1); applied.push('stopwords'); }
  if(includesAny(t, damp.negation_cues||[])){ const d=Math.min(damp.max_negation_deduction||2,2); s=Math.max(0,s-d); applied.push('negation'); }
  return {score:s, applied};
}

function pickBand(score, bands){ return bands.find(b=>score>=b.min && score<=b.max) || bands[bands.length-1]; }
function renderList(ul, items){ ul.innerHTML=''; (items.length?items:['None']).forEach(x=>{ const li=document.createElement('li'); li.textContent=x; ul.appendChild(li); }); }

function derivedFlags(sub){
  return {
    direct: sub.btam.hits.includes('Direct threat'),
    means:  sub.btam.hits.includes('Means/access hints') || sub.btam.hits.includes('Weapon reference'),
    targetSpecific: sub.btam.hits.includes('Specific target'),
    timeSpecific:   sub.btam.hits.includes('Time/place specificity'),
    leakage:        sub.btam.hits.includes('Leakage language') || sub.trap18.hits.includes('Last resort framing'),
    fixation:       sub.trap18.hits.includes('Fixation')
  };
}

function confidenceFrom(text, sub, damp){
  const words = (text.trim().match(/\S+/g)||[]).length;
  const hitsN = sub.btam.hits.length + sub.trap18.hits.length + sub.hcr20.hits.length + sub.lenses.hits.length + sub.protective.hits.length;
  let c = 0.2 + Math.min(0.5, hitsN*0.07) + Math.min(0.3, words*0.005);
  if(damp.applied.includes('negation')) c -= 0.15;
  if(damp.applied.includes('stopwords')) c -= 0.10;
  c = clamp(c, 0.1, 0.95);
  const label = c>=0.75?'High': (c>=0.5?'Moderate':'Low');
  return {value:c, label};
}

function buildRecommendations(flags, band, rubric, protHits){
  const rec = { immediate:[], near_term:[], follow_up:[] };
  (rubric.actions_catalog.immediate||[]).forEach(x=>{ if(band.label!=='Low') rec.immediate.push(x); });
  (rubric.actions_catalog.near_term||[]).forEach(x=> rec.near_term.push(x));
  (rubric.actions_catalog.follow_up||[]).forEach(x=> rec.follow_up.push(x));
  if(flags.direct && flags.means && flags.timeSpecific){
    rec.immediate.unshift("Direct threat with means and time/place specificity detected → treat as near-term risk; notify duty officer now.");
  }
  if(flags.leakage){ rec.near_term.unshift("Capture leakage (screenshots/URLs) with timestamps and cryptographic hash; preserve context."); }
  if(flags.targetSpecific){ rec.near_term.unshift("Inform relevant point of contact (e.g., workplace/school admin) per policy; verify target safety."); }
  if((protHits||[]).length){ rec.follow_up.unshift("Document protective signals detected: " + protHits.join(', ') + ". Offer resources and voluntary safety planning."); }
  return rec;
}

// (Old buildReportHTML removed; replaced by executive + domain sections elsewhere)

// Escape & highlight helpers
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m]));}
function renderHighlightedNarrative(rawText, matches){
  const text = rawText||'';
  const sorted=[...(matches||[])].sort((a,b)=>a.index-b.index);
  const parts=[]; let cursor=0;
  sorted.forEach(m=>{
    if(typeof m.index!=='number') return; const i=Math.max(0,m.index);
    if(i>cursor) parts.push(escapeHtml(text.slice(cursor,i)));
    const rel=text.slice(i); const spacePos=rel.search(/\s/); const end=spacePos>-1? i+spacePos : i+rel.length;
    const frag=escapeHtml(text.slice(i,end));
    parts.push(`<mark data-indicator="${escapeHtml(m.indicator||'')}" style="padding:0 2px;border-radius:4px;">${frag}</mark>`);
    cursor=end;
  });
  parts.push(escapeHtml(text.slice(cursor)));
  return parts.join('');
}

function snippetAt(rawText, index, span=18){
  if(index<0||!rawText) return '';
  const start=Math.max(0,index-span), end=Math.min(rawText.length,index+span);
  let s=rawText.slice(start,end).replace(/\s+/g,' ');
  if(start>0) s='… '+s; if(end<rawText.length) s=s+' …';
  return s;
}

function jumpToIndicator(name){
  const el=document.querySelector(`mark[data-indicator="${CSS.escape(name)}"]`);
  if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.classList.add('pulse'); setTimeout(()=>el.classList.remove('pulse'),900);} }

function buildExecutiveHTML(caseName, totals, flags, conf){
  const wrap=document.createElement('div');
  wrap.innerHTML=`${caseName?`<div class="note"><strong>Case:</strong> ${escapeHtml(caseName)}</div>`:''}
  <div class="card"><h4 style="margin:0 0 6px;">Executive Summary</h4>
  <p><strong>Band:</strong> ${totals.band.label} &nbsp; | &nbsp; <strong>Score:</strong> ${totals.score} &nbsp; | &nbsp; <strong>Confidence:</strong> ${conf.label}</p>
  <p><strong>Immediacy:</strong> ${flags.timeSpecific? 'Near-term (≤72h) cues present.' : 'Immediacy unclear from text.'}</p>
  <p>This assessment synthesizes validated domains (BTAM, TRAP-18, HCR-20, lexical aggression, protective cues). Signals are indicators, not proof. Human review required.</p></div>`;
  return wrap;
}

function writeDomainExplain(listId, hits){
  const ul=document.getElementById(listId); if(!ul) return; ul.innerHTML='';
  if(!hits||!hits.length){ ul.innerHTML='<li>None detected.</li>'; return; }
  hits.forEach(h=>{ const li=document.createElement('li'); li.textContent=h; li.style.cursor='pointer'; li.title='Click to jump to highlight'; li.addEventListener('click',()=>jumpToIndicator(h)); ul.appendChild(li); });
}

function populateRationaleList(rawText, result, rubric){
  const ol=document.getElementById('rationaleList'); if(!ol) return; ol.innerHTML='';
  const weightMap={};
  const addW=a=> (a||[]).forEach(ind=>{ weightMap[ind.name]=ind.weight||0; });
  addW(rubric.btam_core); addW(rubric.trap18_subset); addW(rubric.hcr20_context);
  (rubric.lenses_lexical?.categories||[]).forEach(c=>{ weightMap[c.name]=c.weight||0; });
  (rubric.protective_lexical?.categories||[]).forEach(c=>{ weightMap[c.name]=-(c.weight||0); });
  const matches=(result.trace.matches)||[];
  const items=matches.map(m=>{ const li=document.createElement('li'); const w=weightMap[m.indicator]??0; const reason=INDICATOR_RATIONALE[m.indicator] || (m.indicator.toLowerCase().includes('protect')?'Protective/supportive language reduces risk.':(m.indicator.toLowerCase().includes('aggression')?'Language consistent with aggression category.':'Matched rubric indicator.')); const snip=snippetAt(rawText,m.index,24); li.innerHTML=`<div><strong>${escapeHtml(m.indicator)}</strong> <span class="note">(weight ${w>=0? '+'+w : w})</span></div><div class="note" style="margin:2px 0 6px;">Reason: ${escapeHtml(reason)}</div><div class="note" style="font-style:italic;">“… ${escapeHtml(snip)} …”</div>`; li.style.cursor='pointer'; li.addEventListener('click',()=>jumpToIndicator(m.indicator)); return li; });
  if(!items.length){ const li=document.createElement('li'); li.textContent='No indicators fired.'; items.push(li);} items.forEach(li=>ol.appendChild(li));
}

function buildCalcTrace(text, results, matches){
  const {sub, totals, dampen, flags, conf, rec} = results;
  return { lines:[
    {metric:'chars', value:text.length},
    {metric:'btam', score:sub.btam.score, hits:sub.btam.hits},
    {metric:'trap18', score:sub.trap18.score, hits:sub.trap18.hits},
    {metric:'hcr20', score:sub.hcr20.score, hits:sub.hcr20.hits},
    {metric:'lexical', score:sub.lenses.score, hits:sub.lenses.hits},
    {metric:'protective', score:sub.protective.score, hits:sub.protective.hits},
    {metric:'dampeners', applied:dampen.applied},
    {metric:'totals', band:totals.band.label, score:totals.score, confidence:conf},
    {metric:'flags', flags},
    {metric:'recCounts', immediate:rec.immediate.length, near:rec.near_term.length, follow:rec.follow_up.length}
  ], matches};
}

// === Diagnostics & AI fallback helpers (updated per new spec) ===
function setDiag({status, ai, err}) {
  if (status !== undefined) { const el = document.getElementById('diagStatus'); if (el) el.textContent = status; }
  if (ai !== undefined)     { const el = document.getElementById('diagAI');     if (el) el.textContent = ai; }
  if (err !== undefined)    { const el = document.getElementById('diagErr');    if (el) el.textContent = err || '—'; }
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  const s = String(v).trim();
  return s ? [s] : [];
}

function normalizeAI(ai) {
  if (!ai || typeof ai !== 'object') return null;
  ai.plan = ai.plan || {};
  ai.plan.immediate   = toArray(ai.plan.immediate);
  ai.plan.next_24_72  = toArray(ai.plan.next_24_72);
  ai.plan.follow_up   = toArray(ai.plan.follow_up);
  ai.caveats          = toArray(ai.caveats);
  ai.rationales = ai.rationales || { btam:'', trap18:'', hcr20:'', lexical:'', protective:'' };
  return ai;
}

async function fetchAIExplainSafe(narrative, band, subscores, hits, dampeners) {
  const body = JSON.stringify({ narrative, band, subscores, hits, dampeners });
  const headers = { 'Content-Type': 'application/json' };
  try {
  console.debug('[TT] calling AI (primary endpoint)');
    const r = await fetch('/api/triage-explain', { method:'POST', headers, body });
    if (r.ok) return normalizeAI(await r.json());
  } catch {}
  try {
  console.debug('[TT] calling AI (origin fallback)');
    const r2 = await fetch(location.origin + '/api/triage-explain', { method:'POST', headers, body });
    if (r2.ok) return normalizeAI(await r2.json());
  } catch {}
  return null;
}

function planListHtml(arr){ return (arr||[]).map(x=>`<li>${x}</li>`).join('') || '<li>None.</li>'; }

function ensureReportExecutive() {
  let el = document.getElementById('reportExecutive');
  if (!el) {
    el = document.createElement('div');
    el.id = 'reportExecutive';
    el.className = 'grid';
    el.style.gap = '10px';
    el.style.marginTop = '12px';
    (document.getElementById('resultsArea') || document.body).appendChild(el);
  }
  return el;
}

function renderAIProse(ai) {
  const exec = ensureReportExecutive();
  if (!ai) return false;
  exec.innerHTML = `
    <div class="card">
      <h4 style="margin:0 0 6px;">Executive Summary (AI-assist)</h4>
      <p>${(ai.executive||'').trim() || 'No executive summary.'}</p>
    </div>
    <div class="card">
      <h4 style="margin:0 0 6px;">Indicator Rationales</h4>
      <ul>
        <li><strong>BTAM:</strong> ${ai.rationales.btam || '—'}</li>
        <li><strong>TRAP-18:</strong> ${ai.rationales.trap18 || '—'}</li>
        <li><strong>HCR-20:</strong> ${ai.rationales.hcr20 || '—'}</li>
        <li><strong>Lexical:</strong> ${ai.rationales.lexical || '—'}</li>
        <li><strong>Protective:</strong> ${ai.rationales.protective || '—'}</li>
      </ul>
    </div>
    <div class="card">
      <h4 style="margin:0 0 6px;">Recommended Actions</h4>
      <h5>Immediate</h5><ul>${planListHtml(ai.plan.immediate)}</ul>
      <h5>Next 24–72 hours</h5><ul>${planListHtml(ai.plan.next_24_72)}</ul>
      <h5>Follow-up</h5><ul>${planListHtml(ai.plan.follow_up)}</ul>
      ${ai.caveats.length ? `<p class="note"><strong>Caveats:</strong> ${ai.caveats.join(' • ')}</p>` : ''}
    </div>
  `;
  return true;
}

function renderDeterministicFallback(traceMatches){
  const exec = ensureReportExecutive();
  const items = (traceMatches||[]).map(m => 
    `<li><strong>${m.indicator}</strong> — matched “${m.pattern}” → weight applied by rubric</li>`
  ).join('') || '<li>No indicators fired.</li>';
  exec.innerHTML = `
    <div class="card">
      <h4>Comprehensive Report (Deterministic)</h4>
      <p>This explanation is generated without AI and describes why each indicator contributed to the score.</p>
      <ul>${items}</ul>
    </div>
  `;
}
  // --- AI Assist Helpers (new spec) ---
  async function fetchAIExplain(narrative, band, subscores, hits, dampeners) {
    try {
      const res = await fetch('/api/triage-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrative, band, subscores, hits, dampeners })
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function planListHtml(arr) {
    return (arr || []).map(x => `<li>${x}</li>`).join('') || '<li>None.</li>';
  }

  function renderAIIntoReport(aiJson) {
    if (!aiJson) return;

    // Executive + actions
    const exec = document.getElementById('reportExecutive');
    if (exec) {
      exec.innerHTML = `
        <div class="card">
          <h4 style="margin:0 0 6px;">Executive Summary (AI-assist)</h4>
          <p>${(aiJson.executive || '').trim()}</p>
        </div>
        <div class="card">
          <h4 style="margin:0 0 6px;">Recommended Actions</h4>
          <h5>Immediate</h5><ul>${planListHtml(aiJson.plan?.immediate)}</ul>
          <h5>Next 24–72 hours</h5><ul>${planListHtml(aiJson.plan?.next_24_72)}</ul>
          <h5>Follow-up</h5><ul>${planListHtml(aiJson.plan?.follow_up)}</ul>
        </div>
      `;
    }

    // Domain rationales (single bullet)
    const setOne = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<li>${(text || 'None.').trim()}</li>`;
    };
    setOne('btamExplain', aiJson.rationales?.btam);
    setOne('trapExplain', aiJson.rationales?.trap18);
    setOne('hcrExplain',  aiJson.rationales?.hcr20);
    setOne('lexExplain',  aiJson.rationales?.lexical);
    setOne('protExplain', aiJson.rationales?.protective);
  }
  
// New comprehensive report renderer (AI or deterministic fallback)
function renderComprehensiveReport({deterministic, ai}) {
  const exec = document.getElementById('reportExecutive');
  if (!exec) return;

  if (ai) {
    exec.innerHTML = `
      <div class="card">
        <h4>Executive Summary (AI-assist)</h4>
        <p>${ai.executive || "No executive summary."}</p>
      </div>
      <div class="card">
        <h4>Indicator Rationales</h4>
        <ul>
          <li><strong>BTAM:</strong> ${ai.rationales?.btam || "None detected"}</li>
          <li><strong>TRAP-18:</strong> ${ai.rationales?.trap18 || "None detected"}</li>
          <li><strong>HCR-20:</strong> ${ai.rationales?.hcr20 || "None detected"}</li>
          <li><strong>Lexical:</strong> ${ai.rationales?.lexical || "None detected"}</li>
          <li><strong>Protective:</strong> ${ai.rationales?.protective || "None detected"}</li>
        </ul>
      </div>
      <div class="card">
        <h4>Recommended Actions</h4>
        <h5>Immediate</h5><ul>${(ai.plan?.immediate||[]).map(x=>`<li>${x}</li>`).join("")}</ul>
        <h5>Next 24–72h</h5><ul>${(ai.plan?.next_24_72||[]).map(x=>`<li>${x}</li>`).join("")}</ul>
        <h5>Follow-up</h5><ul>${(ai.plan?.follow_up||[]).map(x=>`<li>${x}</li>`).join("")}</ul>
        ${ai.caveats?.length ? `<p class="note"><strong>Caveats:</strong> ${ai.caveats.join(" • ")}</p>` : ""}
      </div>
    `;
  } else {
    exec.innerHTML = `
      <div class="card">
        <h4>Comprehensive Report (Deterministic)</h4>
        <p>This report explains why each indicator was scored, based only on matched text patterns.</p>
        <ul>
          ${(deterministic||[]).map(x => `<li><strong>${x.indicator}</strong> — matched "${x.pattern}" → score +${x.weight}</li>`).join("")}
        </ul>
      </div>
    `;
  }
}
  
// --- Aggregate scoring (restored) ---
function aggregate(text, rubric){
  const btam = findHitsBoundaryAware(text, rubric.btam_core, rubric.dampening.negation_cues, 18);
  const trap = findHitsBoundaryAware(text, rubric.trap18_subset, rubric.dampening.negation_cues, 18);
  const hcr  = findHitsBoundaryAware(text, rubric.hcr20_context, rubric.dampening.negation_cues, 18);
  const lenses = scoreLexical(text, rubric.lenses_lexical, rubric.dampening.negation_cues, 18);
  const protective = scoreProtective(text, rubric.protective_lexical, rubric.dampening.negation_cues, 18);
  const baseTotal = btam.score + trap.score + hcr.score + lenses.score;
  const dampen = applyDampeners(text, baseTotal, rubric.dampening);
  const adjusted = Math.max(0, dampen.score - protective.score); // protective reduces
  const totals = { score: adjusted, band: pickBand(adjusted, rubric.bands) };
  const sub = { btam, trap18:trap, hcr20:hcr, lenses, protective };
  const flags = derivedFlags(sub);
  const conf = confidenceFrom(text, sub, dampen);
  const rec = buildRecommendations(flags, totals.band, rubric, protective.hits);
  const caseMeta = __selectedCaseKey__ ? { key: __selectedCaseKey__, label: CASE_LABELS[__selectedCaseKey__] } : null;
  const allMatches=[...btam.matches,...trap.matches,...hcr.matches,...lenses.matches,...protective.matches];
  const trace=buildCalcTrace(text,{sub, totals, dampen, flags, conf, rec}, allMatches);
  return { totals, sub, dampen, flags, conf, rec, trace, case: caseMeta };
}

// --- Render results into DOM (restored) ---
function renderResults(result, rubric, rawText, caseName){
  if(!result) return;
  const area=document.getElementById('resultsArea'); if(area) area.style.display='grid';
  const scoreBand=document.getElementById('scoreBand'); if(scoreBand){ scoreBand.textContent=`Overall: ${result.totals.band.label} (${result.totals.score})`; scoreBand.className = 'badge ' + bandClass(result.totals.band.label); }
  const summary=document.getElementById('summary');
  if(summary){
    const f=result.flags;
    summary.innerHTML=`<p style="margin:0 0 6px;">Detected signals across domains. <strong>${result.totals.band.label}</strong> band with score <strong>${result.totals.score}</strong> (confidence ${result.conf.label}).</p>
    <p class="note" style="margin:0;">Direct:${f.direct?'✔️':'—'} Means:${f.means?'✔️':'—'} Time:${f.timeSpecific?'✔️':'—'} Leakage:${f.leakage?'✔️':'—'} Fixation:${f.fixation?'✔️':'—'}</p>`;
  }
  const dampNote=document.getElementById('dampenNote'); if(dampNote){
    dampNote.textContent = result.dampen.applied.length ? `Dampeners applied: ${result.dampen.applied.join(', ')}.` : '';
  }
  // Subscore table
  const sub=result.sub;
  document.getElementById('btamScore').textContent=sub.btam.score;
  document.getElementById('trapScore').textContent=sub.trap18.score;
  document.getElementById('hcrScore').textContent=sub.hcr20.score;
  document.getElementById('lensScore').textContent=sub.lenses.score;
  document.getElementById('protScore').textContent=sub.protective.score;
  writeDomainExplain('btamHits', sub.btam.hits);
  writeDomainExplain('trapHits', sub.trap18.hits);
  writeDomainExplain('hcrHits', sub.hcr20.hits);
  writeDomainExplain('lensHits', sub.lenses.hits);
  writeDomainExplain('protHits', sub.protective.hits);

  // Narrative highlights
  const narrativeHtml = renderHighlightedNarrative(rawText, result.trace.matches);
  const nv=document.getElementById('narrativeView'); const nvc=document.getElementById('narrativeViewCard');
  if(nv) nv.innerHTML=narrativeHtml;
  if(nvc) nvc.style.display='block';

  // Executive + actions (deterministic baseline)
  // (Executive & actions now rendered via renderComprehensiveReport after scoring)
  // Domain explains default (one bullet summarizing hits list)
  const setExplain=(id, hitsArr, label)=>{
    const el=document.getElementById(id);
    if(el){
      if(!hitsArr.length){ el.innerHTML='<li>None detected.</li>'; }
      else { el.innerHTML=`<li>${escapeHtml(hitsArr.join(', '))}</li>`; }
    }
  };
  setExplain('btamExplain', sub.btam.hits);
  setExplain('trapExplain', sub.trap18.hits);
  setExplain('hcrExplain', sub.hcr20.hits);
  setExplain('lexExplain', sub.lenses.hits);
  setExplain('protExplain', sub.protective.hits);

  // Rationale list (indicator-level detail)
  populateRationaleList(rawText, result, rubric);

  // Calculation trace
  const traceEl=document.getElementById('calcTrace');
  if(traceEl){
    const lines=result.trace.lines.map(l=>JSON.stringify(l)).join('\n');
    traceEl.textContent=lines + '\nMatches: ' + result.trace.matches.map(m=>`${m.indicator}:${m.pattern}@${m.index}`).join(' | ');
  }
  // Rubric JSON if requested
  const showRub=document.getElementById('showRubric')?.checked;
  const rc=document.getElementById('rubricCard'); if(rc){ rc.style.display=showRub?'block':'none'; if(showRub){ rc.textContent=JSON.stringify(rubric,null,2); } }
}
// (aggregate & renderResults restored above)

// Built-in quick tests
const __TT_TESTS__ = [
  { name:"Time + grievance (should hit BTAM: time/place & grievance)", text:"I’ll get him back tomorrow. Everyone will see.", expectMin:2 },
  { name:"Leakage only (BTAM: leakage)", text:"You'll see. Not a joke.", expectMin:1 },
  { name:"Negated threat (should dampen)", text:"I said I won't do it. I'm joking.", expectMax:2 }
];

function runQuickTests(rubric){
  const lines = [];
  __TT_TESTS__.forEach(tc=>{
    const r = aggregate(tc.text, rubric);
    lines.push(`${tc.name} → score ${r.totals.score} | hits: BTAM(${r.sub.btam.hits.join(',')||'-'}) TRAP(${r.sub.trap18.hits.join(',')||'-'})`);
  });
  console.debug('[TT] Quick tests:\n' + lines.join('\n'));
}

function wireCaseSelector(){
  const sel = document.getElementById('caseSelect');
  const note = document.getElementById('caseNote');
  const ta = document.getElementById('narrative');
  if(!sel || !ta){ console.warn('[TT] caseSelect or narrative missing'); return; }

  const setFromSelect = () => {
    const key = sel.value || "";
    __selectedCaseKey__ = key;
    let text = CASE_EXAMPLES[key];
    if(!text){
      const opt = sel.options[sel.selectedIndex];
      text = opt?.getAttribute('data-text') || '';
    }
    if(text){
      ta.value = text;
      const ra=document.getElementById('resultsArea'); if(ra) ra.style.display='none';
      if(note) note.textContent = CASE_LABELS[key] ? `Case loaded: ${CASE_LABELS[key]}` : '';
      ta.focus();
      console.debug('[TT] Loaded case', key);
    } else {
      if(note) note.textContent='';
      console.debug('[TT] Cleared case selection');
    }
  };

  sel.addEventListener('change', setFromSelect);
  sel.addEventListener('input', setFromSelect);
  sel.addEventListener('click', (e)=>{ if(sel.value) setFromSelect(); });

  // If a non-empty option is preselected, populate textarea on load
  if (sel.value) setFromSelect();
}

// Validation benchmarks runner
function runBenchmarksUI(rubric){
  const body=document.getElementById('benchBody'); if(!body) return;
  body.innerHTML='';
  BENCHMARKS.forEach(b=>{
    const r=aggregate(b.text, rubric, b.label, b.key);
    const actual=r.totals.band.label;
    const exp=b.expect||'';
    const pass = !exp || exp===actual;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${escapeHtml(b.label)}</td><td>${escapeHtml(exp)}</td><td>${escapeHtml(actual)}</td><td style="color:${pass?'green':'#b00'}">${pass?'PASS':'MISMATCH'}</td>`;
    body.appendChild(tr);
  });
}
// stray copy binding removed (handled in main)

// (Removed previous main()/bindRun flow; reliability handled by runTriageOnce + boot())
