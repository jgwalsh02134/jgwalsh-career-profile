async function renderProjectsGrid() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  try {
  const res = await fetch('/projects-folder/projects.json?v=3', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching projects.json`);
    const items = await res.json();

    grid.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'card';
      const tags = (item.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');
      card.innerHTML = `
        <h3>${item.title}</h3>
        <p class="muted">${item.description || ''}</p>
        ${tags ? `<div style="margin:8px 0 0;">${tags}</div>` : ''}
        <a href="${item.link}" class="btn">Open Project</a>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<p class="muted">Could not load projects.</p>';
  }
}

document.addEventListener('DOMContentLoaded', renderProjectsGrid);
