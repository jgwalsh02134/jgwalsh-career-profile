#!/usr/bin/env bash
# Goal: Remove "Resources" from the top header nav on every page
#       and surface a "Resource Center" link inside projects.html.

set -euo pipefail

BRANCH="feat/nav-move-resources-to-projects"

# 0) Preconditions
test -f index.html || { echo "❌ Run from the repo root (index.html missing)"; exit 1; }
test -f projects.html || { echo "❌ projects.html not found"; exit 1; }

git pull --ff-only origin main
git switch -C "$BRANCH"

# 1) Remove the Resources item from the header nav across all root *.html files
#    Matches various <a href> forms pointing to /resources/ or resources.html
for f in *.html; do
  # Remove list item variants containing a resources link
  perl -0777 -i -pe 's#\s*<li[^>]*>\s*<a[^>]*href="[^"]*resources[^"]*"[^>]*>.*?Resources.*?</a>\s*</li>\s*##igs' "$f"
  # Remove any standalone anchor to resources
  perl -0777 -i -pe 's#\s*<a[^>]*href="[^"]*resources[^"]*"[^>]*>\s*Resources\s*</a>\s*##igs' "$f"
  # Collapse excessive blank lines
  perl -0777 -i -pe 's/\n{3,}/\n\n/g' "$f"
done

# 2) Insert Resource Center link inside projects.html after opening <main>, fallback after first <h1>
if ! grep -q "Resource Center →" projects.html; then
  if grep -qi "<main" projects.html; then
    perl -0777 -i -pe 's#(<main[^>]*>)#$1\n  <!-- Moved from header: Resource Center link -->\n  <section class="resource-link" style="margin:1.25rem 0 2rem;text-align:center;">\n    <a href="/resources/" class="button secondary" style="display:inline-block;padding:.65rem 1rem;border:1px solid rgba(0,0,0,.15);border-radius:10px;text-decoration:none;">Resource Center →</a>\n  </section>#i' projects.html
  else
    perl -0777 -i -pe 's#(</h1>)#$1\n  <div class="resource-link" style="margin:1.25rem 0 2rem;text-align:center;">\n    <a href="/resources/" class="button secondary" style="display:inline-block;padding:.65rem 1rem;border:1px solid rgba(0,0,0,.15);border-radius:10px;text-decoration:none;">Resource Center →</a>\n  </div>#i' projects.html
  fi
fi

# 3) Commit and push
git add -A
git commit -m "nav: remove Resources from header; add Resource Center link inside projects.html" || true
git push -u origin "$BRANCH"

echo "✅ Changes pushed to $BRANCH."
echo "Create a PR and merge, or run the merge below to ship directly to main."

read -r -p $'\nPress ENTER to merge to main now (or Ctrl+C to stop)...'

git checkout main
git pull --ff-only origin main
git merge --no-ff "$BRANCH" -m "merge: move Resources from header nav into Projects page"
git push origin main

echo "🚀 Deployed to main. Verify the navbar no longer shows Resources and that Projects page contains the Resource Center link."
