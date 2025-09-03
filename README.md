# J. Gregory Walsh – Professional Career Profile

![GitHub](https://img.shields.io/badge/Repository-GitHub-181717?logo=github&logoColor=white)
![Cloudflare Pages](https://img.shields.io/badge/Hosted_on-Cloudflare_Pages-F38020?logo=cloudflare&logoColor=white)

Welcome to the source code for my personal career profile website. This project hosts the front‑end code for a self‑designed site that highlights my background in psychology, clinical experience, data‑analysis skills, and commitment to public service.

## 🌐 Live Site

Visit [jgwalsh.com](https://jgwalsh.com) to explore the live site.

## Site Overview

The website is organized into the following sections:

- **Home** – summary of my professional mission and values.
- **About** – overview of my academic and professional journey.
- **Résumé** – detailed résumé with education, certifications, and work history.
- **Projects** – portfolio of research, analytics projects, and community initiatives.
- **Contact** – ways to get in touch and connect.

## Technology Stack

This personal website project is built using:

- **HTML/CSS** with **Tailwind CSS** for a responsive, modern design.
- Hosted on **Cloudflare Pages** for fast, secure delivery.
- Version controlled on **GitHub**.

## Getting Started

To run or contribute locally:

1. Clone this repository.
2. Open `index.html` in your browser (no build tools required).
3. Edit content in the HTML and CSS files.
4. Push changes to GitHub; the site deploys automatically via Cloudflare Pages.

## Deployment & Cloudflare Pages Modes

Cloudflare Pages sometimes produces noisy dashboard rows like "Preview — Skipped (No deployment available)" for branches you never intend to deploy. A helper script is provided to streamline configuration via the Cloudflare API and optionally disable previews entirely.

Script: `scripts/cloudflare_pages_mode.sh`

Supported modes:

- `git-prod-only` (default): Keep Git auto‑deploys only for the `main` branch; disable all preview / PR deployments.
- `wrangler-only`: Turn off ALL Git-triggered deployments (including production) so you deploy only via Wrangler direct uploads.

Prerequisites:

1. Create a Cloudflare API token with `Pages:Edit` (and basic account read) permissions.
2. Export required environment variables:

```bash
export CF_ACCOUNT_ID="<your_account_id>"
export CF_API_TOKEN="<api_token_with_pages_edit_scope>"
export CF_PROJECT_NAME="jgwalsh-career-profile"
```

Usage examples:

```bash
# Disable previews; keep production auto deploys from main
MODE=git-prod-only bash scripts/cloudflare_pages_mode.sh

# Turn off all Git deployments (manual Wrangler deploys only)
MODE=wrangler-only bash scripts/cloudflare_pages_mode.sh
```

Wrangler manual deploy (only needed if you selected `wrangler-only`):

```bash
npx wrangler pages deploy . --project-name=jgwalsh-career-profile --branch=main --commit-dirty=true
```

What the script does:

- PATCHes the Cloudflare Pages project config.
- Rewrites minimal `pages.toml` & aligns `wrangler.toml`.
- Normalizes `.cfignore` to exclude private/tooling directories while keeping `functions/` for Pages Functions.
- Creates timestamped backups in `.merge_backups/<timestamp>/`.
- Commits & pushes the config changes (best effort).

Review the script before running in CI. Adjust the `.cfignore` section if you need assets from paths it excludes (e.g., remove `src/` if those files must deploy).

## Contact

Feel free to reach out:

- 📍 Albany, NY
- ✉️ [jgwalsh@proton.me](mailto:jgwalsh@proton.me)
