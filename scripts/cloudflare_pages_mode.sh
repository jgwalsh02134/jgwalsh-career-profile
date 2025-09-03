#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# Cloudflare Pages Deployment Mode Helper
#
# Goal: Eliminate noisy "Preview — Skipped (No deployment available)" entries
#       in the Cloudflare Pages dashboard by tightening or disabling Git-based
#       preview builds.
#
# Modes:
#   MODE=git-prod-only (default)
#       Keep Git auto‑deploys ONLY for the production branch (main); disable
#       ALL preview / PR deployments.
#
#   MODE=wrangler-only
#       Disable ALL Git auto‑deploys (including production). You must deploy
#       manually via Wrangler direct uploads:
#         npx wrangler pages deploy . --project-name="$CF_PROJECT_NAME" \
#             --branch=main --commit-dirty=true
#
# Required Environment Variables:
#   CF_ACCOUNT_ID       # Your Cloudflare account ID
#   CF_API_TOKEN        # API token with Pages:Edit (and typically Account:Read)
#   CF_PROJECT_NAME     # e.g. "jgwalsh-career-profile"
#   MODE (optional)     # One of the modes above; defaults to git-prod-only
#
# Safety:
#   - Creates timestamped backups of pages.toml, wrangler.toml, and .cfignore
#     in .merge_backups/<timestamp>/ if they exist.
#   - Commits and pushes resulting config changes (best effort; won't fail script
#     if there is nothing to commit or push).
#
# DISCLAIMER: This script PATCHes your Cloudflare Pages project config via API.
# Review before running in CI/automation.
###############################################################################

MODE="${MODE:-git-prod-only}"
: "${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID}"; : "${CF_API_TOKEN:?Set CF_API_TOKEN}"; : "${CF_PROJECT_NAME:?Set CF_PROJECT_NAME}"

api() {
  local method="$1"; shift
  local path="$1"; shift
  curl -fsSL -X "$method" \
    "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${CF_PROJECT_NAME}${path}" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "$@"
}

echo "===> Current project summary:"
api GET "" | (command -v jq >/dev/null && jq '{name:.result.name, production_branch:.result.production_branch, source:.result.source.config|{preview_deployment_setting,production_deployments_enabled,deployments_enabled,preview_branch_includes,preview_branch_excludes}}' || cat) || true
echo

if [[ "$MODE" == "git-prod-only" ]]; then
  echo "===> MODE=git-prod-only: Keep Git deploys for main, disable ALL preview deployments"
  body=$(cat <<'JSON'
{
  "production_branch": "main",
  "source": {
    "config": {
      "production_deployments_enabled": true,
      "deployments_enabled": true,
      "preview_deployment_setting": "none",
      "preview_branch_includes": [],
      "preview_branch_excludes": [],
      "pr_comments_enabled": false
    }
  }
}
JSON
)
  api PATCH "" --data "$body" >/dev/null
elif [[ "$MODE" == "wrangler-only" ]]; then
  echo "===> MODE=wrangler-only: Disable ALL Git builds; you will deploy ONLY via Wrangler Direct Uploads"
  body=$(cat <<'JSON'
{
  "source": {
    "config": {
      "production_deployments_enabled": false,
      "deployments_enabled": false,
      "preview_deployment_setting": "none",
      "preview_branch_includes": [],
      "preview_branch_excludes": []
    }
  }
}
JSON
)
  api PATCH "" --data "$body" >/dev/null
else
  echo "Unknown MODE=$MODE" >&2; exit 2
fi

echo "===> Project config after PATCH:"
api GET "" | (command -v jq >/dev/null && jq '{name:.result.name, production_branch:.result.production_branch, source:.result.source.config|{preview_deployment_setting,production_deployments_enabled,deployments_enabled}}' || cat)
echo

TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p .merge_backups/"$TS"
[[ -f pages.toml ]] && cp pages.toml .merge_backups/"$TS"/pages.toml.bak
[[ -f wrangler.toml ]] && cp wrangler.toml .merge_backups/"$TS"/wrangler.toml.bak
[[ -f .cfignore ]] && cp .cfignore .merge_backups/"$TS"/.cfignore.bak

# Write minimal pages.toml (no preview envs)
cat > pages.toml <<'EOF'
[build]
command = ""
directory = "."

[env.production]
branch = "main"
EOF

# Wrangler config (Pages project root deploy)
cat > wrangler.toml <<'EOF'
name = "jgwalsh-career-profile"
compatibility_date = "2025-08-31"
pages_build_output_dir = "."

[dev]
port = 8788
EOF

# Conservative .cfignore: exclude tooling / private content; keep functions
cat > .cfignore <<'EOF'
node_modules/
cloudflare-worker/
public/
src/
.github/
.git/
.vscode/
.nova/
.wrangler/
*.map
*.bak
private/
projects-folder/
# IMPORTANT: Do NOT ignore functions/
EOF

git add -A || true
git commit -m "chore(pages): adjust Cloudflare Pages deployment mode (${MODE})" || true
git push || true

if [[ "$MODE" == "wrangler-only" ]]; then
  cat <<'NOTE'
===> Wrangler-only mode enabled: future deploys will NOT come from Git.
Deploy manually with:
  npx wrangler pages deploy . --project-name=jgwalsh-career-profile --branch=main --commit-dirty=true
NOTE
fi

echo
echo "Done. Non-production branches should no longer create noisy preview entries."
