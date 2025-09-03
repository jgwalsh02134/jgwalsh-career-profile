#!/usr/bin/env bash
# Re-enable Cloudflare Pages Git deploys by adding a minimal pages.toml
# Paste into the VS Code terminal at the repo root (folder containing index.html)

set -euo pipefail

PROJECT="jgwalsh-career-profile"
FIX_BRANCH="fix/pages-root-output-pages-toml"

# 0) Preconditions
test -f index.html || { echo "❌ Run this from the repo root (index.html must exist)"; exit 1; }
git pull --ff-only origin main

# 1) Create/refresh a fix branch
git switch -C "$FIX_BRANCH"

# 2) Add a minimal pages.toml that tells Pages to deploy the repo root (no build)
cat > pages.toml <<'TOML'
# Cloudflare Pages build config
[build]
# No build needed (static site at repo root)
command   = ""
# Build runs in the repo root
cwd       = "."
# Deploy files from the repo root
output_dir = "."
TOML

# 3) Optional: keep a safe .cfignore so Git changes aren't skipped
cat > .cfignore <<'EOF'
# Keep site content; ignore only junk
node_modules/
.DS_Store
.git/
.vscode/
EOF

# 4) Make a tiny content touch so CI cannot skip the build
echo "<!-- pages build bump $(date -u +'%Y-%m-%dT%H:%M:%SZ') -->" >> index.html

# 5) Commit and push the branch
git add pages.toml .cfignore index.html
git commit -m "fix(pages): declare root output via pages.toml; ensure CI sees content change"
git push -u origin "$FIX_BRANCH"

echo "✅ Pushed $FIX_BRANCH. Cloudflare Pages should now create a PREVIEW deployment from GitHub."

# ===== After the preview turns green, run the section below to ship to production =====
read -r -p $'\nPress ENTER to merge to main and deploy to PRODUCTION (or Ctrl+C to stop)...'

git checkout main
git pull --ff-only origin main
git merge --no-ff "$FIX_BRANCH" -m "merge: enable Pages Git deploys with pages.toml (root output)"
git push origin main

echo "🚀 Merged to main. Production deploy will trigger automatically."
echo "If you want to force an immediate deploy via Wrangler as well, run:"
echo "npx wrangler pages deploy . --project-name=$PROJECT --branch=main --commit-dirty=true --commit-message='Production deploy (pages.toml root output)'"
