(() => {
	const $ = s => document.querySelector(s);
	const $$ = s => Array.from(document.querySelectorAll(s));
	const state = { items: [], filtered: [], tags: new Set(), activeTags: new Set() };

	const ext = p => (p||'').split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || '';
	const fmtBytes = n => (!n && n!==0) ? "" :
		n < 1024 ? `${n} B` :
		n < 1048576 ? `${(n/1024).toFixed(1)} KB` :
		n < 1073741824 ? `${(n/1048576).toFixed(1)} MB` : `${(n/1073741824).toFixed(2)} GB`;

	const inferTypeFromExt = e => {
		if (["pdf"].includes(e)) return "pdf";
		if (["epub"].includes(e)) return "epub";
		if (["docx","doc","rtf"].includes(e)) return "docx";
		if (["md","markdown"].includes(e)) return "md";
		if (["txt","log"].includes(e)) return "txt";
		if (["css"].includes(e)) return "css";
		if (["csv"].includes(e)) return "csv";
		if (["json"].includes(e)) return "json";
		if (["parquet"].includes(e)) return "parquet";
		if (["xlsx","xls"].includes(e)) return "xlsx";
		return "other";
	};

	const inferMime = (t,e) => {
		const m = {
			pdf:"application/pdf",
			epub:"application/epub+zip",
			docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			md:"text/markdown",
			txt:"text/plain",
			css:"text/css",
			csv:"text/csv",
			json:"application/json",
			parquet:"application/octet-stream",
			xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			other:"application/octet-stream",
			link:"text/html"
		};
		return m[t] || (e ? m[inferTypeFromExt(e)] : "application/octet-stream");
	};

	const buildTags = () => {
		state.tags = new Set();
		state.items.forEach(it => (it.tags||[]).forEach(t => state.tags.add(t)));
	};

	const hydrateTags = () => {
		const wrap = $('#rc-tags'); wrap.innerHTML = '';
		[...state.tags].sort((a,b)=>a.localeCompare(b)).forEach(tag => {
			const b = document.createElement('button');
			b.className = 'rc-tag'; b.textContent = tag;
			b.addEventListener('click', () => { state.activeTags.has(tag) ? state.activeTags.delete(tag) : state.activeTags.add(tag); b.classList.toggle('active'); applyFilters(); });
			wrap.appendChild(b);
		});
	};

	// Minimal safe text rendering (escape HTML)
	const escapeHTML = s => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
	const parseCSVPreview = text => {
		const lines = text.split(/\r?\n/).slice(0, 101);
		const rows = lines.map(l => l.split(','));
		return rows;
	};

	const render = () => {
		const grid = $('#rc-results'); grid.innerHTML = '';
		if (!state.filtered.length) { $('#rc-empty').hidden = false; return; }
		$('#rc-empty').hidden = true;
		const tpl = $('#rc-card-template');
		state.filtered.forEach(it => {
			const node = tpl.content.cloneNode(true);
			node.querySelector('[data-type]').textContent = (it.type||'').toUpperCase();
			const colBadge = document.createElement('span');
			colBadge.className = 'rc-collection';
			colBadge.textContent = (it.collection||'').toUpperCase() || '—';
			node.querySelector('.rc-card-head').appendChild(colBadge);

			node.querySelector('[data-title]').textContent = it.title;
			node.querySelector('[data-desc]').textContent = it.description || '';
			node.querySelector('[data-updated]').textContent = it.updated_at ? `Updated ${it.updated_at}` : (it.added_at ? `Added ${it.added_at}` : '');
			node.querySelector('[data-size]').textContent = fmtBytes(it.size_bytes);
			node.querySelector('[data-tagsline]').textContent = (it.tags||[]).join(' · ');

			const a = node.querySelector('[data-href]');
			a.href = it.path;
			a.addEventListener('click', (e) => {
				e.preventDefault();
				handleOpen(it);
			});

			grid.appendChild(node);
		});
	};

	const handleOpen = async (it) => {
		const e = ext(it.path);
		const type = it.type || inferTypeFromExt(e);
		const pv = (it.preview||{});
		const maxBytes = pv.max_bytes ?? 524288;
		const maxRows = pv.max_rows ?? 100;

		// Always trust browser PDF viewer; open in new tab
		if (type === 'pdf') return window.open(it.path, '_blank', 'noopener');

		// Download-first types
		if (["epub","docx","parquet","xlsx","other"].includes(type)) {
			return window.open(it.path, '_blank', 'noopener');
		}

		// Markdown preview (lightweight, text-only)
		if (type === 'md') {
			try {
				const res = await fetch(it.path, {cache:'no-store'});
				const text = await res.text();
				// Simple text-only preview: escape markdown (no HTML execution)
				showModal(`<pre style="white-space:pre-wrap">${escapeHTML(text.slice(0, maxBytes))}</pre>`, it.title, it.path);
			} catch { window.open(it.path, '_blank', 'noopener'); }
			return;
		}

		// Text preview
		if (type === 'txt' || type === 'css') {
			try {
				const res = await fetch(it.path, {cache:'no-store'});
				const text = await res.text();
				const sample = text.length > maxBytes ? text.slice(0, maxBytes) + '\n…(truncated)…' : text;
				showModal(`<pre>${escapeHTML(sample)}</pre>`, it.title, it.path);
			} catch { window.open(it.path, '_blank', 'noopener'); }
			return;
		}

		// CSV/JSON dataset previews
		if (type === 'csv') {
			try {
				const res = await fetch(it.path, {cache:'no-store'});
				const text = await res.text();
				const rows = parseCSVPreview(text);
				const head = rows[0]||[];
				const body = rows.slice(1, Math.min(rows.length, maxRows+1));
				const html = [
					'<div class="rc-table-wrap"><table class="rc-table"><thead><tr>',
					...head.map(h=>`<th>${escapeHTML(h)}</th>`),
					'</tr></thead><tbody>',
					...body.map(r=>`<tr>${r.map(c=>`<td>${escapeHTML(c)}</td>`).join('')}</tr>`),
					'</tbody></table></div>'
				].join('');
				showModal(html, it.title, it.path);
			} catch { window.open(it.path, '_blank', 'noopener'); }
			return;
		}

		if (type === 'json') {
			try {
				const res = await fetch(it.path, {cache:'no-store'});
				const data = await res.json();
				const truncated = JSON.stringify(data, null, 2);
				showModal(`<pre>${escapeHTML(truncated)}</pre>`, it.title, it.path);
			} catch { window.open(it.path, '_blank', 'noopener'); }
			return;
		}

		// Fallback
		window.open(it.path, '_blank', 'noopener');
	};

	const showModal = (innerHTML, title, href) => {
		let modal = $('#rc-modal');
		if (!modal) {
			modal = document.createElement('div');
			modal.id = 'rc-modal';
			modal.innerHTML = `
				<div class="rc-modal-backdrop"></div>
				<div class="rc-modal">
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
		}
		modal.querySelector('#rc-modal-title').textContent = title || 'Preview';
		const open = modal.querySelector('#rc-modal-open');
		open.href = href || '#';
		modal.querySelector('#rc-modal-body').innerHTML = innerHTML;
	};

	const applyFilters = () => {
		const q = $('#rc-search').value.trim().toLowerCase();
		const t = $('#rc-type').value;
		const c = $('#rc-collection').value;
		const sort = $('#rc-sort').value;
		state.filtered = state.items.filter(it => {
			if (c && it.collection !== c) return false;
			const e = ext(it.path);
			const itType = it.type || inferTypeFromExt(e);
			if (t && itType !== t) return false;
			if (state.activeTags.size && !(it.tags||[]).some(tag => state.activeTags.has(tag))) return false;
			if (!q) return true;
			const hay = [it.title, it.description, ...(it.tags||[]), it.collection||'', itType||''].join(' ').toLowerCase();
			return hay.includes(q);
		});
		if (sort === 'new') {
			state.filtered.sort((a,b) => (b.updated_at||b.added_at||'').localeCompare(a.updated_at||a.added_at||'') || a.title.localeCompare(b.title));
		} else {
			state.filtered.sort((a,b) => a.title.localeCompare(b.title));
		}
		render();
	};

	const initControls = () => {
		['#rc-search','#rc-type','#rc-collection','#rc-sort'].forEach(id => {
			$(id)?.addEventListener(id==='#rc-search'?'input':'change', applyFilters);
		});
	};

	const boot = async () => {
		initControls();
		try {
			const res = await fetch('/resources/_data/resources.json',{cache:'no-store'});
			const items = await res.json();
			state.items = Array.isArray(items) ? items : [];
			buildTags();
			hydrateTags();
			applyFilters();
		} catch {
			$('#rc-empty').hidden = false;
			$('#rc-empty').textContent = 'Error loading resources index.';
		}
	};

	document.addEventListener('DOMContentLoaded', boot);
})();


