#!/usr/bin/env bash
# Add / update a Featured Projects grid inside projects.html (idempotent).
# Creates branch feat/projects-grid off latest main.

set -euo pipefail

BRANCH="feat/projects-grid"
HTML="projects.html"
FRAG="scripts/_projects_grid.fragment.html"

# 0) Preconditions
test -f "$HTML" || { echo "❌ $HTML not found. Run from the repo root."; exit 1; }

echo "==> Syncing main"
git fetch origin main
# Ensure we are on main before branching
git checkout main
git pull --ff-only origin main

echo "==> Creating / resetting feature branch $BRANCH"
git switch -C "$BRANCH"

# 1) Write the projects grid fragment
mkdir -p scripts
cat > "$FRAG" <<'HTML'
<!-- PROJECTS:BEGIN -->
<section class="projects-grid" aria-label="Projects">
  <h2>Featured Projects</h2>
  <div class="grid">
    <a class="card" href="/project-crime-analysis.html">
      <h3>Crime Analysis Report</h3>
      <p>Albany, NY 2021–2024 interactive brief.</p>
    </a>
    <a class="card" href="/interactive_crime_arrest_trends.html">
      <h3>Interactive Crime Arrest Trends</h3>
      <p>Explore arrest patterns over time.</p>
    </a>
    <a class="card" href="/interactive_neighborhood_treemap.html">
      <h3>Neighborhood Treemap</h3>
      <p>Incidents by area and category.</p>
    </a>
    <a class="card" href="/interactive_violent_crime_sunburst.html">
      <h3>Violent Crime Sunburst</h3>
      <p>Hierarchical view of violent offenses.</p>
    </a>
    <a class="card" href="/case_resolution_sankey_2024.html">
      <h3>Case Resolution Sankey (2024)</h3>
      <p>Flow from report to outcome.</p>
    </a>
    <a class="card" href="/resources/">
      <h3>Resource Center</h3>
      <p>Datasets, documents, and references.</p>
    </a>
  </div>
</section>

<style>
/* PROJECTS:LOCAL-STYLES (scoped to projects page) */
.projects-grid{margin:2rem 0}
.projects-grid h2{text-align:center;margin:0 0 1rem}
.projects-grid .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.projects-grid .card{display:block;padding:16px;border:1px solid rgba(0,0,0,.12);border-radius:12px;text-decoration:none;transition:transform .15s ease,box-shadow .15s ease}
.projects-grid .card:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,0,0,.06)}
.projects-grid .card h3{margin:.25rem 0 .5rem;font-size:1.05rem}
.projects-grid .card p{margin:0;font-size:.95rem;opacity:.8}
@media (prefers-color-scheme: dark){
  .projects-grid .card{border-color:rgba(255,255,255,.12)}
}
</style>
<!-- PROJECTS:END -->
HTML

# 2) Insert or replace the projects grid in projects.html
python3 - <<'PY'
import re, pathlib
html_path = pathlib.Path("projects.html")
frag = pathlib.Path("scripts/_projects_grid.fragment.html").read_text()
html = html_path.read_text()
pat = re.compile(r'<!-- PROJECTS:BEGIN -->.*?<!-- PROJECTS:END -->', re.S)
if pat.search(html):
    html = pat.sub(frag, html)
else:
    # prefer after <main>, else after first </h1>, else append
    m = re.search(r'(<main[^>]*>)', html, re.I)
    if m:
        html = html.replace(m.group(1), m.group(1) + "\n" + frag)
    else:
        m = re.search(r'(</h1>)', html, re.I)
        if m:
            html = html.replace(m.group(1), m.group(1) + "\n" + frag)
        else:
            html += "\n" + frag
html_path.write_text(html)
PY

# 3) Commit and push
git add "$HTML" "$FRAG"
if git diff --cached --quiet; then
  echo "No changes to commit (grid already up to date)."
else
  git commit -m "feat(projects): add featured projects grid to projects.html"
fi

git push -u origin "$BRANCH"

echo "✅ Projects grid ensured on $BRANCH."

echo "Create PR or press ENTER to merge to main."
read -r -p $'\nPress ENTER to merge to main now (or Ctrl+C to abort)...'

git checkout main
git pull --ff-only origin main
git merge --no-ff "$BRANCH" -m "merge: add featured projects grid to projects page" || true
git push origin main

echo "🚀 Merged to main."
