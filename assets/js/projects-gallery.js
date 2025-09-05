/* eslint-disable */
/* @ts-nocheck */
// Projects gallery renderer: fetch JSON with no-cache and fall back to #pp-data
export default (function initProjectsGallery() {
    const $ = (s, e = document) => e.querySelector(s);
    const list = $('#pp-results');
    const tpl = $('#pp-card');
    const sortSel = $('#pp-sort');
    const input = $('#pp-search');
    const chipsWrap = document.querySelector('.pp-tags');
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

    function chip(tag, label) {
        const c = document.createElement('button');
        c.className = 'pp-chip';
        c.textContent = label || tag;
        c.dataset.tag = tag;
        if (state.tags.has(tag)) c.classList.add('is-on');
        c.onclick = () => {
            if (state.tags.has(tag)) { state.tags.delete(tag); c.classList.remove('is-on'); }
            else { state.tags.add(tag); c.classList.add('is-on'); }
            syncQS(); render();
        };
        return c;
    }

    function syncQS() {
        const p = new URLSearchParams();
        if (state.q) p.set('q', state.q);
        if (state.tags.size) p.set('tags', [...state.tags].join(','));
        if (state.sort !== 'newest') p.set('sort', state.sort);
        const u = location.pathname + (p.toString() ? ('?' + p.toString()) : '');
        history.replaceState(null, '', u);
    }

    function render() {
        list.setAttribute('aria-busy', 'true');
        list.innerHTML = '';
        let rows = data.slice();

        const q = (state.q || '').trim().toLowerCase();
        if (q) rows = rows.filter(p => (p.title + p.desc + p.tags.join(' ')).toLowerCase().includes(q));

        const tags = [...state.tags];
        if (tags.length) {
            const favOn = state.tags.has('favorites');
            rows = rows.filter(p => {
                const hasAll = tags.filter(t => t !== 'favorites').every(t => p.tags.includes(t));
                return (favOn ? favs.has(p.id) : true) && (tags.some(t => t !== 'favorites') ? hasAll : true);
            });
        }

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
        list.className = 'pp-grid';
        list.setAttribute('aria-busy', 'false');
    }

    let data = [], favs = new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
    const qs = new URLSearchParams(location.search);
    const state = { q: qs.get('q') || '', tags: new Set((qs.get('tags') || '').split(',').filter(Boolean)), sort: qs.get('sort') || 'newest', view: 'grid' };

    // boot
    (async () => {
        const external = await loadExternal();
        data = (external && external.length) ? external : loadInline();

        // UI wireup
        const allTags = [...new Set(data.flatMap(p => p.tags))].sort();
        if (chipsWrap) {
            const favChip = chip('favorites', '★ Favorites'); chipsWrap.append(favChip);
            allTags.forEach(t => chipsWrap.append(chip(t)));
        }
        if (input) input.value = state.q;
        if (sortSel) sortSel.onchange = e => { state.sort = e.target.value; syncQS(); render(); };
        if (input) input.oninput = e => { state.q = e.target.value; syncQS(); render(); };

        if (!data.length) { list.innerHTML = '<p class="pp-empty">No projects found. Populate <code>/assets/data/projects.json</code> or <code>#pp-data</code>.</p>'; return; }
        render();
    })();
})();
