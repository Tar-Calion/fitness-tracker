# Copilot Onboarding Guide

This repository hosts a very small Electron desktop app for tracking weekly fitness minutes (hard / moderate) entirely locally. This guide gives an agent enough context to implement changes confidently without exploratory file searches unless something here is missing or incorrect. Treat this document as authoritative.

## 1. Overview
Purpose: Track daily training minutes in two intensities (hard, moderate), aggregate them per ISO week (Monday start), display current week progress toward goal and a 4‑week history. Data is stored as a simple JSON (or text) file chosen by the user; no backend, no sync.
Goal logic: 150 moderate minutes OR 75 hard minutes (conversion: 1 hard = 2 moderate). Progress bar turns green at goal (>= 150 moderate equivalent).

## 2. Tech Stack & Runtime
- Type: Simple Electron app (no framework, no bundler)
- Languages: JavaScript (CommonJS), HTML, CSS
- Entry point: `main.js` (Electron main process)
- Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Persistence: User-chosen JSON/TXT file; last file path stored in a per-user `config.json` (Electron `userData` dir)
- No tests, no lint configuration, no CI workflows yet

## 3. Repository Structure (root level)
- `package.json`  – scripts and Electron dependency
- `main.js`       – creates window, IPC handlers, file & config access
- `preload.js`    – safe IPC bridge exposing a minimal API to renderer
- `index.html`    – UI markup
- `renderer.js`   – state handling, date utilities, rendering, progress calc
- `README.md`     – user-facing usage instructions
- `LICENSE`       – license text
- `.gitignore`    – standard Node ignores
- `.github/copilot-instructions.md` – this onboarding guide

No nested source directories; everything is flat.

## 4. Architecture (High Level)
Electron main process owns all filesystem interactions. Renderer communicates exclusively via IPC exposed through the preload bridge. Data model is kept in memory in renderer and persisted on each modification.

Renderer workflow:
1. On load: call `init` IPC -> attempts to restore last-used file.
2. User adds minutes via buttons -> push entry into local array -> call `save-entries`.
3. Recompute weekly and 4-week aggregates -> re-render.

## 5. Data Model
Array of entry objects:
```json
{ "date": "YYYY-MM-DD", "type": "hard" | "moderate", "minutes": Number }
```
All dates stored local (no UTC conversions). Week starts Monday.

Derived metrics:
- Hard minutes counted double for “moderate equivalent”.
- Weekly progress percent = (moderate + hard * 2) / 150 * 100 (capped at 100 for bar width, true percent still computed for label rounding).

## 6. Install & Run
Always install dependencies before launching if dependencies changed.
```
npm install
npm start
```
Optional verbose logging:
```
npm run start:dev
```
No build step beyond launching Electron. No test scripts present.

## 7. Validation (Manual) – Perform Before Merging Changes
1. Run `npm install` (clean environment assumption).
2. Run `npm start` – ensure app launches without terminal errors.
3. Create a new data file -> add several entries (both hard & moderate).
4. Close app, reopen -> confirm data restored and weekly aggregates consistent.
5. Confirm progress bar coloring flips at >= 150 moderate equivalent.
6. Confirm no direct filesystem access was added in renderer.

## 8. IPC Channels (Current)
- `init` – load last-used file if exists
- `choose-file` – open file selection dialog, load entries
- `create-file` – create new empty JSON/TXT file (writes `[]` if new)
- `save-entries` – persist array to current file
- `get-current-file` – returns the active file path

### Adding a New IPC Channel
1. Add `ipcMain.handle('channel', ...)` in `main.js` (keep logic minimal). 
2. Expose bridge function in `preload.js`.
3. Call through `window.fitnessAPI.<fn>()` in `renderer.js`.
4. Do not enable `nodeIntegration` or remove `contextIsolation`.

## 9. Common Change Scenarios
| Scenario | Files to Touch | Notes |
|----------|----------------|-------|
| Add UI element | `index.html`, `renderer.js` | Keep styling inline or create minimal styles at top of file. |
| New calculation | `renderer.js` | Consider extracting pure function for future testability. |
| Data export (e.g., CSV) | `main.js` (FS), `preload.js`, `renderer.js` | IPC for FS write, ensure non-blocking minimal logic. |
| Entry deletion / undo | `renderer.js` | Mutate in-memory array, then `save-entries`. |
| Refactor date utilities | Extract small module (optional) | Maintain existing signatures to avoid broad edits. |

## 10. Dependencies
- Direct dev dependency: `electron` only.
No hidden or transitive configuration. No native modules.

## 11. License
`LICENSE` + README indicate public domain style (The Unlicense). If introducing third-party code, ensure license compatibility before adding.

## 12. Pre-Merge Checklist (Repeatable)
- [ ] Dependencies installed (`npm install`)
- [ ] App starts without uncaught errors
- [ ] New / modified IPC handlers function as intended
- [ ] Security flags intact (no enabling `nodeIntegration`, `contextIsolation` still true)
- [ ] File reads/writes remain in main process only
- [ ] README updated if user-facing behavior or commands changed
- [ ] Data format backward compatible (no breaking shape changes)

## 13. Modification Guidelines
- Reuse existing helper functions; avoid duplication (e.g., date helpers in `renderer.js`).
- Keep IPC surface minimal; push presentation logic to renderer.
- Prefer pure functions for new calculations (easier future tests). 
- Avoid premature optimization; dataset sizes are small.
- Sanitize entries before saving (see existing `sanitizeEntries`).

## 14. Search Strategy Policy
Rely on this file first. Perform code searches only if:
- You need to confirm a symbol truly does not exist.
- You suspect instructions are outdated.
- A conflict appears between behavior and documentation.
Otherwise, proceed directly with changes.

## 15. Glossary
- Moderate equivalent = `moderateMinutes + hardMinutes * 2`
- Goal reached = moderate equivalent >= 150
- Week start = Monday (ISO-like logic using local time)

## 16. Example Feature Workflow (Template)
1. Create branch.
2. Implement UI changes in `index.html` + logic in `renderer.js`.
3. If filesystem access needed: add IPC in `main.js` + expose in `preload.js`.
4. Manual test run (add entries, restart app, verify persistence & progress).
5. Update README if user workflow changed.
6. Run through Pre-Merge Checklist.
7. Commit & open PR.

## 17. Future Quality Improvements (Optional Roadmap)
- Add unit tests for date & aggregation logic (extract functions first)
- Introduce linting (ESLint) and a minimal CI workflow
- Implement deletion & undo; CSV export
- Package distribution via `electron-builder`

## 18. Trust Rule
Trust these instructions. Only search the repository if information here is incomplete or proven wrong.

---
End of onboarding guide.
