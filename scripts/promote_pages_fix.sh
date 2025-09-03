#!/usr/bin/env bash
# Promote the Pages fix branch and trigger real Preview + Production deploys
# Paste this into the VS Code terminal at the repo root.

set -euo pipefail

PROJECT="jgwalsh-career-profile"
FIX_BRANCH="fix/pages-enable-git-deploys"   # the branch you just pushed
MAIN_BRANCH="main"

# 0) Preconditions
test -f index.html || { echo "❌ Run from repo root (index.html missing)"; exit 1; }
git fetch --all --prune

# 1) Ensure pages.toml exists (declare root output) in case it was not committed
if [ ! -f pages.toml ]; then
  cat > pages.toml <<'TOML'
[build]
command    = ""
cwd        = "."
output_dir = "."
TOML
  git add pages.toml
  git commit -m "fix(pages): ensure pages.toml exists (root output)" || true
fi

# 2) Switch to the fix branch and push any local commits
git switch -C "$FIX_BRANCH"
git push -u origin "$FIX_BRANCH" || true

# 3) Force a Preview deployment for the fix branch (bypasses any Git CI skip)
#    Requires CLOUDFLARE_API_TOKEN (or CF_API_TOKEN) and CLOUDFLARE_ACCOUNT_ID to be set.
if command -v npx >/dev/null 2>&1 && { [ -n "${CLOUDFLARE_API_TOKEN:-}" ] || [ -n "${CF_API_TOKEN:-}" ]; } && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  npx wrangler pages project create "$PROJECT" --production-branch="$MAIN_BRANCH" || true
  npx wrangler pages deploy . \
    --project-name="$PROJECT" \
    --branch="$FIX_BRANCH" \
    --commit-dirty=true \
    --commit-message="Preview deploy (enable Git builds via pages.toml)"
else
  echo "ℹ️  Wrangler deploy skipped (missing CLOUDFLARE_API_TOKEN/CF_API_TOKEN and/or CLOUDFLARE_ACCOUNT_ID)."
  echo "    GitHub-triggered Preview should still run because pages.toml is present."
fi

# 4) Merge the fix branch to main and push
git checkout "$MAIN_BRANCH"
git pull --ff-only origin "$MAIN_BRANCH"
git merge --no-ff "$FIX_BRANCH" -m "merge: enable Cloudflare Pages Git deploys (root output via pages.toml)" || true
# If already merged, merging will fail; fall back to rebasing or skipping
if git branch --contains "$FIX_BRANCH" | grep -q "\b$MAIN_BRANCH\b"; then
  echo "Branch already merged or fast-forwarded."
fi
git push origin "$MAIN_BRANCH" || true

# 5) Force a Production deployment from main (immediate), if Wrangler creds are available
if command -v npx >/dev/null 2>&1 && { [ -n "${CLOUDFLARE_API_TOKEN:-}" ] || [ -n "${CF_API_TOKEN:-}" ]; } && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  npx wrangler pages deploy . \
    --project-name="$PROJECT" \
    --branch="$MAIN_BRANCH" \
    --commit-dirty=true \
    --commit-message="Production deploy (pages.toml root output)"
fi

# 6) Minimal verification
echo -e "\n==> HEADs:"
git log -1 --oneline
echo -e "\n==> Curl headers (optional):"
curl -I https://jgwalsh.com | sed -n '1,12p' || true
curl -I https://jgwalsh-career-profile.pages.dev | sed -n '1,12p' || true

echo "✅ Done. Preview + Production deploys requested."
