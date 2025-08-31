(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const qs = new URLSearchParams(location.search);

  // App state
  const state = {
    items: [],
    filtered: [],
    tags: new Set(),
    activeTags: new Set(),
    selectedIds: new Set(),
    view: localStorage.getItem('rc:view') || (qs.get('view') || 'grid'), // grid | list
    fuse: null
  };

  // Utils
  const ext = p => (p||'').split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || '';
  const fmtBytes = n => (!n && n!==0) ? "" :
    n < 1024 ? `${n} B` :
    n < 1048576 ? `${(n/1024).toFixed(1)} KB` :
    n < 1073741824 ? `${(n/1048576).toFixed(1)} MB` : `${(n/1073741824).toFixed(2)} GB`;
  const isR2 = path => path.startsWith('/dl/');
  const debounce = (fn, ms=160) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
  const clip = async (text) => { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch {} };
  const toast = (msg) => { const t=$('#rc-toast'); t.textContent=msg; t.hidden=false; setTimeout(()=>{t.hidden=true},1300); };
  const toTitle = s => (s||'').trim();

  // Fuzzy search (tiny inline; no dependency)
  const normalize = s => (s||'').toLowerCase();
  const fuzzyScore = (q, str) => {
    // simple subsequence score
    q = normalize(q); str = normalize(str); if (!q) return 1;
    let qi=0, score=0;
    for (let i=0;i<str.length && qi<q.length;i++){ if (str[i]===q[qi]){ qi++; score+=2; } else { score-=0.1; } }
    return qi===q.length ? score/Math.max(str.length,1) : -1;
  };

  // Inference
  const inferTypeFromExt = e => {
    if (["pdf"].includes(e)) return 'pdf';
    if (["epub"].includes(e)) return 'epub';
    if (["docx","doc","rtf"].includes(e)) return 'docx';
    if (["md","markdown"].includes(e)) return 'md';
    if (["txt","log"].includes(e)) return 'txt';
    if (["css"].includes(e)) return 'css';
    if (["csv"].includes(e)) return 'csv';
    if (["json"].includes(e)) return 'json';
    if (["parquet"].includes(e)) return 'parquet';
    if (["xlsx","xls"].includes(e)) return 'xlsx';
    return 'other';
  };

  // Build tags and years
  const buildFacets = (items) => {
    state.tags = new Set();
    const years = new Set();
    items.forEach(it => {
      (it.tags||[]).forEach(t => state.tags.add(t));
      const y = (it.added_at||'').slice(0,4); if (y) years.add(y);
    });
    const yearSel = $('#rc-year'); yearSel.innerHTML = '<option value="">All years</option>' +
      [...years].sort((a,b)=>b.localeCompare(a)).map(y=>`<option value="${y}">${y}</option>`).join('');
  };

  // Render tags filter
  const hydrateTags = () => {
    const wrap = $('#rc-tags'); wrap.innerHTML = '';
    [...state.tags].sort((a,b)=>a.localeCompare(b)).forEach(tag => {
      const b = document.createElement('button');
      b.className = 'rc-tag'; b.textContent = tag;
      if (qs.getAll('tag').includes(tag)) { state.activeTags.add(tag); b.classList.add('active'); }
      b.addEventListener('click', () => {
        state.activeTags.has(tag) ? state.activeTags.delete(tag) : state.activeTags.add(tag);
        b.classList.toggle('active');
        applyFilters();
        syncQuery();
      });
      wrap.appendChild(b);
    });
  };

  // Render functions (virtualized mount)
  const results = $('#rc-results');
  const render = () => {
    $('#rc-empty').hidden = !!state.filtered.length;
    $('#rc-count').textContent = `${state.filtered.length} item${state.filtered.length===1?'':'s'}`;

    results.className = state.view === 'list' ? 'rc-list' : 'rc-grid';
    results.innerHTML = ''; // simple mount; list is not massive yet

    const tplCard = $('#rc-card-template');
    const tplRow = $('#rc-row-template');
    const frag = document.createDocumentFragment();

    state.filtered.forEach(it => {
      const type = it.type || inferTypeFromExt(ext(it.path));
      const origin = isR2(it.path) ? 'R2' : 'Repo';

      if (state.view === 'list') {
        const row = tplRow.content.cloneNode(true);
        row.querySelector('[data-type]').textContent = type.toUpperCase();
        row.querySelector('[data-collection]').textContent = (it.collection||'').toUpperCase();
        row.querySelector('[data-origin]').textContent = origin;
        const a = row.querySelector('[data-href]'); a.href = it.path; a.textContent = toTitle(it.title);
        row.querySelector('[data-size]').textContent = fmtBytes(it.size_bytes);
        row.querySelector('[data-updated]').textContent = it.updated_at || it.added_at || '';
        wireActions(row, it);
        frag.appendChild(row);
      } else {
        const node = tplCard.content.cloneNode(true);
        node.querySelector('[data-type]').textContent = type.toUpperCase();
        node.querySelector('[data-collection]').textContent = (it.collection||'').toUpperCase();
        node.querySelector('[data-origin]').textContent = origin;
        node.querySelector('[data-title]').textContent = toTitle(it.title);
        node.querySelector('[data-desc]').textContent = it.description || '';
        node.querySelector('[data-updated]').textContent = it.updated_at ? `Updated ${it.updated_at}` : (it.added_at ? `Added ${it.added_at}` : '');
        node.querySelector('[data-size]').textContent = fmtBytes(it.size_bytes);
        node.querySelector('[data-tagsline]').textContent = (it.tags||[]).join(' · ');
        const a = node.querySelector('[data-href]'); a.href = it.path;
        wireActions(node, it);
        frag.appendChild(node);
      }
    });
    results.appendChild(frag);
    updateBulkBar();
  };

  // Quick actions
  const wireActions = (root, it) => {
    const a = root.querySelector('[data-href]');
    if (a) a.addEventListener('click', (e) => { e.preventDefault(); handleOpen(it); });

    const url = new URL(it.path, location.origin).toString();
    root.querySelectorAll('[data-copy-url]')?.forEach(btn=>btn.addEventListener('click',()=>clip(url)));
    root.querySelectorAll('[data-copy-md]')?.forEach(btn=>btn.addEventListener('click',()=>clip(`[${it.title}](${url})`)));
    root.querySelectorAll('[data-copy-html]')?.forEach(btn=>btn.addEventListener('click',()=>clip(`<a href="${url}" target="_blank" rel="noopener">${escapeHtml(it.title)}</a>`)));
    root.querySelectorAll('[data-copy-json]')?.forEach(btn=>btn.addEventListener('click',()=>clip(JSON.stringify(it, null, 2))));

    const cb = root.querySelector('[data-select]');
    if (cb) {
      cb.checked = state.selectedIds.has(it.id);
      cb.addEventListener('change', (e)=>{ e.target.checked ? state.selectedIds.add(it.id) : state.selectedIds.delete(it.id); updateBulkBar(); });
      root.addEventListener('click', (e)=>{ if (e.shiftKey) { cb.click(); }});
    }
  };

  const updateBulkBar = () => {
    const bar = $('#rc-bulkbar'); const n = state.selectedIds.size; $('#rc-bulkcount').textContent = n;
    bar.hidden = n===0;
  };

  // Safe text
  const escapeHtml = s => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  // Preview handlers (reuse existing modal CSS from earlier version)
  const showModal = (innerHTML, title, href) => {
    let modal = $('#rc-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'rc-modal';
      modal.innerHTML = `
        <div class="rc-modal-backdrop"></div>
        <div class="rc-modal" role="dialog" aria-modal="true" aria-labelledby="rc-modal-title">
          <header class="rc-modal-h">
            <h3 id="rc-modal-title"></h3>
            <div class="rc-modal-actions">
              <a id="rc-modal-open" target="_blank" rel="noopener">Open</a>
              <button id="rc-modal-close" aria-label="Close">Close</button>
            </div>
          </header>
          <div class="rc-modal-b" id="rc-modal-body"></div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#rc-modal-close').addEventListener('click', () => modal.remove());
      modal.querySelector('.rc-modal-backdrop').addEventListener('click', () => modal.remove());
      document.addEventListener('keydown', (e)=>{ if (e.key==='Escape' && $('#rc-modal')) $('#rc-modal').remove(); });
    }
    modal.querySelector('#rc-modal-title').textContent = title || 'Preview';
    modal.querySelector('#rc-modal-open').href = href || '#';
    modal.querySelector('#rc-modal-body').innerHTML = innerHTML;
  };

  const parseCSVPreview = text => {
    const lines = text split(/\r?\n/).slice(0, 101);
    return lines.map(l => l.split(','));
  };

  const handleOpen = async (it) => {
    const e = ext(it.path);
    const type = it.type || inferTypeFromExt(e);
    const pv = (it.preview||{});
    const maxBytes = pv.max_bytes ?? 524288;
    const maxRows = pv.max_rows ?? 100;

    if (type === 'pdf') return window.open(it.path, '_blank', 'noopener');
    if (['epub','docx','parquet','xlsx','other','link'].includes(type)) return window.open(it.path, '_blank', 'noopener');

    if (type === 'md' || type === 'txt' || type === 'css') {
      try {
        const res = await fetch(it.path, {cache:'no-store'}); const text = await res.text();
        const sample = text.length > maxBytes ? text.slice(0, maxBytes) + '\n…(truncated)…' : text;
        showModal(`<pre style="white-space:pre-wrap">${escapeHtml(sample)}</pre>`, it.title, it.path);
      } catch { window.open(it.path, '_blank', 'noopener'); }
      return;
    }

    if (type === 'csv') {
      try {
        const res = await fetch(it.path, {cache:'no-store'}); const text = await res.text();
        const rows = parseCSVPreview(text); const head = rows[0]||[]; const body = rows.slice(1, Math.min(rows.length, maxRows+1));
        const html = ['<div class="rc-table-wrap"><table class="rc-table"><thead><tr>',
          ...head.map(h=>`<th>${escapeHtml(h)}</th>`), '</tr></thead><tbody>',
          ...body.map(r=>`<tr>${r.map(c=>`<td>${escapeHtml(c)}</td>`).join('')}</tr>`), '</tbody></table></div>'].join('');
        showModal(html, it.title, it.path);
      } catch { window.open(it.path, '_blank', 'noopener'); }
      return;
    }

    if (type === 'json') {
      try {
        const res = await fetch(it.path, {cache:'no-store'}); const data = await res.json();
        showModal(`<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`, it.title, it.path);
      } catch { window.open(it.path, '_blank', 'noopener'); }
      return;
    }

    window.open(it.path, '_blank', 'noopener');
  };

  // Filtering, sorting, fuzzy search
  const getFilters = () => ({
    q: $('#rc-search').value.trim(),
    type: $('#rc-type').value || '',
    col: $('#rc-collection').value || '',
    year: $('#rc-year').value || '',
    sort: $('#rc-sort').value || 'new',
    tags: [...state.activeTags]
  });

  const applyFilters = () => {
    const f = getFilters();
    const q = f.q.toLowerCase();

    let items = state.items slice();

    if (f.col) items = items.filter(it => it.collection === f.col);
    if (f.type) items = items.filter(it => (it.type || inferTypeFromExt(ext(it.path))) === f.type);
    if (f.year) items = items.filter(it => (it.added_at||'').startsWith(f.year));
    if (state.activeTags.size) items = items.filter(it => (it.tags||[]).some(t => state.activeTags.has(t)));

    if (q) {
      items = items
        .map(it => {
          const hay = [it.title, it.description, ...(it.tags||[])].join(' ');
          return { it, score: fuzzyScore(q, hay) };
        })
        .filter(r => r.score > 0)
        .sort((a,b) => b.score - a.score)
        .map(r => r.it);
    }

    switch (f.sort) {
      case 'old': items.sort((a,b) => (a.updated_at||a.added_at||'').localeCompare(b.updated_at||b.added_at||'')); break;
      case 'title': items.sort((a,b) => (a.title||'').localeCompare(b.title||'')); break;
      case 'size': items.sort((a,b) => (b.size_bytes||0)-(a.size_bytes||0)); break;
      default: // new
        items.sort((a,b) => (b.updated_at||b.added_at||'').localeCompare(a.updated_at||a.added_at||'') || (a.title||'').localeCompare(b.title||''));
    }

    state.filtered = items;
    render();
  };

  // Querystring sync for shareable views
  const syncQuery = () => {
    const f = getFilters();
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    if (f.type) p.set('type', f.type);
    if (f.col) p.set('col', f.col);
    if (f.year) p.set('year', f.year);
    if (f.sort && f.sort!=='new') p.set('sort', f.sort);
    if (state.view !== 'grid') p.set('view', state.view);
    f.tags.forEach(t => p.append('tag', t));
    history.replaceState(null, '', `${location.pathname}?${p.toString()}`);
  };

  // Controls
  const initControls = () => {
    // Initialize fields from QS
    $('#rc-search').value = qs.get('q') || '';
    $('#rc-type').value = qs.get('type') || '';
    $('#rc-collection').value = qs.get('col') || '';
    $('#rc-sort').value = qs.get('sort') || 'new';

    // View buttons
    const gridBtn = $('#rc-grid'), listBtn = $('#rc-list');
    const setView = v => {
      state.view = v;
      localStorage.setItem('rc:view', v);
      gridBtn.setAttribute('aria-pressed', String(v==='grid'));
      listBtn.setAttribute('aria-pressed', String(v==='list'));
      applyFilters(); syncQuery();
    };
    gridBtn.addEventListener('click', ()=>setView('grid'));
    listBtn.addEventListener('click', ()=>setView('list'));
    setView(state.view);

    // Search & Filters
    $('#rc-search').addEventListener('input', debounce(()=>{ applyFilters(); syncQuery(); }, 180));
    $('#rc-clear').addEventListener('click', ()=>{ $('#rc-search').value=''; applyFilters(); syncQuery(); });
    ['#rc-type','#rc-collection','#rc-year','#rc-sort'].forEach(id => $(id).addEventListener('change', ()=>{ applyFilters(); syncQuery(); }));
    $('#rc-reset').addEventListener('click', ()=>{
      state.activeTags.clear();
      $('#rc-search').value=''; $('#rc-type').value=''; $('#rc-collection').value=''; $('#rc-year').value=''; $('#rc-sort').value='new';
      $$('#rc-tags .rc-tag').forEach(el=>el.classList.remove('active'));
      applyFilters(); syncQuery();
    });

    // Bulk actions
    $('#rc-bulk-copy').addEventListener('click', ()=>{
      const urls = state.filtered.filter(it => state.selectedIds.has(it.id))
                     .map(it => new URL(it.path, location.origin).toString()).join('\n');
      if (urls) clip(urls);
    });
    $('#rc-bulk-clear').addEventListener('click', ()=>{ state.selectedIds.clear(); render(); });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e)=>{
      if (e.key === '/' && document.activeElement?.tagName!=='INPUT'){ e.preventDefault(); $('#rc-search').focus(); }
      if (e.key === 'g') setView('grid');
      if (e.key === 'l') setView('list');
      if (e.key === 'c' && (e.metaKey || e.ctrlKey) === false){ $('#rc-reset').click(); }
    });
  };

  // Boot
  const boot = async () => {
    try {
      const res = await fetch('/resources/_data/resources.json',{cache:'no-store'});
      const items = await res.json();
      state.items = Array.isArray(items) ? items : [];
      buildFacets(state.items);
      hydrateTags();
      initControls();
      applyFilters();
    } catch (e) {
      console.error('Failed to load resources.json', e);
      $('#rc-empty').hidden = false;
      $('#rc-empty').textContent = 'Error loading resources index.';
    }
  };

  document.addEventListener('DOMContentLoaded', boot);
})();


