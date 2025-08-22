function normalize(t){return (t||'').toLowerCase().replace(/\s+/g,' ').trim();}
function includesAny(text, patterns){return (patterns||[]).some(p=>text.includes(p));}
function bandClass(label){const L=label.toLowerCase(); if(L.startsWith('crit')) return 'badge crit'; if(L.startsWith('elev')) return 'badge elev'; if(L.startsWith('mod')) return 'badge mod'; return 'badge low';}
function clamp(x,min,max){return Math.max(min,Math.min(max,x));}

async function loadRubric(){
  const res = await fetch('./rubric.json?v=5',{cache:'no-store'});
  if(!res.ok) throw new Error(`HTTP ${res.status} loading rubric.json`);
  return res.json();
}

function findHitsWithPatterns(text, section){
  const t = normalize(text);
  let score = 0;
  const hits = [];
  const matches = [];
  (section||[]).forEach(ind=>{
    let matched=false;
    (ind.patterns||[]).forEach(p=>{
      if(t.includes(p)){ matched=true; matches.push({indicator:ind.name, pattern:p}); }
    });
    if(matched){ score += (ind.weight||0); hits.push(ind.name); }
  });
  return {score, hits, matches};
}

function scoreLexical(text, lenses){
  const t = normalize(text);
  let score = 0, hits=[], matches=[];
  (lenses.categories||[]).forEach(cat=>{
    let m=false;
    (cat.patterns||[]).forEach(p=>{ if(t.includes(p)){ m=true; matches.push({indicator:cat.name, pattern:p}); } });
    if(m){ score += (cat.weight||0); hits.push(cat.name); }
  });
  const cap = Number(lenses.cap_total||3);
  return {score: Math.min(cap, Math.round(score*10)/10), hits, matches};
}

function scoreProtective(text, prot){
  const t = normalize(text);
  let score = 0, hits=[], matches=[];
  (prot.categories||[]).forEach(cat=>{
    let m=false;
    (cat.patterns||[]).forEach(p=>{ if(t.includes(p)){ m=true; matches.push({indicator:cat.name, pattern:p}); }});
    if(m){ score += (cat.weight||0); hits.push(cat.name); }
  });
  const cap = Number(prot.cap_abs||2);
  return {score: Math.min(cap, score), hits, matches};
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

function buildReportMarkdown(text, totals, sub, flags, conf, damp, rec){
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
  return [
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
  const btam = findHitsWithPatterns(text, rubric.btam_core);
  const trap = findHitsWithPatterns(text, rubric.trap18_subset);
  const hcr  = findHitsWithPatterns(text, rubric.hcr20_context);
  const lenses = scoreLexical(text, rubric.lenses_lexical||{categories:[]});
  const protective = scoreProtective(text, rubric.protective_lexical||{categories:[]});
  const base = btam.score + trap.score + hcr.score + lenses.score; // protective not added; subtract protective later
  const dampen = applyDampeners(text, base, rubric.dampeners||{});
  const adjusted = Math.max(0, dampen.score - protective.score); // protective reduces
  const totals = { score: adjusted, band: pickBand(adjusted, rubric.bands) };
  const sub = { btam, trap18:trap, hcr20:hcr, lenses, protective };
  const flags = derivedFlags(sub);
  const conf = confidenceFrom(text, sub, dampen);
  const rec = buildRecommendations(flags, totals.band, rubric, protective.hits);
  const report = buildReportMarkdown(text, totals, sub, flags, conf, dampen, rec);
  const trace = buildCalcTrace(text, {sub, totals, dampen, flags, conf, rec});
  return { totals, sub, dampen, flags, conf, rec, report, trace };
}

async function main(){
  const diag=document.getElementById('diag');
  let rubric; try{rubric=await loadRubric();}catch(e){console.error(e); if(diag) diag.textContent='Rubric load error: '+e; return;}
  const runBtn=document.getElementById('run');
  const clearBtn=document.getElementById('clearText');
  const copyBtn=document.getElementById('copyReport');
  const dlBtn=document.getElementById('downloadBtn');
  const showRubric=document.getElementById('showRubric');

  function execute(){
    const text=(document.getElementById('narrative').value||'').trim();
    if(!text){diag.textContent='Enter narrative text.'; return;}
    const full=aggregate(text, rubric);
    renderResults(full, rubric);
    window.__lastTriage__={rubricVersion:rubric.version, ...full, timestamp:new Date().toISOString()};
    diag.textContent=`Processed ${text.length} chars; rubric v${rubric.version}`;
  }
  runBtn.addEventListener('click', execute);
  showRubric.addEventListener('change',()=>{ if(window.__lastTriage__) renderResults(window.__lastTriage__, rubric); });
  clearBtn.addEventListener('click',()=>{ document.getElementById('narrative').value=''; document.getElementById('resultsArea').style.display='none'; document.getElementById('scoreBand').className='badge'; diag.textContent=''; });
  copyBtn.addEventListener('click',()=>{ const r=window.__lastTriage__; if(!r){diag.textContent='Run first.';return;} navigator.clipboard.writeText(r.report).then(()=>diag.textContent='Report copied.'); });
  dlBtn.addEventListener('click',()=>{ const r=window.__lastTriage__; if(!r){diag.textContent='Run first.';return;} const blob=new Blob([JSON.stringify(r,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='triage_result.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); });
}

document.addEventListener('DOMContentLoaded', main);
