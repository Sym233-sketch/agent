# Project workflow

This directory is the canonical working checkout for https://github.com/Sym233-sketch/agent (main branch). Continue development here; do not regenerate or overwrite it from the historical workspace export scripts.

- Government UI: edit `public/workbench.html`, `public/workbench.js`, and `public/workbench.css`. Run `node scripts/sync-workbench.cjs` after HTML edits; `public/index.html` is the synchronized entry point.
- Resident UI: `public/user.html`, `public/user.js`, and `public/user.css`.
- Runtime: `server/index.cjs`; document conversion, financial checks, and research are in `server/`. Agent tools and model integration are in `server/agent/`.
- Start with `npm start` (or `node scripts/sync-workbench.cjs` then `node --env-file-if-exists=.env server/index.cjs`). The default local URL is http://127.0.0.1:5173/.
- Keep keys in process memory or ignored `.env` files. Never commit credentials, resident records, access tokens, uploaded private documents, `data/`, or `node_modules/`.
- Preserve both government/resident flows and the single-screen government workspace. Official-source research must retain verifiable citations and uncertainty; never silently apply policy changes.
- Run relevant tests, `npm test`, and `npm run check` before uploading a release. Tests must not consume live API credit.
- Use the existing remote and preserve remote commits. Inspect changes, commit completed work, and sync authorized updates to this repository. Never force-push or replace unrelated files.
