function normalize(text){return (text||'').toLowerCase().replace(/\s+/g,' ').trim();}
function includesAny(text,patterns){return (patterns||[]).some(p=>text.includes(p));}

async function loadRubric(){
  const res=await fetch('./rubric.json?v=3',{cache:'no-store'});
  if(!res.ok) throw new Error(`HTTP ${res.status} loading rubric.json`);
  return res.json();
}

const CASE_NARRATIVES={
  virginia:"I’ll get him back tomorrow. He’ll be sorry he ever messed with me. Everyone will see what happens at school.",
  disability:"I might as well bring something to school. People laugh at me every day. Maybe then they’ll take me seriously.",
  employee:"At the front desk the terminated employee shouted: 'Tell the CEO he’s a dead man walking. You’ll all regret this.'",
  apalachee:"Nobody cares now, but they will after tomorrow. I’ll make sure my name is remembered like the others."
};
const CASE_NOTES={
  virginia:"Virginia DCJS school threat assessment example (non-specific revenge language).",
  disability:"NDRN case: disability context; importance of supportive response.",
  employee:"FBI LEB example: workplace direct threat with identification of target.",
  apalachee:"USSS/media leakage before incident; educational illustration."
};

function scoreSection(text,section){
  const t=normalize(text);let score=0,hits=[];
  (section||[]).forEach(ind=>{if(includesAny(t,ind.patterns)){score+=ind.weight;hits.push(ind.name);}});
  return{score,hits};
}
function applyDampeners(text,base,dampeners){
  const t=normalize(text);let s=base,applied=[];
  if(includesAny(t,dampeners.stopwords||[])){s=Math.max(0,s-1);applied.push('stopwords');}
  let negDeduct=0; if(includesAny(t,dampeners.negation_cues||[])){negDeduct=Math.min(dampeners.max_negation_deduction||2,2);} 
  if(negDeduct>0){s=Math.max(0,s-negDeduct);applied.push('negation');}
  return{score:s,applied};
}
function pickBand(score,bands){return bands.find(b=>score>=b.min&&score<=b.max)||bands[bands.length-1];}
function renderList(ul,items){ul.innerHTML='';(items.length?items:['None']).forEach(x=>{const li=document.createElement('li');li.textContent=x;ul.appendChild(li);});}
function bandClass(label){const L=label.toLowerCase(); if(L.startsWith('crit')) return 'badge crit'; if(L.startsWith('elev')) return 'badge elev'; if(L.startsWith('mod')) return 'badge mod'; return 'badge low';}

function renderResults(result,rubric){
  const {totals,sub,dampen}=result;
  document.getElementById('resultsArea').style.display='grid';
  const scoreEl=document.getElementById('scoreBand');
  scoreEl.textContent=`Overall: ${totals.score} (${totals.band.label})`;
  scoreEl.className=bandClass(totals.band.label);
  document.getElementById('summary').innerHTML=`<p><strong>Assessment:</strong> ${totals.band.label}. Deterministic screening using BTAM, TRAP-18 subset, and HCR-20 context. Human review required.</p><p class="note">Signals are indicators, not proof. Subscores and hits below.</p>`;
  document.getElementById('dampenNote').textContent=dampen.applied.length?`Dampeners: ${dampen.applied.join(', ')}`:'Dampeners: none';
  document.getElementById('btamScore').textContent=`${sub.btam.score}`; renderList(document.getElementById('btamHits'),sub.btam.hits);
  document.getElementById('trapScore').textContent=`${sub.trap18.score}`; renderList(document.getElementById('trapHits'),sub.trap18.hits);
  document.getElementById('hcrScore').textContent=`${sub.hcr20.score}`; renderList(document.getElementById('hcrHits'),sub.hcr20.hits);
  document.getElementById('moasScore').textContent=sub.moas.score.toFixed(1);
  document.getElementById('aqScore').textContent=sub.aqmini.score.toFixed(1);
  window.__lastTriage__={rubricVersion:rubric.version,result,timestamp:new Date().toISOString()};
}

function readMOAS(){const ids=['moas-verbal','moas-objects','moas-others','moas-self'];const [v,o,ot,s]=ids.map(id=>Number(document.getElementById(id)?.value||0));return{verbal:v,objects:o,others:ot,self:s};}
function readAQmini(){const ids=['aq1','aq2','aq3','aq4'];const vals=ids.map(id=>Number((document.querySelector(`input[name='${id}']:checked`)||{}).value||0));return vals;}

function aggScores(text,rubric){
  const btam=scoreSection(text,rubric.btam_core);
  const trap=scoreSection(text,rubric.trap18_subset);
  const hcr=scoreSection(text,rubric.hcr20_context);
  const mSel=readMOAS();
  const mW=rubric.aggression_lenses?.moas?.weights||{verbal:0.5,"physical-objects":1,"physical-others":2,"self-directed":1};
  const moas={score:(mSel.verbal*(mW.verbal||0.5))+(mSel.objects*(mW["physical-objects"]||1))+(mSel.others*(mW["physical-others"]||2))+(mSel.self*(mW["self-directed"]||1))};
  const aqVals=readAQmini();
  const aqmini={score:aqVals.filter(v=>v>0).reduce((a,b)=>a+b,0)/(aqVals.filter(v=>v>0).length||1)};
  const base=btam.score+trap.score+hcr.score;
  const dampen=applyDampeners(text,base,rubric.dampeners||{});
  let narrativeScore=dampen.score;
  const moasBoost=Math.min(2,moas.score*0.3);
  const aqBoost=Math.min(1,aqmini.score*0.2);
  const total=Math.round(narrativeScore+moasBoost+aqBoost);
  const band=pickBand(total,rubric.bands);
  return{totals:{score:total,band},sub:{btam,trap18:trap,hcr20:hcr,moas,aqmini},dampen};
}

async function main(){
  const diag=document.getElementById('diag');
  let rubric; try{rubric=await loadRubric();}catch(e){console.error(e); if(diag) diag.textContent=`Error loading rubric: ${String(e)}`; return;}
  const sel=document.getElementById('caseSelect');
  const note=document.getElementById('caseNote');
  sel?.addEventListener('change',e=>{const key=e.target.value;const ta=document.getElementById('narrative'); if(CASE_NARRATIVES[key]){ta.value=CASE_NARRATIVES[key]; if(note) note.textContent=CASE_NOTES[key]||''; document.getElementById('resultsArea').style.display='none'; ta.focus();} else { if(note) note.textContent=''; }});
  const runBtn=document.getElementById('run');
  const showRubric=document.getElementById('showRubric');
  const loadExampleBtn=document.getElementById('loadExample');
  const clearBtn=document.getElementById('clearText');
  runBtn.addEventListener('click',()=>{const txt=document.getElementById('narrative').value||''; const result=aggScores(txt,rubric); renderResults(result,rubric); if(diag) diag.textContent=`Processed ${txt.length} chars using rubric v${rubric.version}`; document.getElementById('run').focus();});
  showRubric.addEventListener('change',()=>{const txt=document.getElementById('narrative').value||''; if(txt.trim()) renderResults(aggScores(txt,rubric),rubric);});
  loadExampleBtn.addEventListener('click',()=>{const ta=document.getElementById('narrative'); ta.value="Tomorrow at 8am they'll finally listen. I bought what I need and I have the keys to get in through the service door. You'll see. No other choice."; document.getElementById('resultsArea').style.display='none'; ta.focus();});
  clearBtn.addEventListener('click',()=>{document.getElementById('narrative').value=''; document.getElementById('resultsArea').style.display='none'; document.getElementById('scoreBand').className='badge'; if(diag) diag.textContent='';});
  document.getElementById('copyBtn')?.addEventListener('click',()=>{const res=window.__lastTriage__; const text=res?`Triage: ${res.result.totals.score} (${res.result.totals.band.label})\nBTAM ${res.result.sub.btam.score}; TRAP ${res.result.sub.trap18.score}; HCR ${res.result.sub.hcr20.score}\nDampeners: ${(res.result.dampen.applied||[]).join(', ')||'none'}\nRubric v${res.rubricVersion}`:'No result yet. Run triage first.'; navigator.clipboard.writeText(text);});
  document.getElementById('downloadBtn')?.addEventListener('click',()=>{const res=window.__lastTriage__; if(!res){alert('Run triage first.');return;} const blob=new Blob([JSON.stringify(res,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='triage_result.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);});
}

document.addEventListener('DOMContentLoaded',main);
