// Temporary script to capture light/dark screenshots
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
let currentFilePath = null;

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch { return {}; }
}
function saveConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  } catch {}
}
function readEntries(fp) {
  try { const j = JSON.parse(fs.readFileSync(fp, 'utf-8')); return Array.isArray(j) ? j : []; } catch { return []; }
}
function writeEntries(fp, e) {
  try { fs.writeFileSync(fp, JSON.stringify(e, null, 2), 'utf-8'); return true; } catch { return false; }
}

// Register all IPC handlers (same as main.js)
ipcMain.handle('init', async () => {
  const cfg = loadConfig();
  if (cfg.lastFilePath && fs.existsSync(cfg.lastFilePath)) {
    currentFilePath = cfg.lastFilePath;
    const entries = readEntries(currentFilePath);
    return { filePath: currentFilePath, entries, restored: true, darkMode: !!cfg.darkMode };
  }
  return { filePath: null, entries: [], restored: false, darkMode: !!cfg.darkMode };
});
ipcMain.handle('choose-file', async () => ({ filePath: null, entries: [] }));
ipcMain.handle('save-entries', async (_e, entries) => {
  if (!currentFilePath) return { ok: false, reason: 'no-file' };
  return { ok: writeEntries(currentFilePath, entries || []) };
});
ipcMain.handle('get-current-file', () => ({ filePath: currentFilePath }));
ipcMain.handle('set-dark-mode', (_e, enabled) => {
  const cfg = loadConfig();
  cfg.darkMode = !!enabled;
  if (currentFilePath) cfg.lastFilePath = currentFilePath;
  saveConfig(cfg);
  return { darkMode: cfg.darkMode };
});
ipcMain.handle('create-file', async () => ({ filePath: null, entries: [] }));

async function captureScreenshots() {
  // Point config at example-database.json so data is loaded
  const exampleFile = path.join(__dirname, 'example-database.json');
  const cfg = loadConfig();
  cfg.lastFilePath = exampleFile;
  cfg.darkMode = true;
  saveConfig(cfg);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await mainWindow.loadFile('index.html');
  mainWindow.show();
  mainWindow.focus();
  await new Promise(r => setTimeout(r, 4000));

  const views = ['dashboard', 'history', 'analyse'];

  for (const view of views) {
    // Switch to view
    await mainWindow.webContents.executeJavaScript(`
      if (typeof switchView === 'function') switchView('${view}');
    `);
    await new Promise(r => setTimeout(r, 800));

    // Dark mode
    await mainWindow.webContents.executeJavaScript(`
      document.body.classList.remove('light');
      if (typeof darkMode !== 'undefined') darkMode = true;
      if (typeof updateThemeToggleIcon === 'function') updateThemeToggleIcon();
      if (typeof refresh === 'function') refresh();
    `);
    await new Promise(r => setTimeout(r, 800));
    const darkImg = await mainWindow.capturePage();
    const darkBuf = darkImg.toPNG();
    fs.writeFileSync(path.join(__dirname, `screenshot-${view}-dark.png`), darkBuf);
    console.log(`${view} dark saved (${darkBuf.length} bytes)`);

    // Light mode
    await mainWindow.webContents.executeJavaScript(`
      document.body.classList.add('light');
      if (typeof darkMode !== 'undefined') darkMode = false;
      if (typeof updateThemeToggleIcon === 'function') updateThemeToggleIcon();
      if (typeof refresh === 'function') refresh();
    `);
    await new Promise(r => setTimeout(r, 800));
    const lightImg = await mainWindow.capturePage();
    const lightBuf = lightImg.toPNG();
    fs.writeFileSync(path.join(__dirname, `screenshot-${view}-light.png`), lightBuf);
    console.log(`${view} light saved (${lightBuf.length} bytes)`);
  }

  // Restore dark mode
  const restoreCfg = loadConfig();
  restoreCfg.darkMode = true;
  saveConfig(restoreCfg);

  app.quit();
}

app.whenReady().then(captureScreenshots);
app.on('window-all-closed', () => app.quit());
