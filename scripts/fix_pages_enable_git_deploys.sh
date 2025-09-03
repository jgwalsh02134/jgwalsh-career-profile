#!/usr/bin/env bash
# Fix Cloudflare Pages skipping builds by declaring root output via pages.toml

set -euo pipefail

BRANCH="fix/pages-enable-git-deploys"

# 0) Make sure you’re at the repo root (must contain index.html)
test -f index.html || { echo "❌ Run this in the repo root (index.html missing)"; exit 1; }
git pull --ff-only origin main

# 1) Create a new fix branch
git switch -C "$BRANCH"

# 2) Add minimal pages.toml to repo root
cat > pages.toml <<'TOML'
# Cloudflare Pages build config
[build]
# No build step, static site lives at repo root
command    = ""
cwd        = "."
output_dir = "."
TOML

# 3) Touch index.html so GitHub CI sees a real content change
echo "<!-- build bump $(date -u +'%Y-%m-%dT%H:%M:%SZ') -->" >> index.html

# 4) Stage + commit + push
git add pages.toml index.html
git commit -m "fix(pages): add minimal pages.toml to declare root output"
git push -u origin "$BRANCH"

echo "✅ Branch $BRANCH pushed. Cloudflare should now trigger a PREVIEW deployment."
echo "⚠️ Watch the Pages dashboard for a green Preview build."
echo "Once it passes, merge this branch to main to enable Production auto-deploys."
