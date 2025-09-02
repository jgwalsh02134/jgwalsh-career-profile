#!/usr/bin/env bash
set -euo pipefail

# Detect output dir produced by existing build (prefers dist/, then build/, then public/)
OUTDIR=""
[[ -d "dist" ]] && OUTDIR="dist"
[[ -z "${OUTDIR}" && -d "build" ]] && OUTDIR="build"
[[ -z "${OUTDIR}" && -d "public" ]] && OUTDIR="public"
if [[ -z "${OUTDIR}" ]]; then
  echo "Build output folder not found. Ensure \`npm run build\` produced dist/, build/, or public/." >&2
  exit 1
fi

# Ensure Wrangler is available
npx --yes wrangler@latest --version >/dev/null

# Deploy to PRODUCTION (main) for Cloudflare Pages project "jgwalsh-career-profile"
npx wrangler pages deploy "$OUTDIR" \
  --project-name jgwalsh-career-profile \
  --branch main \
  --commit-hash "$(git rev-parse HEAD)" \
  --commit-message "ops: manual production redeploy via wrangler"

echo "✅ Deployed $OUTDIR to Cloudflare Pages (production)."
