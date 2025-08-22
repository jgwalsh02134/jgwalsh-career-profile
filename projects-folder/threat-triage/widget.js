function normalize(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function includesAny(text, patterns) {
  return (patterns || []).some(p => text.includes(p));
}

// Curated illustrative narratives (public-style paraphrases; no PII)
const CASE_NARRATIVES = {
  virginia:
    "I’ll get him back tomorrow. He’ll be sorry he ever messed with me. Everyone will see what happens at school.",
  disability:
    "I might as well bring something to school. People laugh at me every day. Maybe then they’ll take me seriously.",
  employee:
    "At the front desk the terminated employee shouted: 'Tell the CEO he’s a dead man walking. You’ll all regret this.'",
  apalachee:
    "Nobody cares now, but they will after tomorrow. I’ll make sure my name is remembered like the others."
};

async function loadRubric() {
  const res = await fetch('./rubric.json?v=2', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading rubric.json`);
  return res.json();
}

function scoreSection(text, section) {
  const t = normalize(text);
  let score = 0, hits = [];
  (section || []).forEach(ind => {
    if (includesAny(t, ind.patterns)) {
      score += ind.weight;
      hits.push(ind.name);
    }
  });
  return { score, hits };
}

function applyDampeners(text, baseScore, dampeners) {
  const t = normalize(text);
  let s = baseScore, applied = [];
  if (includesAny(t, dampeners.stopwords || [])) { s = Math.max(0, s - 1); applied.push("stopwords"); }
  let negDeduct = 0;
  if (includesAny(t, dampeners.negation_cues || [])) { negDeduct = Math.min( (dampeners.max_negation_deduction || 2), 2 ); }
  if (negDeduct > 0) { s = Math.max(0, s - negDeduct); applied.push("negation"); }
  return { score: s, applied };
}

function pickBand(score, bands) {
  return bands.find(b => score >= b.min && score <= b.max) || bands[bands.length - 1];
}

function renderList(ul, items) {
  ul.innerHTML = '';
  (items.length ? items : ['None']).forEach(x => {
    const li = document.createElement('li'); li.textContent = x; ul.appendChild(li);
  });
}

function renderResults(result, rubric) {
  const { totals, sub, dampen } = result;

  document.getElementById('resultsArea').style.display = 'grid';
  document.getElementById('scoreBand').textContent = `Overall: ${totals.score} (${totals.band.label})`;
  document.getElementById('summary').innerHTML = `
    <p><strong>Assessment:</strong> ${totals.band.label}. Deterministic screening using BTAM, TRAP-18 subset, and HCR-20 context. Human review required.</p>
    <p class="muted">Signals are indicators, not proof. See sub-scores below.</p>
  `;

  // Subscore cards
  document.getElementById('btamScore').textContent = `${sub.btam.score}`;
  renderList(document.getElementById('btamHits'), sub.btam.hits);

  document.getElementById('trapScore').textContent = `${sub.trap18.score}`;
  renderList(document.getElementById('trapHits'), sub.trap18.hits);

  document.getElementById('hcrScore').textContent = `${sub.hcr20.score}`;
  renderList(document.getElementById('hcrHits'), sub.hcr20.hits);

  // Aggression lenses (optional rater UI)
  document.getElementById('moasScore').textContent = `${sub.moas.score.toFixed(1)}`;
  document.getElementById('aqScore').textContent = `${sub.aqmini.score.toFixed(1)}`;

  // Rubric JSON toggle
  const showRubric = document.getElementById('showRubric').checked;
  const rc = document.getElementById('rubricCard');
  rc.style.display = showRubric ? 'block' : 'none';
  if (showRubric) rc.textContent = JSON.stringify(rubric, null, 2);

  // Dampeners
  const dampDiv = document.getElementById('dampenNote');
  dampDiv.textContent = dampen.applied.length ? `Dampeners: ${dampen.applied.join(', ')}` : 'Dampeners: none';
}

function readMOAS() {
  // 0..4 each, weighted as in rubric
  const fields = ['moas-verbal','moas-objects','moas-others','moas-self'];
  const vals = fields.map(id => Number((document.getElementById(id)?.value) || 0));
  return { verbal: vals[0], objects: vals[1], others: vals[2], self: vals[3] };
}
function readAQmini() {
  const ids = ['aq1','aq2','aq3','aq4'];
  const vals = ids.map(id => Number((document.querySelector(`input[name='${id}']:checked`)?.value) || 0));
  return vals;
}

function aggScores(text, rubric) {
  const btam = scoreSection(text, rubric.btam_core);
  const trap = scoreSection(text, rubric.trap18_subset);
  const hcr  = scoreSection(text, rubric.hcr20_context);

  // Aggression lenses (optional manual rater + optional self-report mini)
  const moasSel = readMOAS();
  const mW = rubric.aggression_lenses?.moas?.weights || { verbal:0.5, "physical-objects":1, "physical-others":2, "self-directed":1 };
  const moas = {
    score: (moasSel.verbal * (mW.verbal || 0.5)) +
           (moasSel.objects * (mW["physical-objects"] || 1)) +
           (moasSel.others * (mW["physical-others"] || 2)) +
           (moasSel.self * (mW["self-directed"] || 1))
  };

  const aqVals = readAQmini(); // 1..5 each if selected
  const aqmini = { score: aqVals.filter(v => v>0).reduce((a,b)=>a+b,0) / (aqVals.filter(v=>v>0).length || 1) };

  // Base narrative-derived score (BTAM/TRAP/HCR only)
  const base = btam.score + trap.score + hcr.score;

  // Apply dampeners to narrative-derived score
  const dampen = applyDampeners(text, base, rubric.dampeners || {});
  let narrativeScore = dampen.score;

  // Blend optional lenses gently (bounded influence)
  const moasBoost   = Math.min(2, moas.score * 0.3);   // cap small effect
  const aqMiniBoost = Math.min(1, aqmini.score * 0.2); // cap smaller effect

  const totalScore = Math.round(narrativeScore + moasBoost + aqMiniBoost);
  const band = pickBand(totalScore, rubric.bands);

  return {
    totals: { score: totalScore, band },
    sub: { btam, trap18: trap, hcr20: hcr, moas, aqmini },
    dampen
  };
}

async function main() {
  const diag = document.getElementById('diag');
  let rubric;
  try {
    rubric = await loadRubric();
  } catch (e) {
    console.error(e); if (diag) diag.textContent = `Error loading rubric: ${String(e)}`; return;
  }

  const runBtn = document.getElementById('run');
  const showRubric = document.getElementById('showRubric');
  const loadExampleBtn = document.getElementById('loadExample');
  const clearBtn = document.getElementById('clearText');

  runBtn.addEventListener('click', () => {
    const txt = document.getElementById('narrative').value || '';
    const result = aggScores(txt, rubric);
    renderResults(result, rubric);
    if (diag) diag.textContent = `Processed ${txt.length} chars using rubric v${rubric.version}`;
  });

  showRubric.addEventListener('change', () => {
    const txt = document.getElementById('narrative').value || '';
    if (txt.trim()) renderResults(aggScores(txt, rubric), rubric);
  });

  loadExampleBtn.addEventListener('click', () => {
    const example = `Tomorrow at 8am they'll finally listen. I bought what I need and I have the keys to get in through the service door. You'll see. No other choice.`;
    const ta = document.getElementById('narrative'); ta.value = example; ta.focus();
  });

  clearBtn.addEventListener('click', () => {
    document.getElementById('narrative').value = '';
    document.getElementById('resultsArea').style.display = 'none';
  });

  // Case selection hookup
  const caseSelect = document.getElementById('caseSelect');
  if (caseSelect) {
    caseSelect.addEventListener('change', (e) => {
      const key = e.target.value;
      if (CASE_NARRATIVES[key]) {
        const ta = document.getElementById('narrative');
        ta.value = CASE_NARRATIVES[key];
        const ra = document.getElementById('resultsArea');
        if (ra) ra.style.display = 'none';
        ta.focus();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', main);
