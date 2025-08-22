(async () => {
  const list = document.getElementById('projects-list');

  function card(p) {
    const tags = (p.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
    const links = (p.links || []).map(l => `<a class="btn" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join('');
    return `
      <article class="card">
        <h2>${p.title}</h2>
        <p class="muted">${p.date}</p>
        <p>${p.summary}</p>
        <div class="tags">${tags}</div>
        <div class="actions">${links}</div>
      </article>
    `;
  }

  try {
    const res = await fetch('projects.json', { cache: 'no-store' });
    const data = await res.json();
    list.innerHTML = data.map(card).join('');
  } catch (e) {
    list.innerHTML = `<p class="error">Could not load projects. (${e?.message || e})</p>`;
  }
})();
