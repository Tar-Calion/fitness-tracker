// Run with: node scripts/check-startup.cjs [--npm] [--baseline] [--screenshots]
// Uses the real main/preload/renderer with disposable config and training data.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');

if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  for (const size of [0, 200, 10000]) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fitness-startup-'));
    let source = ROOT;
    if (process.argv.includes('--baseline')) {
      const { pathToFileURL } = require('node:url');
      source = path.join(temporary, 'baseline');
      fs.mkdirSync(source);
      for (const file of ['main.js', 'preload.js', 'renderer.js', 'index.html']) {
        let content = require('node:child_process').execFileSync('git', ['show', `HEAD:${file}`], { cwd: ROOT, encoding: 'utf8' });
        // Electron resolves relative loadFile paths against the harness directory.
        if (file === 'main.js') content = content.replace("mainWindow.loadFile('index.html')", "mainWindow.loadFile(path.join(__dirname, 'index.html'))");
        if (file === 'index.html') content = content.replace('href="styles.css"', `href="${pathToFileURL(path.join(ROOT, 'styles.css')).href}"`);
        fs.writeFileSync(path.join(source, file), content);
      }
    }
    const started = Date.now();
    const env = { ...process.env, FITNESS_CHECK_SIZE: String(size), FITNESS_CHECK_STARTED: String(started), FITNESS_CHECK_DIRECTORY: temporary, FITNESS_CHECK_SOURCE: source,
      FITNESS_CHECK_SCREENSHOTS: process.argv.includes('--screenshots') && size === 200 ? '1' : '' };
    delete env.ELECTRON_RUN_AS_NODE;
    const useNpm = process.argv.includes('--npm');
    const command = useNpm ? (process.platform === 'win32' ? 'cmd.exe' : 'npm') : require('electron');
    const args = useNpm
      ? (process.platform === 'win32' ? ['/d', '/s', '/c', 'npm exec -- electron scripts/check-startup.cjs'] : ['exec', '--', 'electron', __filename])
      : [__filename];
    const result = spawnSync(command, args, { cwd: ROOT, env, encoding: 'utf8', windowsHide: true, timeout: 30000 });
    fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    process.stdout.write(result.stdout || '');
    if (result.status !== 0) {
      process.stderr.write(result.stderr || String(result.error || `Startup check failed (status=${result.status}, signal=${result.signal})`));
      process.exit(1);
    }
  }
} else {
  const { app } = require('electron');
  const temporary = process.env.FITNESS_CHECK_DIRECTORY;
  app.setPath('userData', temporary);
  const size = Number(process.env.FITNESS_CHECK_SIZE);
  const data = Array.from({ length: size }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (index % 730));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { date: key, type: index % 2 ? 'hard' : 'moderate', minutes: 5 + index % 56 };
  });
  const dataPath = path.join(temporary, 'training.json');
  fs.writeFileSync(dataPath, JSON.stringify(data));
  fs.writeFileSync(path.join(temporary, 'config.json'), JSON.stringify({ lastFilePath: dataPath, darkMode: true }));
  const timeout = setTimeout(() => { console.error('Startup timed out'); app.exit(1); }, 25000);
  app.on('will-quit', () => {
    clearTimeout(timeout);
  });
  app.once('browser-window-created', (_event, win) => {
    const errors = [];
    win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); });
    win.webContents.once('did-finish-load', async () => {
      try {
        let ready = false;
        for (let attempt = 0; attempt < 1000; attempt++) {
          ready = await win.webContents.executeJavaScript("document.getElementById('fileStatus').textContent.includes('wiederhergestellt') && document.getElementById('weekView').children.length === 7");
          if (ready) break;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        assert.equal(ready, true, 'Dashboard did not finish initializing');
        const readyMs = Date.now() - Number(process.env.FITNESS_CHECK_STARTED);
        const result = await win.webContents.executeJavaScript(`(() => {
          const durations = [];
          for (let i = 0; i < 5; i++) {
            const start = performance.now();
            refresh();
            durations.push(performance.now() - start);
          }
          durations.sort((a, b) => a - b);
          return { count: entries.length, dashboardMs: durations[2], days: weekViewEl.children.length };
        })()`);
        assert.equal(result.count, size);
        assert.equal(result.days, 7);
        if (size === 200 && process.env.FITNESS_CHECK_SOURCE === ROOT) {
          const changes = await win.webContents.executeJavaScript(`(async () => {
            const weekKey = ymd(startOfWeek(new Date()));
            const before = weeklyTotals.get(weekKey).hard;
            addEntry('hard', 75);
            const index = entries.length - 1;
            const added = weeklyTotals.get(weekKey).hard === before + 75;
            switchView('history');
            historyEdit(index);
            document.getElementById('edit-minutes').value = '15';
            historySave(index);
            const edited = weeklyTotals.get(weekKey).hard === before + 15;
            historyDelete(index);
            document.getElementById('confirmYes').click();
            await saveEntries();
            switchView('dashboard');
            return { added, edited, deleted: weeklyTotals.get(weekKey).hard === before, count: entries.length };
          })()`);
          assert.deepEqual(changes, { added: true, edited: true, deleted: true, count: size });
          assert.equal(JSON.parse(fs.readFileSync(dataPath, 'utf8')).length, size);
        }
        if (process.env.FITNESS_CHECK_SCREENSHOTS) {
          const output = path.join(ROOT, 'test-results');
          fs.mkdirSync(output, { recursive: true });
          win.setContentSize(1200, 800);
          await win.webContents.executeJavaScript('document.fonts.ready');
          for (const view of ['dashboard', 'history', 'analyse']) {
            for (const theme of ['dark', 'light']) {
              await win.webContents.executeJavaScript(`darkMode = ${theme === 'dark'}; document.body.classList.toggle('light', !darkMode); updateThemeToggleIcon(); switchView('${view}'); refresh();`);
              await new Promise(resolve => setTimeout(resolve, 800));
              if (view === 'dashboard') {
                const fits = await win.webContents.executeJavaScript(`(() => {
                  const dashboard = document.getElementById('view-dashboard').getBoundingClientRect();
                  const chart = document.getElementById('barChart').getBoundingClientRect();
                  return dashboard.bottom <= innerHeight + 1 && chart.bottom <= innerHeight + 1;
                })()`);
                assert.equal(fits, true, 'Dashboard must fit at 1200x800');
              }
              fs.writeFileSync(path.join(output, `${view}-${theme}.png`), (await win.webContents.capturePage()).toPNG());
            }
          }
        }
        assert.deepEqual(errors, []);
        process.stdout.write(JSON.stringify({ entries: size, readyMs, dashboardMs: Number(result.dashboardMs.toFixed(2)) }) + '\n', () => app.exit(0));
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    });
  });
  require(path.join(process.env.FITNESS_CHECK_SOURCE, 'main.js'));
}
