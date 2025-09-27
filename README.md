# Fitness Tracker (Electron)

Lokale Desktop-App (Windows / auch andere Plattformen) zur Erfassung von Trainingsminuten:
- Zwei Intensitäten: hart / moderat
- Woche startet Montag
- Ziel: 150 Minuten moderat oder 75 Minuten hart (1 hart = 2 moderat)
- Fortschrittsbalken für aktuelle Woche
- Rückblick der letzten 4 Wochen (moderat-Äquivalente)
- Speicherung in einer frei wählbaren JSON/TXT-Datei (Array von Einträgen)
- Merkt sich zuletzt gewählte Datei (in App-Config im Benutzerprofil)
- Umschaltbarer Dark Mode (🌙 / ☀️) – Einstellung bleibt über Neustarts erhalten

## Datenformat
Einträge werden als Array gespeichert:
```json
[
  { "date": "2025-09-27", "type": "moderate", "minutes": 30 },
  { "date": "2025-09-27", "type": "hard", "minutes": 15 }
]
```

## Nutzung
1. Abhängigkeiten installieren
```bash
npm install
```
2. App starten
```bash
npm start
```
Windows: "Start Finess-Tracker.vbs" ausführen.
3. Schaltfläche "Datei wählen" anklicken und bestehende oder neue (leere) .json / .txt Datei auswählen.
4. Über Schnell-Buttons oder freies Minutenfeld Einträge hinzufügen.
5. Optional den Dark Mode über den Button rechts im Titel (🌙/☀️) umschalten.
6. Daten werden automatisch gespeichert.

## Ordnerstruktur (wichtigste Dateien)
- `main.js` – Electron Main Prozess, Fenster & Datei-/Config-IPC
- `preload.js` – Sicherer Bridge-Layer (contextIsolation)
- `index.html` – Oberfläche + Theme Toggle
- `renderer.js` – UI-Logik / Rendering / Theme Handling
- `package.json` – Projekt- und Script-Definition

## Sicherheitsaspekte
- `contextIsolation: true`, kein direktes Node.js im Renderer
- IPC nur für nötige Datei- und Theme-Funktionen

## Packaging (optional)
Aktuell kein Packager konfiguriert. Für ein Setup z.B. `electron-builder` hinzufügen:
```bash
npm install --save-dev electron-builder
```
`package.json` anpassen (Beispiel):
```json
"build": { "appId": "de.example.fitness-tracker" }
```
Dann:
```bash
npx electron-builder
```

## Weiteres / Ideen
- Lösch-/Undo-Funktion einzelner Einträge (UI Dialog)
- Export als CSV
- Filter für bestimmte Wochen
- Mobile Optimierung weiter ausbauen

Lizenz: The Unlicense (Public Domain)
