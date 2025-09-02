const DATA_URL = '/assets/resources.json'; // same-origin; works behind Access

const $ = (sel, root=document) => root.querySelector(sel);
const qs = (s, r=document) => Array.from(r.querySelectorAll(s));
const els = {};
const state = {
  q:'', view: localStorage.getItem('rc:view') || 'grid',
  sort: localStorage.getItem('rc:sort') || 'recent',
  filters: JSON.parse(localStorage.getItem('rc:filters') || '{"collection":"All","type":"All","year":"All"}'),
  selected: new Set(),
};
let DATA = [];
let RESULTS_CLICK_BOUND = false;

document.addEventListener('DOMContentLoaded', init);

async function init(){
  mapHooks();
  bindGlobalShortcuts();

  try{
    const r = await fetch(DATA_URL, { credentials:'include', headers:{'accept':'application/json'} });
    if(!r.ok) throw new Error(`fetch ${r.status}`);
    const json = await r.json();
    DATA = Array.isArray(json) ? json.map(x => ({ ...x, id: x.id ?? crypto.randomUUID() })) : [];
  }catch(e){
    console.error('[rc]', e); DATA = [];
  }

  // Query-string → state (q, view, sort, c, t, y)
  seedFromURL();

  hydrateFilters(DATA);
  reflectControls();
  render();
}

function mapHooks(){
  const root = document.querySelector('[data-js="rc-root"]'); if(!root) return;
  els.root=root;
  els.search=$('[data-js="search"]',root);
  els.clear=$('[data-js="clear"]',root);
  els.gridBtn=$('[data-js="view-grid"]',root);
  els.listBtn=$('[data-js="view-list"]',root);
  els.fColl=$('[data-js="filter-collection"]',root);
  els.fType=$('[data-js="filter-type"]',root);
  els.fYear=$('[data-js="filter-year"]',root);
  els.sortSel=$('[data-js="sort"]',root);
  els.reset=$('[data-js="reset"]',root);
  els.count=$('[data-js="count"]',root);
  els.chips=$('[data-js="chips"]',root);
  els.results=$('[data-js="results"]',root);
  els.bulkBar=$('[data-js="bulkbar"]',root);
  els.bulkCount=$('[data-js="bulk-count"]',root);
  els.bulkCopy=$('[data-js="bulk-copy"]',root);
  els.bulkClear=$('[data-js="bulk-clear"]',root);
  els.bulkSelectAll=$('[data-js="bulk-select-all"]',root);
  els.status=$('[data-js="status"]',root);

  // Bind UI
  els.search?.addEventListener('input', ()=>{ state.q=(els.search.value||'').trim().toLowerCase(); syncURL(); render(); });
  els.clear?.addEventListener('click', ()=>{ state.q=''; if(els.search) els.search.value=''; syncURL(); render(); });

  els.gridBtn?.addEventListener('click', ()=> setView('grid'));
  els.listBtn?.addEventListener('click', ()=> setView('list'));

  els.fColl?.addEventListener('change', ()=>{ state.filters.collection = els.fColl.value; persistFilters(); syncURL(); render(); });
  els.fType?.addEventListener('change', ()=>{ state.filters.type = els.fType.value; persistFilters(); syncURL(); render(); });
  els.fYear?.addEventListener('change', ()=>{ state.filters.year = els.fYear.value; persistFilters(); syncURL(); render(); });

  els.sortSel?.addEventListener('change', ()=>{ state.sort = els.sortSel.value; localStorage.setItem('rc:sort', state.sort); syncURL(); render(); });

  els.reset?.addEventListener('click', ()=>{
    state.q=''; if(els.search) els.search.value='';
    state.view = state.view || 'grid'; // keep view
    state.sort='recent'; localStorage.setItem('rc:sort','recent');
    state.filters = { collection:'All', type:'All', year:'All' }; persistFilters();
    reflectControls(); syncURL(); state.selected.clear(); render();
  });

  els.bulkCopy?.addEventListener('click', copySelected);
  els.bulkClear?.addEventListener('click', ()=>{ state.selected.clear(); updateBulk(); render(); });
  els.bulkSelectAll?.addEventListener('click', ()=>{ const visible = sortItems(filterItems(DATA)); visible.forEach(i=> state.selected.add(i.id)); updateBulk(); render(); });
}

function bindGlobalShortcuts(){
  document.addEventListener('keydown', (e)=>{
    if(e.key === '/' && document.activeElement?.tagName !== 'INPUT'){ e.preventDefault(); els.search?.focus(); }
    if(e.key === 'g'){ setView('grid'); }
    if(e.key === 'l'){ setView('list'); }
    if(e.key === 'Escape'){ state.selected.clear(); updateBulk(); }
  });
}

function seedFromURL(){
  const u = new URL(location.href);
  const q=u.searchParams.get('q'); const v=u.searchParams.get('view');
  const s=u.searchParams.get('sort'); const c=u.searchParams.get('c');
  const t=u.searchParams.get('t'); const y=u.searchParams.get('y');
  if(q!=null){ state.q=q; if(els.search) els.search.value=q; }
  if(v==='grid'||v==='list'){ state.view=v; }
  if(s){ state.sort=s; }
  if(c){ state.filters.collection=c; }
  if(t){ state.filters.type=t; }
  if(y){ state.filters.year=y; }
}
function syncURL(){
  const u=new URL(location.href);
  setQS(u,'q',state.q||null);
  setQS(u,'view',state.view!=='grid'?state.view:null);
  setQS(u,'sort',state.sort!=='recent'?state.sort:null);
  setQS(u,'c',state.filters.collection!=='All'?state.filters.collection:null);
  setQS(u,'t',state.filters.type!=='All'?state.filters.type:null);
  setQS(u,'y',state.filters.year!=='All'?state.filters.year:null);
  history.replaceState(null,'',u);
}
function setQS(u,k,v){ if(v==null||v===''){ u.searchParams.delete(k); } else { u.searchParams.set(k,v); } }

function persistFilters(){ localStorage.setItem('rc:filters', JSON.stringify(state.filters)); }
function setView(v){ state.view=v; localStorage.setItem('rc:view',v); reflectControls(); syncURL(); render(); }
function reflectControls(){
  els.gridBtn?.setAttribute('aria-pressed', String(state.view==='grid'));
  els.listBtn?.setAttribute('aria-pressed', String(state.view==='list'));
  if(els.sortSel) els.sortSel.value = state.sort;
  if(els.fColl) els.fColl.value = state.filters.collection || 'All';
  if(els.fType) els.fType.value = state.filters.type || 'All';
  if(els.fYear) els.fYear.value = state.filters.year || 'All';
}

function hydrateFilters(items){
  const coll = ['All', ...dedupe(items.map(i=>i.collection).filter(Boolean))];
  const type = ['All', ...dedupe(items.map(i=>i.type).filter(Boolean))];
  const years = ['All', ...dedupe(items.map(i=> i.year || (i.updated ? new Date(i.updated).getFullYear() : ''))
    .filter(Boolean).map(String))].sort((a,b)=>b.localeCompare(a));
  fillSelect(els.fColl, coll); fillSelect(els.fType, type); fillSelect(els.fYear, years);
}
function fillSelect(sel, arr){ if(!sel) return; sel.innerHTML = arr.map(v=>`<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join(''); }

function render(){
  const items = sortItems(filterItems(DATA));
  setCount(items.length);

  if(!DATA.length){ els.results.innerHTML = tmpl(els.tplEmptyAll); updateBulk(); return; }
  if(items.length===0){ els.results.innerHTML = tmpl(els.tplEmptyFilter); updateBulk(); return; }

  els.results.innerHTML = (state.view==='list' ? items.map(renderRow).join('') : items.map(renderCard).join(''));

  if(!RESULTS_CLICK_BOUND){
    els.results.addEventListener('click', onResultsClick);
    RESULTS_CLICK_BOUND = true;
  }
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

function setCount(n){
  if(!els.count) return;
  els.count.textContent = String(n);
}

function updateBulk(){
  if(els.bulkCount) els.bulkCount.textContent = String(state.selected.size);
  if(els.bulkBar) els.bulkBar.hidden = state.selected.size === 0;
}

function filterItems(items){
  const {collection,type,year} = state.filters; const q=state.q;
  return items.filter(x=>{
    const hay = `${x.title||''} ${x.desc||''} ${(x.tags||[]).join(' ')} ${x.collection||''} ${x.type||''} ${x.year||''}`.toLowerCase();
    const mq = q ? hay.includes(q) : true;
    const mc = (collection==='All') || (x.collection===collection);
    const mt = (type==='All') || (x.type===type);
    const my = (year==='All') || (String(x.year)===String(year) || (x.updated && String(new Date(x.updated).getFullYear())===String(year)));
    return mq && mc && mt && my;
  });
}

function sortItems(items){
  const s=state.sort, out=[...items];
  if(s==='title') out.sort((a,b)=> (a.title||'').localeCompare(b.title||''));
  else if(s==='size') out.sort((a,b)=> (b.bytes||0)-(a.bytes||0));
  else out.sort((a,b)=> new Date(b.updated||0) - new Date(a.updated||0));
  return out;
}

function renderCard(x){
  const size = x.bytes ? ` · ${formatBytes(x.bytes)}` : '';
  const yr = x.year || (x.updated ? new Date(x.updated).getFullYear() : '');
  const tags = (x.tags||[]).map(t=>`<span class=\"rc-tag\">#${escapeHTML(t)}</span>`).join(' ');
  const id = x.id, abs = new URL(x.url, location.origin).href;
  return `
  <article class=\"rc-card\">\n    <header class=\"rc-card-h\"><h3>${escapeHTML(x.title||'Untitled')}</h3></header>\n    <div class=\"rc-card-b\">\n      <p class=\"rc-sub\">${escapeHTML(x.collection||'')}${x.type? ' · '+escapeHTML(x.type):''}${yr? ' · '+escapeHTML(String(yr)):''}${size}</p>\n      ${x.desc? `<p class=\"rc-desc\">${escapeHTML(x.desc)}</p>`:''}\n      <div class=\"rc-tags\">${tags}</div>\n    </div>\n    <footer class=\"rc-card-f\">\n      <a href=\"${x.url}\" class=\"rc-btn\">View</a>\n      <button type=\"button\" class=\"rc-btn\" data-copy=\"${abs}\">Copy Link</button>\n      <label class=\"rc-select\"><input type=\"checkbox\" data-id=\"${id}\" ${state.selected.has(id)?'checked':''}/> Select</label>\n    </footer>\n  </article>`;
}

function renderRow(x){
  const size = x.bytes ? ` · ${formatBytes(x.bytes)}` : '';
  const yr = x.year || (x.updated ? new Date(x.updated).getFullYear() : '');
  const id = x.id, abs = new URL(x.url, location.origin).href;
  return `
  <div class=\"rc-row\">\n    <label class=\"rc-select\"><input type=\"checkbox\" data-id=\"${id}\" ${state.selected.has(id)?'checked':''}/></label>\n    <div class=\"rc-row-main\">\n      <div class=\"rc-row-title\">${escapeHTML(x.title||'Untitled')}</div>\n      <div class=\"rc-row-sub\">${escapeHTML(x.collection||'')}${x.type? ' · '+escapeHTML(x.type):''}${yr? ' · '+escapeHTML(String(yr)):''}${size}</div>\n    </div>\n    <div class=\"rc-row-acts\">\n      <a class=\"rc-btn\" href=\"${x.url}\">View</a>\n      <button class=\"rc-btn\" data-copy=\"${abs}\">Copy Link</button>\n    </div>\n  </div>`;
}

// Copy helpers
async function doCopy(text, btn){ try{ await navigator.clipboard.writeText(text); toast('Link copied.'); pulse(btn); } catch{ fallbackCopy(text); toast('Link copied.'); pulse(btn); } }
async function copySelected(){
  const urls = DATA.filter(x=> state.selected.has(x.id)).map(x=> new URL(x.url, location.origin).href);
  if(!urls.length) return toast('No items selected.');
  try{ await navigator.clipboard.writeText(urls.join('\n')); toast('URLs copied.'); }
  catch{ fallbackCopy(urls.join('\n')); toast('URLs copied.'); }
}
function fallbackCopy(text){ const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }

// Small helpers
function dedupe(a){ return Array.from(new Set(a)); }
function formatBytes(n){ const u=['B','KB','MB','GB','TB']; let i=0,v=n||0; while(v>=1024&&i<u.length-1){ v/=1024; i++; } return `${v.toFixed(v<10&&i?1:0)} ${u[i]}`; }
function escapeHTML(s=''){ return s.replace(/[&<>\"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
function pulse(el){ if(!el) return; el.classList.add('rc-pulse'); setTimeout(()=> el.classList.remove('rc-pulse'), 600); }
function toast(msg){ if(els.status){ els.status.textContent = msg; } }

function tmpl(t){ return t?.innerHTML || ''; }

