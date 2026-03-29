# Copilot Instructions — Fitness Tracker

## Security (do NOT weaken)
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` — never disable.
- Renderer must never touch the filesystem. All FS goes through IPC: handler in `main.js` → bridge in `preload.js` → call via `window.fitnessAPI` in `renderer.js`.

## Data Model
Do not alter the entry shape without migrating existing user files:
```json
{ "date": "YYYY-MM-DD", "type": "hard" | "moderate", "minutes": Number }
```
- Dates are **local** (no UTC). Week starts **Monday**.
- Always call `sanitizeEntries` before saving.

## Goal Formula
- Moderate equivalent = `moderate + hard × 2`
- Goal reached at **≥ 150**; progress bar turns green.

## Dashboard Layout Constraint
The Dashboard view **must fit without scrolling** at a minimum content height of **800px** (Electron window 1200×800). This corresponds to a Surface Pro 7 in landscape.
- All dashboard sections (quick-add cards, week grid, progress, chart) use flexbox. The chart fills remaining vertical space.
- Do **not** add new sections or increase spacing/padding without verifying the dashboard still fits.
- Use the screenshot-test skill to verify: `npx electron .github/skills/screenshot-test/scripts/screenshot-helper.js`

## Documentation Rule
With every functional change, update `README.md` and this instruction file if necessary.