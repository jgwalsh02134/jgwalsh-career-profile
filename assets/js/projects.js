/* global document, history, location, URLSearchParams, fetch */

(function () {
  const grid = document.getElementById('projects-grid');
  const empty = document.getElementById('projects-empty');
  const controls = document.getElementById('projects-controls');

  if (!grid || !empty || !controls) {
    return;
  }

  const viewClasses = {
    grid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6',
    list: 'grid grid-cols-1 gap-4'
  };

  const sortOptions = [
    { value: 'new', label: 'Newest' },
    { value: 'old', label: 'Oldest' },
    { value: 'az', label: 'A→Z' }
  ];

  let projects = [];
  let view = 'grid';
  let sort = 'new';
  let tagFilters = new Set();

  function readQuery() {
    const params = new URLSearchParams(location.search);
    const viewParam = params.get('view');
    view = viewParam === 'list' ? 'list' : 'grid';

    const sortParam = params.get('sort');
    if (['new', 'old', 'az'].includes(sortParam)) {
      sort = sortParam;
    }

    const tagsParam = params.get('tags');
    tagFilters = new Set(tagsParam ? tagsParam.split(',').filter(Boolean) : []);
  }

  function writeQuery() {
    const params = new URLSearchParams();
    if (tagFilters.size) {
      params.set('tags', [...tagFilters].join(','));
    }
    if (sort !== 'new') {
      params.set('sort', sort);
    }
    if (view !== 'grid') {
      params.set('view', view);
    }
    const query = params.toString();
    history.replaceState(null, '', query ? `${location.pathname}?${query}` : location.pathname);
  }

  function styleTagButton(button, isActive) {
    const base = 'inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-500';
    const modifier = isActive
      ? 'border-slate-900 bg-slate-900 text-white'
      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
    button.className = `${base} ${modifier}`;
    button.setAttribute('aria-pressed', String(isActive));
  }

  function renderControls() {
    controls.innerHTML = '';

    const allTags = [...new Set(projects.flatMap((item) => item.tags || []))]
      .sort((a, b) => a.localeCompare(b));

    if (allTags.length) {
      const tagWrap = document.createElement('div');
      tagWrap.className = 'flex flex-wrap items-center gap-2';
      tagWrap.setAttribute('aria-label', 'Filter by tag');

      allTags.forEach((tag) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `#${tag}`;
        styleTagButton(button, tagFilters.has(tag));
        button.addEventListener('click', () => {
          if (tagFilters.has(tag)) {
            tagFilters.delete(tag);
          } else {
            tagFilters.add(tag);
          }
          styleTagButton(button, tagFilters.has(tag));
          writeQuery();
          render();
        });
        tagWrap.appendChild(button);
      });

      controls.appendChild(tagWrap);
    }

    const sortLabel = document.createElement('label');
    sortLabel.className = 'flex items-center gap-2 text-sm text-slate-700';
    sortLabel.setAttribute('for', 'projects-sort');
    sortLabel.textContent = 'Sort';

    const sortSelect = document.createElement('select');
    sortSelect.id = 'projects-sort';
    sortSelect.className = 'rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';
    sortOptions.forEach(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      sortSelect.appendChild(option);
    });
    sortSelect.value = sort;
    sortSelect.addEventListener('change', (event) => {
      sort = event.target.value;
      writeQuery();
      render();
    });

    sortLabel.appendChild(sortSelect);
    controls.appendChild(sortLabel);

    const viewLabel = document.createElement('label');
    viewLabel.className = 'flex items-center gap-2 text-sm text-slate-700';
    viewLabel.setAttribute('for', 'projects-view');
    viewLabel.textContent = 'View';

    const viewSelect = document.createElement('select');
    viewSelect.id = 'projects-view';
    viewSelect.className = 'rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';
    [['grid', 'Grid'], ['list', 'List']].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      viewSelect.appendChild(option);
    });
    viewSelect.value = view;
    viewSelect.addEventListener('change', (event) => {
      view = event.target.value === 'list' ? 'list' : 'grid';
      writeQuery();
      render();
    });

    viewLabel.appendChild(viewSelect);
    controls.appendChild(viewLabel);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
  }

  function cardLinks(item) {
    const links = [];
    if (item.links?.case) {
      links.push(`<a href="${escapeHtml(item.links.case)}" class="text-sm font-medium underline">View Case</a>`);
    }
    if (item.links?.repo) {
      links.push(`<a href="${escapeHtml(item.links.repo)}" class="text-sm text-neutral-600 underline">Repo</a>`);
    }
    if (item.links?.demo) {
      links.push(`<a href="${escapeHtml(item.links.demo)}" class="text-sm text-neutral-600 underline">Demo</a>`);
    }
    return links.join('');
  }

  function renderGridCard(item) {
    const media = item.thumb
      ? `<img src="${escapeHtml(item.thumb)}" alt="" width="640" height="360" class="rounded-t-2xl aspect-[16/9] object-cover" loading="lazy" decoding="async">`
      : '<div class="rounded-t-2xl aspect-[16/9] bg-slate-200"></div>';

    return `<article class="group flex flex-col rounded-2xl border bg-white/70 shadow-sm hover:shadow-md transition">
      ${media}
      <div class="p-4 sm:p-5">
        <h3 class="text-lg font-semibold tracking-tight">${escapeHtml(item.title)}</h3>
        <p class="mt-2 text-sm text-neutral-600 line-clamp-3">${escapeHtml(item.summary)}</p>
        <div class="mt-4 flex items-center gap-3">${cardLinks(item)}</div>
      </div>
    </article>`;
  }

  function renderListCard(item) {
    const media = item.thumb
      ? `<img src="${escapeHtml(item.thumb)}" alt="" width="320" height="180" class="h-24 w-40 rounded-lg object-cover" loading="lazy" decoding="async">`
      : '<div class="h-24 w-40 rounded-lg bg-slate-200"></div>';

    return `<article class="rounded-2xl border bg-white/70 p-4 sm:p-5 shadow-sm hover:shadow-md transition">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
        ${media}
        <div class="flex-1">
          <h3 class="text-lg font-semibold tracking-tight">${escapeHtml(item.title)}</h3>
          <p class="mt-1 text-sm text-neutral-600">${escapeHtml(item.summary)}</p>
          <div class="mt-3 flex flex-wrap items-center gap-3">${cardLinks(item)}</div>
        </div>
      </div>
    </article>`;
  }

  function applyFilters(items) {
    let output = [...items];

    if (tagFilters.size) {
      output = output.filter((item) => (item.tags || []).some((tag) => tagFilters.has(tag)));
    }

    if (sort === 'az') {
      output.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sort === 'old') {
      output.sort((a, b) => (a.year || 0) - (b.year || 0));
    } else {
      output.sort((a, b) => (b.year || 0) - (a.year || 0));
    }

    return output;
  }

  function render() {
    grid.className = viewClasses[view] || viewClasses.grid;
    const items = applyFilters(projects);

    if (!items.length) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    grid.innerHTML = items.map((item) => (view === 'list' ? renderListCard(item) : renderGridCard(item))).join('');
  }

  async function loadProjects() {
    try {
      const response = await fetch('/static/data/projects.json', { cache: 'no-store' });
      const json = await response.json();
      projects = Array.isArray(json) ? json : [];
    } catch (error) {
      projects = [];
    }
  }

  readQuery();

  loadProjects().then(() => {
    if (!projects.length) {
      grid.innerHTML = '';
      empty.textContent = 'Projects data is unavailable. Please try again later.';
      empty.classList.remove('hidden');
      return;
    }

    renderControls();
    render();
  });
})();
