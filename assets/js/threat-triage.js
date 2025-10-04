/* Threat Triage client logic */
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => [...e.querySelectorAll(s)];

// Map example titles → URL
const EXAMPLE_MAP = {
    'Virginia School Threat': '/assets/data/triage/example-case.json'
};

function setVal(id, val = '') {
    const el = document.getElementById(id); if (!el) return;
    if ('value' in el) el.value = val ?? ''; else el.textContent = String(val ?? '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

function tryParse(s) { if (!s) return undefined; try { return JSON.parse(s); } catch { return s; } }

async function loadExampleCase() {
    const sel = $('#exampleSelect');
    const key = sel?.value || '';
    const url = EXAMPLE_MAP[key];
    let example;
    try {
        if (!url) throw new Error('No mapped URL');
        const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error('404');
        example = await r.json();
    } catch {
        example = { caseId: 'EX-2025-001', title: 'Example: Suspicious online exchange', date: '2025-08-18', location: 'Albany, NY', narrative: 'Subject A communicated with Subject B on Platform X. Messages included threats, doxxing hints, and references to previous incidents. The conversation escalated around 22:15 EST.\n\nCollected artifacts: screenshots, message IDs.\n\nRequested: entity extraction (people, orgs, handles), keyword clusters, timeline, and a brief risk summary.', tags: ['threats', 'online-harassment', 'doxxing'], entities: { people: ['Subject A', 'Subject B'], orgs: ['Platform X'], handles: ['@handleA'] }, notes: 'Demonstration record for UI testing.' };
    }
    setVal('caseId', example.caseId); setVal('title', example.title); setVal('date', example.date); setVal('location', example.location); setVal('narrative', example.narrative); setVal('tags', Array.isArray(example.tags) ? example.tags.join(', ') : (example.tags || '')); setVal('notes', example.notes || '');
    if (example.entities) { try { setVal('entities', JSON.stringify(example.entities, null, 2)); } catch { setVal('entities', String(example.entities)); } }
    if (typeof updateDerived === 'function') updateDerived(example);
}

function clearAll() { ['caseId', 'title', 'date', 'location', 'narrative', 'tags', 'entities', 'notes'].forEach(id => setVal(id, '')); }

async function copyNarrative() { const nar = $('#narrative'); if (!nar) return; try { await navigator.clipboard.writeText(nar.value); toast('Narrative copied.'); } catch { toast('Copy failed.'); } }

function exportJSON() {
    const data = { caseId: $('#caseId')?.value || '', title: $('#title')?.value || '', date: $('#date')?.value || '', location: $('#location')?.value || '', narrative: $('#narrative')?.value || '', tags: ($('#tags')?.value || '').split(',').map(s => s.trim()).filter(Boolean), entities: tryParse($('#entities')?.value), notes: $('#notes')?.value || '' };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'threat-triage.json'; a.click(); URL.revokeObjectURL(a.href);
}

function toast(msg) { console.log(msg); }

function wireCounters() { const nar = $('#narrative'), out = $('#countNarrative'); if (nar && out) nar.addEventListener('input', () => out.textContent = String(nar.value.length)); }

async function analyzeWithAI() {
    const nar = $('#narrative')?.value?.trim() || ''; if (!nar) return toast('Add a narrative first.');
    const prompt = [{ role: 'system', content: 'You are an analyst assisting with threat triage. Extract entities, summarize risk, and suggest next steps concisely.' }, { role: 'user', content: `Narrative:\n${nar}` }];
    try { const r = await fetch('/api/triage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: prompt }) }); const j = await r.json(); const reply = j?.choices?.[0]?.message?.content || 'No content returned.'; setVal('notes', ($('#notes')?.value ? $('#notes').value + '\n\n' : '') + reply); toast('AI analysis added to notes.'); } catch (e) { console.error(e); toast('AI analysis failed.'); }
}

document.addEventListener('DOMContentLoaded', () => {
    $('#btnLoadExample')?.addEventListener('click', loadExampleCase);
    $('#exampleSelect')?.addEventListener('change', loadExampleCase);
    $('#btnClear')?.addEventListener('click', clearAll);
    $('#btnCopy')?.addEventListener('click', copyNarrative);
    $('#btnExport')?.addEventListener('click', exportJSON);
    $('#btnAnalyze')?.addEventListener('click', analyzeWithAI);
    wireCounters();
});
