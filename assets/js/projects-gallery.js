/* eslint-disable */
/* @ts-nocheck */
// Projects gallery renderer: fetch JSON with no-cache and fall back to #pp-data
export default (function initProjectsGallery() {
    const $ = (s, e = document) => e.querySelector(s);
    const list = $('#pp-results');
    const tpl = $('#pp-card');
    const sortSel = $('#pp-sort');
    const input = $('#pp-search');
    const btnGrid = document.getElementById('pp-view-grid');
    const btnList = document.getElementById('pp-view-list');
    const btnGo   = document.getElementById('pp-search-go');
    const FAVORITES_KEY = 'pp:favorites';

    if (!list || !tpl) return;

    async function loadExternal() {
        try {
            const res = await fetch('/assets/data/projects.json', { cache: 'no-cache' });
            if (!res.ok) return null;
            const json = await res.json();
            return Array.isArray(json) ? json : null;
        } catch { return null; }
    }
    function loadInline() {
        try { return JSON.parse($('#pp-data')?.textContent || '[]'); } catch { return []; }
    }

    function syncQS() {
        const p = new URLSearchParams();
        if (state.q) p.set('q', state.q);
        if (state.sort !== 'newest') p.set('sort', state.sort);
        if (state.view !== 'grid') p.set('view', state.view);
        const u = location.pathname + (p.toString() ? ('?' + p.toString()) : '');
        history.replaceState(null, '', u);
    }

    function render(d = currentData) {
        list.setAttribute('aria-busy', 'true');
        list.innerHTML = '';
        let rows = d.slice();

        const q = (state.q || '').trim().toLowerCase();
        if (q) rows = rows.filter(p => (p.title + p.desc + p.tags.join(' ')).toLowerCase().includes(q));

        if (state.sort === 'az') rows.sort((a, b) => a.title.localeCompare(b.title));
        else if (state.sort === 'oldest') rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        else rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        if (!rows.length) {
            list.innerHTML = '<p class="pp-empty">No matches. Clear filters or search.</p>';
            list.setAttribute('aria-busy', 'false');
            return;
        }

        for (const p of rows) {
            const n = tpl.content.firstElementChild.cloneNode(true);
            const link = n.querySelector('.pp-link');
            const th = n.querySelector('.pp-thumb');
            const img = n.querySelector('.pp-thumb-img');
            const ds = n.querySelector('.pp-desc');
            const tl = n.querySelector('.pp-tagsline');
            const favBtn = n.querySelector('.pp-fav');
            const share = n.querySelector('.pp-share');

            if (link) { link.href = p.url; link.textContent = p.title; link.title = p.title; }
            if (th) { th.href = p.url; }
            if (img) {
                img.src = p.thumb || '/assets/images/projects/placeholder.svg';
                img.alt = (p.thumb_alt || (p.title + ' thumbnail')).trim();
                img.referrerPolicy = 'no-referrer';
                img.loading = 'lazy'; img.decoding = 'async';
            }
            if (ds) { ds.textContent = p.desc || ''; }
            if (tl && Array.isArray(p.tags)) { p.tags.forEach(t => { const li = document.createElement('li'); li.className = 'pp-tag'; li.textContent = t; tl.appendChild(li); }); }

            if (favBtn) {
                favBtn.setAttribute('aria-pressed', favs.has(p.id) ? 'true' : 'false');
                if (favs.has(p.id)) n.classList.add('is-fav');
                favBtn.onclick = () => { favs.has(p.id) ? favs.delete(p.id) : favs.add(p.id); localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs])); render(); };
            }
            if (share) {
                share.onclick = async () => { try { const u = new URL(p.url, location.origin); u.hash = p.id; await navigator.clipboard.writeText(u.toString()); share.textContent = 'Copied'; setTimeout(() => share.textContent = 'Copy', 1200); } catch { } };
            }

            list.appendChild(n);
        }
        list.className = (state.view === 'list') ? 'pp-list' : 'pp-grid';
        list.setAttribute('aria-busy', 'false');
    }

    let currentData = [], favs = new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
    const qs = new URLSearchParams(location.search);
    const state = { q: qs.get('q') || '', sort: qs.get('sort') || 'newest', view: (qs.get('view') || 'grid') };

    function setView(view){
        state.view = (view === 'list') ? 'list' : 'grid';
        if (btnGrid) { btnGrid.classList.toggle('is-active', state.view==='grid'); btnGrid.setAttribute('aria-pressed', String(state.view==='grid')); }
        if (btnList) { btnList.classList.toggle('is-active', state.view==='list'); btnList.setAttribute('aria-pressed', String(state.view==='list')); }
        syncQS(); render(currentData);
    }

    // boot
    (async () => {
        const external = await loadExternal();
        currentData = (external && external.length) ? external : loadInline();

        // UI wireup
        if (input) input.value = state.q;
        if (sortSel) sortSel.onchange = e => { state.sort = e.target.value; syncQS(); render(currentData); };
        if (btnGrid) btnGrid.onclick = () => setView('grid');
        if (btnList) btnList.onclick = () => setView('list');
        if (btnGo) btnGo.onclick = () => { state.q = (input?.value || ''); syncQS(); render(currentData); };
        if (input) input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); state.q = input.value; syncQS(); render(currentData); }
        });
        document.addEventListener('keydown', (e) => {
            if (e.target === input) return;
            if (e.key.toLowerCase() === 'g') setView('grid');
            if (e.key.toLowerCase() === 'l') setView('list');
            if (e.key === '/') { e.preventDefault(); input?.focus(); }
        });

        if (!currentData.length) { list.innerHTML = '<p class="pp-empty">No projects found. Populate <code>/assets/data/projects.json</code> or <code>#pp-data</code>.</p>'; return; }
        setView(state.view);
        render(currentData);
    })();
})();
