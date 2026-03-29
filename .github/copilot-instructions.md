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

## Architecture
- **3 views**: Dashboard, History (Historie), Analyse — switched via sidebar navigation
- **View routing**: `switchView()` in `renderer.js` toggles `.view.active` class on view containers
- **CSS**: All styles in `styles.css` using CSS custom properties (Kinetic Volt design system)
- **Fonts**: Space Grotesk + Inter, bundled locally via `@fontsource` npm packages
- **Theme**: Dark mode (default, no class) / Light mode (`body.light` class). Toggled via header button.

## File Structure
| File | Purpose |
|------|---------|
| `main.js` | Electron main process, IPC handlers, file I/O, config |
| `preload.js` | Secure IPC bridge (`window.fitnessAPI`) |
| `index.html` | Layout: sidebar, header, 3 view containers |
| `renderer.js` | All UI logic: routing, dashboard, history CRUD, analyse charts |
| `styles.css` | Kinetic Volt design system, all component styles |
| `screenshot-helper.js` | Automated screenshot capture for all 6 view/theme combos |

## IPC Channels
`init` · `choose-file` · `create-file` · `save-entries` · `get-current-file` · `set-dark-mode`

To add a new channel: add handler in `main.js`, expose in `preload.js`, call via `window.fitnessAPI` in `renderer.js`.

## Views
- **Dashboard**: Quick-add cards (Moderat/Intensiv), week overview grid, progress bar, 15-week bar chart (Canvas)
- **History**: Filterable/sortable entry table, inline CRUD (edit/delete/add), confirm dialog for deletion
- **Analyse**: Stats cards (best month, weekly avg, yearly total), monthly trend line chart (Canvas), ratio donut chart (Canvas)

## CSS Design System (Kinetic Volt)
- Surface hierarchy: `--surface` → `--surface-container-low` → `--surface-container` → `--surface-container-highest`
- Primary accent: `--primary` (#A2FE00 dark / #7ACC00 light)
- No-Line Rule: structure via surface tone changes, not borders
- Ghost borders: `--outline-variant` at low opacity
- Typography: `--font-headline` (Space Grotesk), `--font-body` (Inter)
- All tokens defined as CSS custom properties in `:root` and `body.light`

## Persistence
- User data lives in a user-chosen JSON/TXT file (not bundled with the app).
- Last-used file path and dark mode preference stored in `config.json` inside Electron's `userData` directory.

## Documentation Rule
With every functional change, update **both** this file and `README.md`.