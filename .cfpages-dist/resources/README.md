# Resource Center / Library — Maintenance Guide (No Content Included)

This area is access-gated (Cloudflare Access) and excluded from search indexing. Do not store secrets or private PII here. The access gate is for convenience, not data classification.

## Where to place files

- PDFs → `/resources/library/pdfs/`
- EPUBs → `/resources/library/epubs/`
- Word/DOC/DOCX/RTF → `/resources/library/docs/`
- Markdown (.md) → `/resources/library/markdown/`
- Plain text/logs (.txt, .log) → `/resources/library/text/`
- CSS artifacts → `/resources/library/css/`
- Datasets: CSV → `/resources/datasets/csv/`, JSON → `/resources/datasets/json/`, Parquet → `/resources/datasets/parquet/`, XLSX → `/resources/datasets/xlsx/`
- Everything else (archives, binaries, shapefiles, etc.) → `/resources/raw/`
- Media assets (thumbnails, static images) → `/resources/media/`

Filenames must be kebab-case, ASCII-only, with no spaces. Titles in JSON remain human-readable.

## Single source of truth index

After adding files, append entries to `/resources/_data/resources.json`. Keep it as the canonical inventory. Do not add example rows to the JSON file.

Schema (documented only; do not paste example items into the JSON file):

```
{
  "id": "string-unique",
  "title": "string",
  "collection": "library|dataset|raw",
  "type": "pdf|epub|docx|md|txt|css|csv|json|parquet|xlsx|link|other",
  "path": "/resources/library/pdfs/... OR /resources/datasets/csv/... OR external URL",
  "mime": "application/pdf|application/epub+zip|…",        // optional; inferred when absent
  "description": "short string",
  "tags": ["array","of","strings"],
  "added_at": "YYYY-MM-DD",
  "updated_at": "YYYY-MM-DD",
  "size_bytes": 0,
  "checksum": "optional sha256 for integrity",
  "preview": {
    "enabled": true,              // hint; renderer may still refuse if unsafe/too big
    "max_rows": 100,              // datasets preview hint
    "max_bytes": 524288           // text/css preview hint (default 512 KB)
  }
}
```

## Rendering behavior (client-side)

- Markdown in `/resources/library/markdown/` can be previewed inline (text-only) or opened raw.
- CSV/JSON in `/resources/datasets/` are downloadable; light inline previews are supported.
- DOCX/EPUB/PARQUET/XLSX are download-first (no client-side rendering by default).

## Security and privacy

- This area is protected behind Cloudflare Access and marked `noindex` via headers and `<meta name="robots" content="noindex, nofollow">`.
- Do not place sensitive or regulated data here.


