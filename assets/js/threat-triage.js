/* Threat Triage client logic */
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => [...e.querySelectorAll(s)];

function setVal(id, val = '') {
    const el = document.getElementById(id);
    if (!el) return;
    if ('value' in el) el.value = val ?? '';
    else el.textContent = String(val ?? '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

function wireCounters() {
    const nar = $('#narrative');
    const outNar = $('#countNarrative');
    if (nar && outNar) {
        const update = () => outNar.textContent = String(nar.value.length);
        nar.addEventListener('input', update); update();
    }
}

async function loadExampleCase() {
    let example;
    try {
        const r = await fetch('/assets/data/triage/example-case.json', { cache: 'no-cache' });
        if (!r.ok) throw new Error('404');
        example = await r.json();
    } catch {
        example = {
            caseId: 'EX-2025-001',
            title: 'Example: Suspicious online exchange',
            date: '2025-08-18',
            location: 'Albany, NY',
            narrative: 'Subject A communicated with Subject B on Platform X. Messages included threats, doxxing hints, and references to previous incidents. The conversation escalated around 22:15 EST.\n\nCollected artifacts: screenshots, message IDs.\n\nRequested: entity extraction (people, orgs, handles), keyword clusters, timeline, and a brief risk summary.',
            tags: ['threats', 'online-harassment', 'doxxing'],
            entities: { people: ['Subject A', 'Subject B'], orgs: ['Platform X'], handles: ['@handleA'] },
            notes: 'Demonstration record for UI testing.'
        };
    }
    setVal('caseId', example.caseId);
    setVal('title', example.title);
    setVal('date', example.date);
    setVal('location', example.location);
    setVal('narrative', example.narrative);
    setVal('tags', Array.isArray(example.tags) ? example.tags.join(', ') : (example.tags || ''));
    setVal('notes', example.notes || '');
    if (example.entities) {
        try { setVal('entities', JSON.stringify(example.entities, null, 2)); }
        catch { setVal('entities', String(example.entities)); }
    }
    if (typeof updateDerived === 'function') updateDerived(example);
}

function clearAll() {
    ['caseId', 'title', 'date', 'location', 'narrative', 'tags', 'entities', 'notes'].forEach(id => setVal(id, ''));
}

async function copyNarrative() {
    const nar = $('#narrative'); if (!nar) return;
    try { await navigator.clipboard.writeText(nar.value); toast('Narrative copied.'); }
    catch { toast('Copy failed.'); }
}

function exportJSON() {
    const data = {
        caseId: $('#caseId')?.value || '',
        title: $('#title')?.value || '',
        date: $('#date')?.value || '',
        location: $('#location')?.value || '',
        narrative: $('#narrative')?.value || '',
        tags: ($('#tags')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
        entities: tryParse($('#entities')?.value),
        notes: $('#notes')?.value || ''
    };
    download('threat-triage.json', JSON.stringify(data, null, 2));
}

function tryParse(s) { if (!s) return undefined; try { return JSON.parse(s); } catch { return s; } }

function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

function toast(msg) { console.log(msg); }

async function analyzeWithAI() {
    const nar = $('#narrative')?.value?.trim() || ''; if (!nar) return toast('Add a narrative first.');
    const prompt = [
        { role: 'system', content: 'You are an analyst assisting with threat triage. Extract entities, summarize risk, and suggest next steps concisely.' },
        { role: 'user', content: `Narrative:\n${nar}` }
    ];
    try {
        const r = await fetch('/api/triage-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: prompt }) });
        const j = await r.json();
        const reply = j?.choices?.[0]?.message?.content || 'No content returned.';
        setVal('notes', ($('#notes')?.value ? $('#notes').value + '\n\n' : '') + reply);
        toast('AI analysis added to notes.');
    } catch (e) {
        console.error(e); toast('AI analysis failed.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    $('#btnLoadExample')?.addEventListener('click', loadExampleCase);
    $('#btnClear')?.addEventListener('click', clearAll);
    $('#btnCopy')?.addEventListener('click', copyNarrative);
    $('#btnExport')?.addEventListener('click', exportJSON);
    $('#btnAnalyze')?.addEventListener('click', analyzeWithAI);
    wireCounters();
});
