const DATA_URL = '/assets/resources.json'; // same-origin; works behind Access

// Helper to query by data-js
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const els = {};
const state = {
  q: '',
  view: localStorage.getItem('rc:view') || 'grid', // 'grid' | 'list'
  sort: 'recent',
  tags: new Set(),               // optional tag system (uses item.tags if present)
  filters: { collection: 'All', type: 'All', year: 'All' },
  selected: new Set(),
};
let DATA = [];

document.addEventListener('DOMContentLoaded', init);

async function init(){
  const root = $('[data-js="rc-root"]');
  if (!root) return console.warn('[rc] root not found');

  // Cache elements
  els.search  = $('[data-js="search"]', root);
  els.clear   = $('[data-js="clear"]', root);
  els.gridBtn = $('[data-js="view-grid"]', root);
  els.listBtn = $('[data-js="view-list"]', root);
  els.fColl   = $('[data-js="filter-collection"]', root);
  els.fType   = $('[data-js="filter-type"]', root);
  els.fYear   = $('[data-js="filter-year"]', root);
  els.sort    = $('[data-js="sort"]', root);
  els.reset   = $('[data-js="reset"]', root);
  els.count   = $('[data-js="count"]', root);
  els.chips   = $('[data-js="chips"]', root);
  els.results = $('[data-js="results"]', root);
  els.bulk    = $('[data-js="bulkbar"]', root);
  els.bulkCount = $('[data-js="bulk-count"]', root);
  els.bulkCopy  = $('[data-js="bulk-copy"]', root);
  els.bulkClear = $('[data-js="bulk-clear"]', root);
  els.status = $('[data-js="status"]', root);
  els.tplEmptyAll = $('[data-js="tpl-empty-all"]', root);
  els.tplEmptyFilter = $('[data-js="tpl-empty-filter"]', root);

  bindUI();

  try{
    const res = await fetch(DATA_URL, { credentials: 'include', headers: { 'accept':'application/json' } });
    if(!res.ok) throw new Error(`fetch ${res.status}`);
    const json = await res.json();
    DATA = Array.isArray(json) ? json.map(memoId) : [];
  }catch(e){
    console.error('[rc]', e);
    DATA = [];
  }

  hydrateFilters(DATA);
  render();
}

function memoId(x){ return { ...x, id: x.id ?? crypto.randomUUID() }; }

function bindUI(){
  // Search + keyboard shortcut
  els.search?.addEventListener('input', () => { state.q = (els.search.value||'').trim().toLowerCase(); render(); });
  document.addEventListener('keydown', (e)=>{ if(e.key === '/' && document.activeElement?.tagName !== 'INPUT'){ e.preventDefault(); els.search?.focus(); }});

  els.clear?.addEventListener('click', ()=>{ state.q=''; if(els.search){ els.search.value=''; } render(); });

  // View toggle
  els.gridBtn?.addEventListener('click', ()=> setView('grid'));
  els.listBtn?.addEventListener('click', ()=> setView('list'));
  reflectView();

  // Filters (defensive: optional)
  els.fColl?.addEventListener('change', ()=>{ state.filters.collection = els.fColl.value; render(); });
  els.fType?.addEventListener('change', ()=>{ state.filters.type = els.fType.value; render(); });
  els.fYear?.addEventListener('change', ()=>{ state.filters.year = els.fYear.value; render(); });

  // Sort
  els.sort?.addEventListener('change', ()=>{ state.sort = els.sort.value; render(); });

  // Reset
  els.reset?.addEventListener('click', ()=>{
    state.q=''; if(els.search) els.search.value='';
    state.sort='recent';
    state.tags.clear();
    state.filters = { collection:'All', type:'All', year:'All' };
    if(els.fColl) els.fColl.value='All';
    if(els.fType) els.fType.value='All';
    if(els.fYear) els.fYear.value='All';
    if(els.sort) els.sort.value='recent';
    render();
  });

  // Bulk actions
  els.bulkCopy?.addEventListener('click', copySelected);
  els.bulkClear?.addEventListener('click', ()=>{ state.selected.clear(); render(); });
}

function setView(v){ state.view=v; localStorage.setItem('rc:view', v); reflectView(); render(); }
function reflectView(){
  if(els.gridBtn) els.gridBtn.setAttribute('aria-pressed', String(state.view==='grid'));
  if(els.listBtn) els.listBtn.setAttribute('aria-pressed', String(state.view==='list'));
}

function hydrateFilters(items){
  // Build option sets
  const coll = ['All', ...dedupe(items.map(i=>i.collection).filter(Boolean))];
  const type = ['All', ...dedupe(items.map(i=>i.type).filter(Boolean))];
  const years = ['All', ...dedupe(items.map(i=> String(i.year || (i.updated ? new Date(i.updated).getFullYear() : '')) ).filter(Boolean)).sort((a,b)=>b.localeCompare(a))];

  fillSelect(els.fColl, coll);
  fillSelect(els.fType, type);
  fillSelect(els.fYear, years);
}

function fillSelect(sel, arr){
  if(!sel) return;
  sel.innerHTML = arr.map(v=>`<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join('');
  sel.value = arr[0] || 'All';
}

function render(){
  const items = sortItems(filterItems(DATA));
  els.count && (els.count.textContent = String(items.length));

  if(!DATA.length){
    els.results.innerHTML = els.tplEmptyAll?.innerHTML || '';
    updateBulk();
    return;
  }
  if(items.length===0){
    els.results.innerHTML = els.tplEmptyFilter?.innerHTML || '';
    updateBulk();
    return;
  }

  if(state.view==='list'){
    els.results.innerHTML = items.map(renderRow).join('');
  }else{
    els.results.innerHTML = items.map(renderCard).join('');
  }

  // Wire delegated events (copy/select)
  els.results.addEventListener('click', onResultsClick);
  updateBulk();
}

function onResultsClick(e){
  const copyBtn = e.target.closest('[data-copy]');
  if(copyBtn){ doCopy(copyBtn.getAttribute('data-copy'), copyBtn); return; }
  const sel = e.target.closest('input[type="checkbox"][data-id]');
  if(sel){
    const id = sel.getAttribute('data-id');
    sel.checked ? state.selected.add(id) : state.selected.delete(id);
    updateBulk();
  }
}

function updateBulk(){
  if(els.bulkCount) els.bulkCount.textContent = String(state.selected.size);
}

function filterItems(items){
  const q = state.q;
  const { collection, type, year } = state.filters;
  return items.filter(x=>{
    const hay = `${x.title||''} ${x.desc||''} ${(x.tags||[]).join(' ')} ${x.collection||''} ${x.type||''} ${x.year||''}`.toLowerCase();
    const mq = q ? hay.includes(q) : true;
    const mc = (collection==='All') || (x.collection === collection);
    const mt = (type==='All') || (x.type === type);
    const my = (year==='All') || (String(x.year)===String(year) || (x.updated && String(new Date(x.updated).getFullYear())===String(year)));
    return mq && mc && mt && my;
  });
}

function sortItems(items){
  const s = state.sort;
  const copy = [...items];
  if(s==='title') copy.sort((a,b)=> (a.title||'').localeCompare(b.title||''));
  else if(s==='size') copy.sort((a,b)=> (b.bytes||0) - (a.bytes||0));
  else copy.sort((a,b)=> new Date(b.updated||0) - new Date(a.updated||0)); // recent default
  return copy;
}

function renderCard(x){
  const size = x.bytes ? ` · ${formatBytes(x.bytes)}` : '';
  const yr = x.year || (x.updated ? new Date(x.updated).getFullYear() : '');
  const tags = (x.tags||[]).map(t=>`<span class="rc-tag">#${escapeHTML(t)}</span>`).join(' ');
  const id = x.id;
  const abs = new URL(x.url, location.origin).href;
  return `
  <article class="rc-card">
    <header class="rc-card-h"><h3>${escapeHTML(x.title||'Untitled')}</h3></header>
    <div class="rc-card-b">
      <p class="rc-sub">${escapeHTML(x.collection||'')}${x.type? ' · '+escapeHTML(x.type):''}${yr? ' · '+escapeHTML(String(yr)):''}${size}</p>
      ${x.desc? `<p class="rc-desc">${escapeHTML(x.desc)}</p>`:''}
      <div class="rc-tags">${tags}</div>
    </div>
    <footer class="rc-card-f">
      <a href="${x.url}" class="rc-btn">View</a>
      <button type="button" class="rc-btn" data-copy="${abs}">Copy Link</button>
      <label class="rc-select">
        <input type="checkbox" data-id="${id}" ${state.selected.has(id)?'checked':''}/> Select
      </label>
    </footer>
  </article>`;
}

function renderRow(x){
  const size = x.bytes ? ` · ${formatBytes(x.bytes)}` : '';
  const yr = x.year || (x.updated ? new Date(x.updated).getFullYear() : '');
  const id = x.id;
  const abs = new URL(x.url, location.origin).href;
  return `
  <div class="rc-row">
    <label class="rc-select"><input type="checkbox" data-id="${id}" ${state.selected.has(id)?'checked':''}/></label>
    <div class="rc-row-main">
      <div class="rc-row-title">${escapeHTML(x.title||'Untitled')}</div>
      <div class="rc-row-sub">${escapeHTML(x.collection||'')}${x.type? ' · '+escapeHTML(x.type):''}${yr? ' · '+escapeHTML(String(yr)):''}${size}</div>
    </div>
    <div class="rc-row-acts">
      <a class="rc-btn" href="${x.url}">View</a>
      <button class="rc-btn" data-copy="${abs}">Copy Link</button>
    </div>
  </div>`;
}

// Copy helpers
async function doCopy(text, btn){
  try{ await navigator.clipboard.writeText(text); speak('Link copied.'); pulse(btn); }
  catch{ fallbackCopy(text); speak('Link copied.'); pulse(btn); }
}
async function copySelected(){
  const urls = DATA.filter(x=> state.selected.has(x.id)).map(x=> new URL(x.url, location.origin).href);
  if(!urls.length) return;
  try{ await navigator.clipboard.writeText(urls.join('\n')); speak('URLs copied.'); }
  catch{ fallbackCopy(urls.join('\n')); speak('URLs copied.'); }
}
function fallbackCopy(text){
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta);
  ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
}

function speak(msg){ if(els.status){ els.status.textContent = msg; } }
function pulse(el){ if(!el) return; el.classList.add('rc-pulse'); setTimeout(()=> el.classList.remove('rc-pulse'), 600); }

// Utils
function dedupe(arr){ return Array.from(new Set(arr)); }
function formatBytes(n){ const u=['B','KB','MB','GB','TB']; let i=0,v=n||0; while(v>=1024&&i<u.length-1){ v/=1024; i++; } return `${v.toFixed(v<10&&i?1:0)} ${u[i]}`; }
function escapeHTML(s=''){ return s.replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

