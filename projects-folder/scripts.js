// === PROJECT CARD RENDER (BEGIN) ===
async function renderProjectsGrid() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  try {
    const res = await fetch('./projects.json', { cache: 'no-store' });
    const items = await res.json();

    grid.innerHTML = '';
    (items || []).forEach(item => {
      const card = document.createElement('article');
      card.className = 'card';
      const tags = (item.tags || []).map(t => `<span class="muted" style="font-size:12px;margin-right:8px;">#${t}</span>`).join('');
      card.innerHTML = `
        <h3>${item.title}</h3>
        <p class="muted">${item.description || ''}</p>
        ${tags ? `<div style="margin:8px 0 0;">${tags}</div>` : ''}
        <a href="${item.link}" class="btn">Open Project</a>
      `;
      grid.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    grid.innerHTML = '<p class="muted">Could not load projects.</p>';
  }
}
// === PROJECT CARD RENDER (END) ===

document.addEventListener('DOMContentLoaded', renderProjectsGrid);
