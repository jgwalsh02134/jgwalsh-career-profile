async function loadRubric() {
  const res = await fetch('./rubric.json?v=1', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading rubric.json`);
  return res.json();
}

function normalize(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function includesAny(text, patterns) {
  return patterns.some(p => text.includes(p));
}

function scoreNarrative(text, rubric) {
  const t = normalize(text);
  let score = 0;
  const hits = [];

  // Simple negation dampener
  const negs = rubric.negation_cues || [];
  const hasNegation = includesAny(t, negs);

  for (const ind of rubric.indicators) {
    if (includesAny(t, ind.patterns)) {
      score += ind.weight;
      hits.push(ind.name);
    }
  }

  // Stopword & negation guardrails (do not fully nullify)
  if (includesAny(t, rubric.stopwords || [])) score = Math.max(0, score - 1);
  if (hasNegation && score <= 3) score = Math.max(0, score - 1);

  const band = rubric.bands.find(b => score >= b.min && score <= b.max) || rubric.bands[rubric.bands.length - 1];
  return { score, band, hits };
}

function renderResults({ score, band, hits }, rubric) {
  document.getElementById('resultsArea').style.display = 'grid';
  document.getElementById('scoreBand').textContent = `Score: ${score} (${band.label})`;

  const summary = document.getElementById('summary');
  summary.innerHTML = `
    <p><strong>Assessment:</strong> ${band.label}. Rule-based indicators suggest this preliminary band. Use for initial screening only.</p>
    <p class="muted">Human review required. Signals are not proof or diagnosis.</p>
  `;

  const signals = document.getElementById('signals');
  signals.innerHTML = '';
  if (hits.length === 0) {
    signals.innerHTML = '<li class="muted">No indicators detected.</li>';
  } else {
    Array.from(new Set(hits)).forEach(h => {
      const li = document.createElement('li');
      li.textContent = h;
      signals.appendChild(li);
    });
  }

  const actions = document.getElementById('actions');
  actions.innerHTML = '';
  (band.guidance || []).forEach(g => {
    const li = document.createElement('li');
    li.textContent = g;
    actions.appendChild(li);
  });

  const showRubric = document.getElementById('showRubric').checked;
  const rc = document.getElementById('rubricCard');
  rc.style.display = showRubric ? 'block' : 'none';
  if (showRubric) rc.textContent = JSON.stringify(rubric, null, 2);
}

function setExample() {
  const example = `Tomorrow at 8am they'll finally listen. I bought what I need and I have the keys to get in through the service door. You'll see.`;
  const ta = document.getElementById('narrative');
  ta.value = example;
  ta.focus();
}

async function main() {
  const diag = document.getElementById('diag');
  const rubric = await loadRubric().catch(e => {
    console.error(e);
    if (diag) diag.textContent = `Error loading rubric: ${String(e)}`;
  });
  if (!rubric) return;

  const runBtn = document.getElementById('run');
  const showRubric = document.getElementById('showRubric');
  const loadExampleBtn = document.getElementById('loadExample');
  const clearBtn = document.getElementById('clearText');

  runBtn.addEventListener('click', () => {
    const txt = document.getElementById('narrative').value || '';
    const result = scoreNarrative(txt, rubric);
    renderResults(result, rubric);
    if (diag) diag.textContent = `Processed ${txt.length} chars using rubric v${rubric.version}`;
  });

  showRubric.addEventListener('change', () => {
    const txt = document.getElementById('narrative').value || '';
    if (txt.trim()) {
      const result = scoreNarrative(txt, rubric);
      renderResults(result, rubric);
    }
  });

  loadExampleBtn.addEventListener('click', setExample);
  clearBtn.addEventListener('click', () => {
    document.getElementById('narrative').value = '';
    document.getElementById('resultsArea').style.display = 'none';
  });
}

main();
