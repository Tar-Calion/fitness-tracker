---
name: screenshot-test
description: 'Capture and compare screenshots of the Fitness Tracker Electron app for visual testing. Use when asked to "take screenshots", "test the UI", "compare with design", "visual test", or "check how the app looks". Captures all 3 views (Dashboard, History, Analyse) in both dark and light themes.'
---

# Screenshot Test

Automated visual testing skill for the Fitness Tracker Electron app. Captures screenshots of all views in both themes and saves them to the project root.

## When to Use This Skill

- After making UI or CSS changes, to verify they look correct
- When comparing the app against design mockups
- When the user asks to "take screenshots" or "test the UI visually"
- As part of an iteration cycle: implement → screenshot → compare → refine

## Prerequisites

- `npm install` must have been run (Electron dependency)
- `example-database.json` must exist in the project root (provides test data)
- Must be run from the repository root directory

## How to Capture Screenshots

Run from the repository root:

```bash
npx electron .github/skills/screenshot-test/scripts/screenshot-helper.js
```

This produces 6 PNG files in the project root:

| File | Content |
|------|---------|
| `screenshot-dashboard-dark.png` | Dashboard view, dark theme |
| `screenshot-dashboard-light.png` | Dashboard view, light theme |
| `screenshot-history-dark.png` | History view, dark theme |
| `screenshot-history-light.png` | History view, light theme |
| `screenshot-analyse-dark.png` | Analyse view, dark theme |
| `screenshot-analyse-light.png` | Analyse view, light theme |

## How It Works

1. Configures Electron to load `example-database.json` as test data
2. Opens the app in a 1200×800 window
3. For each view (dashboard, history, analyse):
   - Switches to the view via `switchView()`
   - Captures dark mode screenshot
   - Switches to light mode
   - Captures light mode screenshot
4. Saves PNGs to project root
5. Restores dark mode config and exits

## Comparing with Design Mockups

Design mockups are in `redesign/stitch/advanced_fitness_tracker_dashboard_*/screen.png`:

| Mockup | Corresponds to |
|--------|---------------|
| `_dashboard_1/screen.png` | Dashboard dark |
| `_dashboard_2/screen.png` | Analyse dark |
| `_dashboard_3/screen.png` | Dashboard light |
| `_dashboard_4/screen.png` | History dark |
| `_dashboard_5/screen.png` | Analyse light |
| `_dashboard_6/screen.png` | History light |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Empty (0 byte) screenshots | Increase wait times in the script, or ensure window is visible |
| Views not switching | Check that `switchView` is exposed on `window` in `renderer.js` |
| Wrong theme | Check `body.light` class toggling (dark = no class, light = `body.light`) |
| Missing test data | Ensure `example-database.json` exists with training entries |
