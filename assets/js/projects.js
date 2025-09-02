const state = {
  data: [],
  q: "",
  typeFilters: new Set(),
  tagFilters: new Set(),
  sort: "featured"
};

const els = {
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  q: document.getElementById("q"),
  sort: document.getElementById("sort"),
  filters: document.querySelector(".filters"),
  app: document.getElementById("projects-app")
};

init();

async function init() {
  try {
    const res = await fetch("/assets/data/projects.json", { cache: "no-store" });
    state.data = await res.json();
  } catch (err) {
    console.error("Failed to load projects.json", err);
    state.data = [];
  }
  renderFilters(state.data);
  bind();
  render();
  injectSchema(state.data);
}

function bind() {
  if (els.q) els.q.addEventListener("input", e => { state.q = e.target.value.trim(); render(); });
  if (els.sort) els.sort.addEventListener("change", e => { state.sort = e.target.value; render(); });
}

function renderFilters(data) {
  const types = [...new Set(data.map(d => d.type).filter(Boolean))];
  const tags  = [...new Set(data.flatMap(d => d.tags || []))].slice(0, 12);

  const mkPill = (label, group) => {
    const b = document.createElement("button");
    b.className = "pill";
    b.type = "button";
    b.textContent = label;
    b.setAttribute("data-group", group);
    b.setAttribute("data-value", label);
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      const set = group === "type" ? state.typeFilters : state.tagFilters;
      const on = b.getAttribute("aria-pressed") === "true";
      b.setAttribute("aria-pressed", String(!on));
      !on ? set.add(label) : set.delete(label);
      render();
    });
    return b;
  };

  els.filters.innerHTML = "";
  const wrapType = document.createElement("div");
  wrapType.style.display = "flex"; wrapType.style.gap = ".4rem"; wrapType.setAttribute("aria-label","Type");
  types.forEach(t => wrapType.appendChild(mkPill(t, "type")));

  const wrapTags = document.createElement("div");
  wrapTags.style.display = "flex"; wrapTags.style.gap = ".4rem"; wrapTags.setAttribute("aria-label","Tags");
  tags.forEach(t => wrapTags.appendChild(mkPill(`#${t}`, "tag")));

  els.filters.append(wrapType, wrapTags);
}

function render() {
  const items = filterSortSearch(state.data, state);
  els.grid.innerHTML = items.map(cardHTML).join("");
  els.empty.hidden = items.length > 0;
  attachCardHandlers();
}

function filterSortSearch(items, state) {
  let out = items.slice();

  if (state.typeFilters.size) {
    out = out.filter(d => state.typeFilters.has(d.type));
  }
  if (state.tagFilters.size) {
    out = out.filter(d => (d.tags || []).some(t => state.tagFilters.has(`#${t}`)));
  }

  if (state.q) {
    const q = state.q.toLowerCase();
    out = out
      .map(d => ({ d, s: score(d, q) }))
      .filter(x => x.s > 0)
      .sort((a,b) => b.s - a.s)
      .map(x => x.d);
  }

  switch (state.sort) {
    case "newest": out.sort((a,b) => (b.year||0) - (a.year||0)); break;
    case "oldest": out.sort((a,b) => (a.year||0) - (b.year||0)); break;
    case "az": out.sort((a,b) => a.title.localeCompare(b.title)); break;
    default:
      out.sort((a,b) => (b.featured === true) - (a.featured === true) || (b.order||0) - (a.order||0));
  }
  return out;
}

function score(d, q) {
  const hay = (d.title + " " + (d.summary||"") + " " + (d.tags||[]).join(" ")).toLowerCase();
  if (hay.includes(q)) return 10 + (q.length / 10);
  const words = q.split(/\s+/).filter(Boolean);
  let s = 0; words.forEach(w => { if (hay.includes(w)) s += 2; });
  return s;
}

function cardHTML(d) {
  const tagBadges = (d.tags||[]).slice(0,4).map(t => `<span class="badge">#${t}</span>`).join("");
  const statusClass = d.status ? `status-${d.status}` : "";
  const tech = (d.tech||[]).slice(0,4).join(" · ");
  const img = d.thumb ? `<img loading="lazy" src="${d.thumb}" alt="${escapeHTML(d.title)} thumbnail">` : "";
  const primary = d.links?.primary || d.links?.demo || d.links?.github || "#";

  return `
  <article class="card" tabindex="0">
    <a class="card-media" href="${primary}">
      ${img}
    </a>
    <div class="card-body">
      <div class="badges">
        ${d.badge ? `<span class="badge">${escapeHTML(d.badge)}</span>` : ""}
        ${d.status ? `<span class="badge ${statusClass}">${escapeHTML(cap(d.status))}</span>` : ""}
        ${tagBadges}
      </div>
      <h3 class="card-title">${escapeHTML(d.title)}</h3>
      <p class="card-summary">${escapeHTML(d.summary || "")}</p>
      <div class="meta">
        ${d.year ? `<span>${d.year}</span>` : ""} ${tech ? `<span>· ${escapeHTML(tech)}</span>` : ""}
      </div>
      <div class="actions">
        ${d.links?.primary ? `<a class="btn primary" href="${d.links.primary}">${escapeHTML(d.cta || "Open")}</a>` : ""}
        ${d.links?.github ? `<a class="btn" href="${d.links.github}" aria-label="GitHub">GitHub</a>` : ""}
        ${d.links?.dashboard ? `<a class="btn" href="${d.links.dashboard}">Dashboard</a>` : ""}
        ${d.links?.pdf ? `<a class="btn" href="${d.links.pdf}">PDF</a>` : ""}
      </div>
    </div>
  </article>`;
}

function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
function escapeHTML(s){ return (s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])); }

function attachCardHandlers() {
  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const a = card.querySelector(".actions .btn.primary, .card-media");
        if (a) { a.click(); }
      }
    });
  });
}

function injectSchema(list) {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": list.map((d, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": d.links?.primary || d.links?.demo || "https://jgwalsh.com/projects"
    }))
  };
  const s = document.createElement("script");
  s.type = "application/ld+json";
  s.textContent = JSON.stringify(itemList);
  document.head.appendChild(s);
}



