#!/usr/bin/env bash
# FIX: Cloudflare Pages fails because some files are >25 MiB.
# This script excludes all oversize files from the deploy using .cfignore
# and re-triggers a Preview + Production deployment.

set -euo pipefail

PROJECT="jgwalsh-career-profile"
FIX_BRANCH="fix/pages-exclude-oversize-assets"
MAIN_BRANCH="main"

# 0) Preconditions
test -f index.html || { echo "❌ Run from the repo root (index.html missing)"; exit 1; }
git pull --ff-only origin "$MAIN_BRANCH"

# 1) Create/refresh fix branch
git switch -C "$FIX_BRANCH"

# 2) Detect files larger than 25 MiB (Pages hard limit) and append them to .cfignore
TMP_FILE=".oversize_assets.txt"
find . -type f -size +25M -not -path "./.git/*" -print \
  | sed 's#^\./##' | sort -u > "$TMP_FILE"

if [ ! -s "$TMP_FILE" ]; then
  echo "✅ No oversize files found (>25 MiB). Nothing to exclude."
else
  echo -e "\n# === Oversize assets (>25 MiB) excluded for Cloudflare Pages ===" >> .cfignore
  while IFS= read -r p; do
    # Append only if not already present
    grep -qxF "$p" .cfignore 2>/dev/null || echo "$p" >> .cfignore
  done < "$TMP_FILE"
  echo "# === End oversize list ($(date -u +'%Y-%m-%dT%H:%M:%SZ')) ===" >> .cfignore
fi
rm -f "$TMP_FILE"

# 3) Ensure pages.toml declares root output (so Git builds don’t skip)
if [ ! -f pages.toml ]; then
  cat > pages.toml <<'TOML'
[build]
command    = ""
cwd        = "."
output_dir = "."
TOML
fi

# 4) Build-bump so CI can’t skip
echo "<!-- deploy bump $(date -u +'%Y-%m-%dT%H:%M:%SZ') -->" >> index.html

# 5) Commit & push
git add .cfignore pages.toml index.html
git commit -m "chore(pages): exclude >25MiB assets via .cfignore; declare root output; bump deploy" || true
git push -u origin "$FIX_BRANCH"

# 6) (Optional) Trigger Preview deploy immediately via Wrangler if creds are set
if command -v npx >/dev/null 2>&1 && { [ -n "${CLOUDFLARE_API_TOKEN:-}" ] || [ -n "${CF_API_TOKEN:-}" ]; } && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  npx wrangler pages project create "$PROJECT" --production-branch="$MAIN_BRANCH" || true
  npx wrangler pages deploy . \
    --project-name="$PROJECT" \
    --branch="$FIX_BRANCH" \
    --commit-dirty=true \
    --commit-message="Preview deploy: exclude >25MiB assets via .cfignore"
else
  echo "ℹ️ Wrangler deploy skipped (missing CF creds). GitHub-triggered Preview will run."
fi

# 7) Pause for you to verify the Preview in the dashboard
read -r -p $'\n✅ When Preview is green, press ENTER to merge to main and deploy to Production (Ctrl+C to abort)...'

# 8) Merge to main & push
git checkout "$MAIN_BRANCH"
git pull --ff-only origin "$MAIN_BRANCH"
git merge --no-ff "$FIX_BRANCH" -m "merge: exclude >25MiB assets for Cloudflare Pages deploy"
git push origin "$MAIN_BRANCH"

# 9) (Optional) Force Production deploy via Wrangler if creds are set
if command -v npx >/dev/null 2>&1 && { [ -n "${CLOUDFLARE_API_TOKEN:-}" ] || [ -n "${CF_API_TOKEN:-}" ]; } && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  npx wrangler pages deploy . \
    --project-name="$PROJECT" \
    --branch="$MAIN_BRANCH" \
    --commit-dirty=true \
    --commit-message="Production deploy: exclude >25MiB assets via .cfignore"
fi

echo "🎉 Deploys requested. Note: any links to excluded large files will 404 until you host them elsewhere (e.g., R2) or compress them below 25 MiB."
