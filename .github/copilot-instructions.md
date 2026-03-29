# Copilot Instructions — Fitness Tracker

## Security (do NOT weaken)
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` — never disable any of these.
- Renderer must never access the filesystem directly. All FS operations go through IPC: `main.js` (handler) → `preload.js` (bridge) → `renderer.js` (`window.fitnessAPI.*`).

## Data Model
Entry format — do not alter the shape without migrating existing files:
```json
{ "date": "YYYY-MM-DD", "type": "hard" | "moderate", "minutes": Number }
```
- Dates are **local** (no UTC). Week starts **Monday**.
- Always call `sanitizeEntries` before saving.

## Goal Formula
- Moderate equivalent = `moderate + hard × 2`
- Goal reached when moderate equivalent **≥ 150**
- Progress bar turns green at goal.

## IPC Channels
`init` · `choose-file` · `create-file` · `save-entries` · `get-current-file`

To add a new channel: add handler in `main.js`, expose in `preload.js`, call via `window.fitnessAPI` in `renderer.js`.

## Persistence
- User data lives in a user-chosen JSON/TXT file (not bundled with the app).
- Last-used file path is stored in `config.json` inside Electron's `userData` directory.

## Documentation Rule
With every functional change, update **both** this file and `README.md`.