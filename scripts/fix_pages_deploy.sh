#!/usr/bin/env bash
# Run this in the VS Code terminal at the repo root (folder that contains index.html)

set -euo pipefail

PROJECT="jgwalsh-career-profile"
FIX_BRANCH="fix/pages-deploy-root"

# 0) Preconditions
test -f index.html || { echo "❌ Run from the repo root that contains index.html"; exit 1; }
git pull --ff-only origin main

# 1) Create/refresh fix branch
git switch -C "$FIX_BRANCH"
git status --short

# 2) Flatten site output to repo root; remove ./public if it exists
if [ -d public ]; then
  echo "==> Moving files out of ./public to repo root"
  rsync -a public/ ./
  git rm -r public
fi

# 3) Ensure Cloudflare Pages control files exist at repo root
[ -f _headers ] || touch _headers
[ -f _redirects ] || touch _redirects

# 4) Remove Pages config that can conflict with auto-detect
git rm -f pages.toml 2>/dev/null || true

# 5) Normalize .cfignore to avoid skipping site content
cat > .cfignore <<'EOF'
# keep site content; ignore only junk
node_modules/
.DS_Store
.git/
.vscode/
EOF

# 6) Stage + commit
git add -A
git commit -m "fix(pages): single output at repo root; remove public/; normalize cfignore; ensure _headers/_redirects" || true

# 7) Push branch
git push -u origin "$FIX_BRANCH"

# 8) Ensure the Pages project exists; set production branch to main (idempotent)
npx wrangler pages project create "$PROJECT" --production-branch=main || true

# 9) Trigger a PREVIEW deploy for this branch from the repo root (.)
npx wrangler pages deploy . \
  --project-name="$PROJECT" \
  --branch="$FIX_BRANCH" \
  --commit-dirty=true \
  --commit-message="Preview deploy: fix root output"

echo "✅ Preview deploy requested for branch: $FIX_BRANCH"

# ====== AFTER YOU VERIFY THE PREVIEW IN THE BROWSER, RUN THE SECTION BELOW ======
read -r -p $'\nPress ENTER to merge to main and deploy to PRODUCTION, or Ctrl+C to abort...'

# 10) Merge to main and push
git checkout main
git pull --ff-only origin main
git merge --no-ff "$FIX_BRANCH" -m "merge: fix Pages root output + config"
git push origin main

# 11) Force a PRODUCTION deploy from main (immediate)
npx wrangler pages deploy . \
  --project-name="$PROJECT" \
  --branch=main \
  --commit-dirty=true \
  --commit-message="Production deploy: root output + config fix"

# 12) Build bump (only if CI still says 'No deployment available'); harmless otherwise
date > .build-bump
git add .build-bump
git commit -m "chore: build bump to trigger Pages CI" || true
git push || true

# 13) Quick sanity checks
echo -e "\n==> Checking HTTP headers for live sites:"
curl -I https://jgwalsh.com | sed -n '1,10p' || true
curl -I https://jgwalsh-career-profile.pages.dev | sed -n '1,10p' || true

echo "🎉 Done."
