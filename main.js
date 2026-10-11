const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
let currentFilePath = null;

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) { return {}; }
}

function saveConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  } catch (e) { console.warn('Config speichern fehlgeschlagen', e); }
}

async function readEntries(filePath) {
  let text;
  try {
    text = await fs.promises.readFile(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) return json;
    return [];
  } catch (e) {
    return [];
  }
}

async function restoreInitialState() {
  let cfg = {};
  try {
    cfg = JSON.parse(await fs.promises.readFile(CONFIG_FILE, 'utf-8')) || {};
  } catch (e) { /* A first launch has no saved config. */ }
  if (cfg.lastFilePath) {
    const entries = await readEntries(cfg.lastFilePath);
    if (entries !== null) {
      currentFilePath = cfg.lastFilePath;
      return { filePath: currentFilePath, entries, restored: true, darkMode: !!cfg.darkMode };
    }
  }
  return { filePath: null, entries: [], restored: false, darkMode: !!cfg.darkMode };
}

// Start disk reads while Electron prepares the window and renderer.
let initialState = restoreInitialState();

function writeEntries(filePath, entries) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Fehler beim Schreiben', e);
    return false;
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1368,
    height: 862,
    backgroundColor: '#0E0E0E',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('init', () => {
  const state = initialState || restoreInitialState();
  initialState = null;
  return state;
});

ipcMain.handle('choose-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Datei mit Trainingsdaten auswählen',
    properties: ['openFile'],
    filters: [ { name: 'JSON/Text', extensions: ['json', 'txt'] } ]
  });
  if (result.canceled || !result.filePaths.length) {
    return { filePath: null, entries: [] };
  }
  currentFilePath = result.filePaths[0];
  const cfg = loadConfig();
  cfg.lastFilePath = currentFilePath;
  saveConfig(cfg);
  const entries = await readEntries(currentFilePath) || [];
  return { filePath: currentFilePath, entries };
});

ipcMain.handle('save-entries', async (_e, entries) => {
  if (!currentFilePath) return { ok: false, reason: 'no-file' };
  const ok = writeEntries(currentFilePath, entries || []);
  return { ok };
});

ipcMain.handle('get-current-file', () => ({ filePath: currentFilePath }));

// Persist Dark Mode setting
ipcMain.handle('set-dark-mode', (_e, enabled) => {
  const cfg = loadConfig();
  cfg.darkMode = !!enabled;
  // preserve lastFilePath if present
  if (currentFilePath) cfg.lastFilePath = currentFilePath;
  saveConfig(cfg);
  return { darkMode: cfg.darkMode };
});

ipcMain.handle('create-file', async () => {
  const result = await dialog.showSaveDialog({
    title: 'Neue Trainingsdatei anlegen',
    filters: [ { name: 'JSON', extensions: ['json'] }, { name: 'Text', extensions: ['txt'] } ],
    defaultPath: 'fitness-daten.json'
  });
  if (result.canceled || !result.filePath) return { filePath: null, entries: [] };
  try {
    if (!fs.existsSync(result.filePath)) {
      fs.writeFileSync(result.filePath, '[]', 'utf-8');
    }
    currentFilePath = result.filePath;
    const cfg = loadConfig();
    cfg.lastFilePath = currentFilePath;
    saveConfig(cfg);
    return { filePath: currentFilePath, entries: [] };
  } catch (e) {
    console.error('Fehler beim Anlegen', e);
    return { filePath: null, entries: [], error: String(e) };
  }
});
