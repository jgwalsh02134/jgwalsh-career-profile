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

function fillNarrativeFromSelect(){
  const sel = document.getElementById('caseSelect');
  const ta  = document.getElementById('narrative');
  const note= document.getElementById('caseNote');
  if(!sel || !ta) return false;
  const key = sel.value || '';
  __selectedCaseKey__ = key;
  let text = (CASE_EXAMPLES && CASE_EXAMPLES[key]) || '';
  if(!text){
    const opt = sel.options && sel.options[sel.selectedIndex];
    text = (opt && (opt.dataset ? opt.dataset.text : (opt.getAttribute && opt.getAttribute('data-text')))) || '';
  }
  if(text){
    ta.value = text;
    const ra=document.getElementById('resultsArea'); if(ra) ra.style.display='none';
    if(note) note.textContent = (CASE_LABELS && CASE_LABELS[key]) ? (`Case loaded: ${CASE_LABELS[key]}`) : '';
    return true;
  }
  return false;
}

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
  // No-op
}

// Removed older wireCaseSelect in favor of wireCaseSelector()

let __RUBRIC__=null;
async function loadRubricOnce(){
  if(__RUBRIC__) return __RUBRIC__;
  const r = await fetch('./rubric.json?v=online-fix-1',{cache:'no-store'}).catch(()=>null);
  if(!r || !r.ok) throw new Error('rubric load failed');
  __RUBRIC__ = await r.json();
  try {
    // Normalize schema differences (dampeners vs dampening)
    if (!__RUBRIC__.dampening && __RUBRIC__.dampeners) {
      __RUBRIC__.dampening = __RUBRIC__.dampeners;
    }
    __RUBRIC__.dampening = __RUBRIC__.dampening || {};
    __RUBRIC__.dampening.negation_cues = __RUBRIC__.dampening.negation_cues || [];
    __RUBRIC__.dampening.stopwords = __RUBRIC__.dampening.stopwords || [];
  } catch {}
  return __RUBRIC__;
}

async function runTriageOnce(){
  try{
    // If textarea empty and a case is selected, fill it first
    const taEl = document.getElementById('narrative');
    if(taEl && !taEl.value) fillNarrativeFromSelect();
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

// Global inline fallback (for robust HTML onchange binding)
window.__ttSetFromSelect = function(sel){
  try{
    var ta = document.getElementById('narrative');
    if(!ta || !sel) return;
    var key = sel.value || "";
    __selectedCaseKey__ = key;
    var opt = sel.options && sel.options[sel.selectedIndex];
    var text = (CASE_EXAMPLES && CASE_EXAMPLES[key]) || (opt && opt.getAttribute && opt.getAttribute('data-text')) || '';
    if(text){
      ta.value = text;
      var ra = document.getElementById('resultsArea'); if(ra) ra.style.display='none';
      var note = document.getElementById('caseNote'); if(note) note.textContent = (CASE_LABELS && CASE_LABELS[key]) ? ('Case loaded: ' + CASE_LABELS[key]) : '';
      ta.focus();
      console.debug('[TT] inline select set', key);
    }
  }catch(e){ console.warn('[TT] inline select handler error', e); }
};
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
