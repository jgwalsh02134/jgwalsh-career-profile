// Canonicalize text to avoid Unicode pitfalls (smart quotes, dashes, accents)
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

function buildReportMarkdown(text, totals, sub, flags, conf, damp, rec, caseMeta){
  const immed = flags.timeSpecific ? "Near-term (≤72h) cues present" : "Immediacy unclear from text";
  const drivers = []
    .concat(sub.btam.hits.length? ["BTAM: "+sub.btam.hits.join(', ')] : [])
    .concat(sub.trap18.hits.length? ["TRAP-18: "+sub.trap18.hits.join(', ')] : [])
    .concat(sub.hcr20.hits.length? ["HCR-20 context: "+sub.hcr20.hits.join(', ')] : [])
    .concat(sub.lenses.hits.length? ["Lexical aggression: "+sub.lenses.hits.join(', ')] : [])
    .concat(sub.protective.hits.length? ["Protective factors: "+sub.protective.hits.join(', ')] : []);
  const protectiveNarr = sub.protective.hits.length? "Protective lexical signals ("+sub.protective.hits.join(', ')+") may mitigate escalation if actively engaged." : "No clear protective lexical signals detected.";
  const riskInterp = totals.band.label+" band derives from additive indicators with dampener adjustments. This is a deterministic lexical screen; it does not infer motive, capability depth, or clinical state.";
  const recBlock = (title, arr)=>['**'+title+'**'].concat(arr.length? arr.map(x=>'- '+x):['- None identified.']).join('\n');
  const caseHeader = caseMeta && caseMeta.label ? `**Case:** ${caseMeta.label}` : '';
  return [
caseHeader,
"## Executive Summary",
`**Band:** ${totals.band.label}  |  **Score:** ${totals.score}  |  **Confidence:** ${conf.label}`,
`**Immediacy:** ${immed}`,
"",
"### Risk Formulation (Structured Professional Judgment Alignment)",
"- **Observable drivers:** "+(drivers.length? drivers.join(' | '):'None detected.'),
`- **Dampeners applied:** ${damp.applied.length? damp.applied.join(', '):'none'}.`,
"- **Interpretation:** "+riskInterp,
"- **Protective context:** "+protectiveNarr,
"",
"### Recommended Actions",
recBlock('Immediate', rec.immediate),
"",
recBlock('Near Term', rec.near_term),
"",
recBlock('Follow Up', rec.follow_up),
"",
"### Detailed Indicator Accounting",
`- BTAM core (${sub.btam.score}): ${sub.btam.hits.join(', ')||'none'}`,
`- TRAP-18 subset (${sub.trap18.score}): ${sub.trap18.hits.join(', ')||'none'}`,
`- HCR-20 context (${sub.hcr20.score}): ${sub.hcr20.hits.join(', ')||'none'}`,
`- Lexical aggression (${sub.lenses.score}): ${sub.lenses.hits.join(', ')||'none'}`,
`- Protective (${sub.protective.score}): ${sub.protective.hits.join(', ')||'none'}`,
"",
"### Narrative Provided",
"> "+text.replace(/\n+/g,' ').trim(),
"",
"### Transparency & Limitations",
"Deterministic pattern match; no machine learning, no external data enrichment. Absence of hits ≠ absence of risk. All outputs require qualified human evaluation before action."
  ].join('\n');
}

function buildCalcTrace(text, results){
  const {sub, totals, dampen, flags, conf, rec} = results;
  const lines = [];
  lines.push(`Raw text length chars: ${text.length}`);
  lines.push(`BTAM score: ${sub.btam.score} => ${sub.btam.hits.join(', ')||'none'}`);
  lines.push(`TRAP-18 score: ${sub.trap18.score} => ${sub.trap18.hits.join(', ')||'none'}`);
  lines.push(`HCR-20 score: ${sub.hcr20.score} => ${sub.hcr20.hits.join(', ')||'none'}`);
  lines.push(`Lexical aggression score: ${sub.lenses.score} => ${sub.lenses.hits.join(', ')||'none'}`);
  lines.push(`Protective score: ${sub.protective.score} => ${sub.protective.hits.join(', ')||'none'}`);
  lines.push(`Dampeners applied: ${dampen.applied.join(', ')||'none'}; narrative score after dampeners included.`);
  lines.push(`Total band: ${totals.band.label} (${totals.score}) confidence ${conf.label} (${(conf.value*100).toFixed(0)}%).`);
  lines.push(`Flags direct:${flags.direct} means:${flags.means} target:${flags.targetSpecific} time:${flags.timeSpecific} leakage:${flags.leakage} fixation:${flags.fixation}`);
  lines.push('Immediate rec count: '+rec.immediate.length+' Near-term: '+rec.near_term.length+' Follow-up: '+rec.follow_up.length);
  return lines.join('\n');
}

function renderResults(full, rubric){
  const {totals, sub, dampen, report, trace} = full;
  document.getElementById('resultsArea').style.display='grid';
  const scoreEl=document.getElementById('scoreBand');
  scoreEl.textContent=`Overall: ${totals.score} (${totals.band.label})`;
  scoreEl.className=bandClass(totals.band.label);
  document.getElementById('summary').innerHTML=`<p><strong>Assessment:</strong> ${totals.band.label}. Deterministic screen; human review required.</p><p class="note">Full narrative report below.</p>`;
  document.getElementById('dampenNote').textContent=dampen.applied.length?`Dampeners: ${dampen.applied.join(', ')}`:'Dampeners: none';
  document.getElementById('btamScore').textContent=sub.btam.score; renderList(document.getElementById('btamHits'), sub.btam.hits);
  document.getElementById('trapScore').textContent=sub.trap18.score; renderList(document.getElementById('trapHits'), sub.trap18.hits);
  document.getElementById('hcrScore').textContent=sub.hcr20.score; renderList(document.getElementById('hcrHits'), sub.hcr20.hits);
  document.getElementById('lensScore').textContent=sub.lenses.score; renderList(document.getElementById('lensHits'), sub.lenses.hits);
  document.getElementById('protScore').textContent=sub.protective.score; renderList(document.getElementById('protHits'), sub.protective.hits);
  document.getElementById('reportText').textContent=report;
  document.getElementById('calcTrace').textContent=trace;
  const showRubric=document.getElementById('showRubric').checked; const rc=document.getElementById('rubricCard'); rc.style.display=showRubric?'block':'none'; if(showRubric) rc.textContent=JSON.stringify(rubric,null,2);
}

function aggregate(text, rubric){
  const negList = (rubric.dampeners && rubric.dampeners.negation_cues) || [];
  const windowChars = 14;
  const btam = findHitsBoundaryAware(text, rubric.btam_core, negList, windowChars);
  const trap = findHitsBoundaryAware(text, rubric.trap18_subset, negList, windowChars);
  const hcr  = findHitsBoundaryAware(text, rubric.hcr20_context, negList, windowChars);
  const lenses = scoreLexical(text, rubric.lenses_lexical||{categories:[]}, negList, windowChars);
  const protective = scoreProtective(text, rubric.protective_lexical||{categories:[]}, negList, windowChars);
  const base = btam.score + trap.score + hcr.score + lenses.score; // protective not added; subtract protective later
  const dampen = applyDampeners(text, base, rubric.dampeners||{});
  const adjusted = Math.max(0, dampen.score - protective.score); // protective reduces
  const totals = { score: adjusted, band: pickBand(adjusted, rubric.bands) };
  const sub = { btam, trap18:trap, hcr20:hcr, lenses, protective };
  const flags = derivedFlags(sub);
  const conf = confidenceFrom(text, sub, dampen);
  const rec = buildRecommendations(flags, totals.band, rubric, protective.hits);
  const caseMeta = __selectedCaseKey__ ? { key: __selectedCaseKey__, label: CASE_LABELS[__selectedCaseKey__] } : null;
  const report = buildReportMarkdown(text, totals, sub, flags, conf, dampen, rec, caseMeta);
  const trace = buildCalcTrace(text, {sub, totals, dampen, flags, conf, rec});
  return { totals, sub, dampen, flags, conf, rec, report, trace, case: caseMeta };
}

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
  sel.addEventListener('change', (e)=>{
    const key = e.target.value || "";
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
  });
}

function main(){
  console.debug('[TT] widget boot OK');
  const diag=document.getElementById('diag');
  loadRubric().then(rubric=>{
    const runBtn=document.getElementById('run');
    const clearBtn=document.getElementById('clearText');
    const copyBtn=document.getElementById('copyReport');
    const dlBtn=document.getElementById('downloadBtn');
    const showRubric=document.getElementById('showRubric');
    wireCaseSelector();
  runQuickTests(rubric);

    function execute(){
      const inputText=(document.getElementById('narrative').value||'').trim();
      if(!inputText){diag.textContent='Enter narrative text.'; return;}
      const full=aggregate(inputText, rubric);
      renderResults(full, rubric);
      const caseName = __selectedCaseKey__ ? (CASE_LABELS[__selectedCaseKey__] || __selectedCaseKey__) : '';
      const reportCaseEl = document.getElementById('reportCase');
      if(reportCaseEl) reportCaseEl.textContent = caseName ? `Case: ${caseName}` : '';
      window.__lastTriage__={
        ...window.__lastTriage__,
        rubricVersion: rubric.version,
        ...full,
        caseName,
        narrativeChars: inputText.length,
        timestamp: new Date().toISOString()
      };
      diag.textContent=`Processed ${inputText.length} chars; rubric v${rubric.version}`;
    }

    runBtn.addEventListener('click', execute);
    showRubric.addEventListener('change',()=>{ if(window.__lastTriage__) renderResults(window.__lastTriage__, rubric); });
    clearBtn.addEventListener('click',()=>{ document.getElementById('narrative').value=''; document.getElementById('resultsArea').style.display='none'; document.getElementById('scoreBand').className='badge'; diag.textContent=''; });
    copyBtn.addEventListener('click',()=>{ const r=window.__lastTriage__; if(!r){diag.textContent='Run first.';return;} navigator.clipboard.writeText(r.report).then(()=>diag.textContent='Report copied.'); });
    dlBtn.addEventListener('click',()=>{ const r=window.__lastTriage__; if(!r){diag.textContent='Run first.';return;} const blob=new Blob([JSON.stringify(r,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='triage_result.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); });
  document.getElementById('ttRunTests')?.addEventListener('click',()=>runQuickTests(rubric));
  }).catch(e=>{ console.error(e); if(diag) diag.textContent='Rubric load error: '+e; });
}

// DOMContentLoaded guard (script loaded with defer but keep safety)
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
