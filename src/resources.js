const DATA_URL = '/assets/resources.json';

const els = { q:null, sort:null, chips:null, grid:null, download:null, status:null, emptyAll:null, emptyFilter:null };
let DATA = [];
const state = { q:'', tags:new Set(), sort:'recent', selected:new Set() };

document.addEventListener('DOMContentLoaded', async () => {
  els.q = document.querySelector('#q');
  els.sort = document.querySelector('#sort');
  els.chips = document.querySelector('#chips');
  els.grid = document.querySelector('#grid');
  els.download = document.querySelector('#downloadSelected');
  els.status = document.querySelector('#status');
  els.emptyAll = document.querySelector('#empty-all');
  els.emptyFilter = document.querySelector('#empty-filter');

  wireEvents();

  try {
    const res = await fetch(DATA_URL, { credentials: 'include', headers: { 'accept': 'application/json' } });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const raw = await res.json();
    // Memoize IDs ONCE so selection remains stable across renders
    DATA = (Array.isArray(raw) ? raw : []).map(rec => ({ ...rec, id: rec.id ?? crypto.randomUUID() }));
    renderChips(collectTags(DATA));
    render();
  } catch (err) {
    console.error(err);
    toast(`Couldn’t load resources.`, true);
    DATA = [];
    render(); // still render empty state
  }
});

function wireEvents() {
  els.q.addEventListener('input', () => { state.q = els.q.value.trim().toLowerCase(); render(); });
  els.sort.addEventListener('change', () => { state.sort = els.sort.value; render(); });
  els.chips.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tag]'); if (!btn) return;
    const tag = btn.dataset.tag;
    state.tags.has(tag) ? state.tags.delete(tag) : state.tags.add(tag);
    renderChips(collectTags(DATA)); render();
  });
  els.download.addEventListener('click', handleBulkDownload);
  els.grid.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('button[data-copy]');
    if (copyBtn) { copyToClipboard(copyBtn.dataset.copy, copyBtn); return; }
    const sel = e.target.closest('input[type="checkbox"][data-id]');
    if (sel) {
      const id = sel.dataset.id;
      sel.checked ? state.selected.add(id) : state.selected.delete(id);
      els.download.disabled = state.selected.size === 0;
    }
  });
}

function collectTags(items) { return [...new Set(items.flatMap(x => x.tags || []))].sort(); }

function renderChips(tags) {
  els.chips.innerHTML = tags.map(t => {
    const active = state.tags.has(t);
    return `<button type="button" data-tag="${t}" class="px-2 py-1 rounded border text-sm ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}">#${t}</button>`;
  }).join('');
}

function render() {
  const filtered = filterItems(DATA);
  const items = sortItems(filtered);
  if (!DATA.length) {
    els.grid.innerHTML = (els.emptyAll?.innerHTML ?? '');
  } else if (!items.length) {
    els.grid.innerHTML = (els.emptyFilter?.innerHTML ?? '');
  } else {
    els.grid.innerHTML = items.map(card).join('');
  }
  els.download.disabled = state.selected.size === 0;
}

function filterItems(items) {
  const q = state.q, tags = state.tags;
  return items.filter(x => {
    const hay = `${x.title||''} ${x.desc||''} ${(x.tags||[]).join(' ')}`.toLowerCase();
    const matchQ = q ? hay.includes(q) : true;
    const matchT = tags.size ? (x.tags||[]).some(t => tags.has(t)) : true;
    return matchQ && matchT;
  });
}

function sortItems(items) {
  const s = state.sort;
  return [...items].sort((a,b) => {
    if (s === 'title') return (a.title||'').localeCompare(b.title||'');
    if (s === 'size') return (b.bytes||0) - (a.bytes||0);
    return new Date(b.updated||0) - new Date(a.updated||0); // default: recent
  });
}

function card(x) {
  const absolute = new URL(x.url, location.origin).href;
  const size = x.bytes ? ` · ${formatBytes(x.bytes)}` : '';
  const tags = (x.tags||[]).map(t => `<span class="text-xs text-slate-500">#${t}</span>`).join(' ');
  return `
  <article class="p-4 rounded border bg-white flex flex-col gap-2">
    <h2 class="font-medium">${escapeHTML(x.title||'Untitled')}</h2>
    <p class="text-sm text-slate-600">${escapeHTML(x.desc||'')}</p>
    <div class="text-xs text-slate-500">${escapeHTML(x.updated||'')}${size}</div>
    <div class="flex gap-2 mt-1">${tags}</div>
    <div class="mt-2 flex items-center gap-2">
      <a href="${x.url}" download class="px-2 py-1 border rounded">Download</a>
      <button type="button" class="px-2 py-1 border rounded" data-copy="${absolute}">Copy link</button>
      <label class="ml-auto flex items-center gap-2 text-sm">
        <input type="checkbox" data-id="${x.id}" ${state.selected.has(x.id) ? 'checked' : ''}/>
        <span>Select</span>
      </label>
    </div>
  </article>`;
}

// === Utilities ===
function formatBytes(n){const u=['B','KB','MB','GB','TB'];let i=0,v=n||0;while(v>=1024&&i<u.length-1){v/=1024;i++;}return `${v.toFixed(v<10&&i?1:0)} ${u[i]}`;}
function escapeHTML(s=''){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function copyToClipboard(text, btn){
  try{ await navigator.clipboard.writeText(text); toast('Link copied.'); pulse(btn); }
  catch{ const ta=Object.assign(document.createElement('textarea'),{value:text}); ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); toast('Link copied.'); pulse(btn); }
}
function pulse(el){ el.classList.add('ring-2','ring-green-500'); setTimeout(()=>el.classList.remove('ring-2','ring-green-500'),600); }
function toast(msg,isErr=false){ els.status.textContent = msg; if(isErr) console.warn(msg); }
async function handleBulkDownload(){
  const ids=[...state.selected]; if(!ids.length) return;
  const files=filterItems(DATA).filter(x => ids.includes(x.id));
  for(const f of files){
    const a=document.createElement('a'); a.href=f.url; a.download=''; document.body.appendChild(a); a.click(); a.remove();
    await new Promise(r=>setTimeout(r,250));
  }
  toast(`Started ${files.length} download${files.length>1?'s':''}.`);
}

