const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');

function mainHarness(files, readFile) {
  const handlers = new Map();
  const reads = [];
  const windows = [];
  const configPath = path.join(ROOT, 'test-profile', 'config.json');
  const electron = {
    app: { getPath: () => path.dirname(configPath), whenReady: () => Promise.resolve(), on() {}, quit() {} },
    BrowserWindow: class {
      constructor(options) { windows.push(options); }
      async loadFile(file) { assert.equal(file, path.join(ROOT, 'index.html')); }
    },
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    dialog: {}
  };
  const fakeFs = {
    promises: { readFile: async file => {
      reads.push(file);
      if (readFile) return readFile(file);
      await Promise.resolve();
      if (!files.has(file)) throw new Error('ENOENT');
      return files.get(file);
    } },
    readFileSync: () => { throw new Error('Startup must not read files synchronously'); },
    existsSync: () => { throw new Error('Startup must not probe files synchronously'); }
  };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8'), {
    require: name => name === 'electron' ? electron : name === 'fs' ? fakeFs : require(name),
    __dirname: ROOT, process, console
  });
  return { handlers, reads, windows, configPath };
}

test('window creation proceeds while config is still loading; init reuses the prefetched read', async () => {
  let resolveConfig;
  const pending = new Promise(resolve => { resolveConfig = resolve; });
  const harness = mainHarness(new Map(), () => pending);
  await Promise.resolve();
  assert.equal(harness.windows.length, 1);
  assert.equal(harness.windows[0].webPreferences.sandbox, true);
  assert.equal(harness.windows[0].webPreferences.contextIsolation, true);
  assert.equal(harness.windows[0].webPreferences.nodeIntegration, false);
  const result = harness.handlers.get('init')();
  assert.equal(harness.reads.length, 1);
  resolveConfig('{}');
  assert.equal((await result).filePath, null);
});

test('restores entries and theme, and reads fresh data when a window is reopened', async () => {
  const files = new Map();
  const harness = mainHarness(files);
  const training = path.join(ROOT, 'training.json');
  files.set(harness.configPath, JSON.stringify({ lastFilePath: training, darkMode: true }));
  files.set(training, JSON.stringify([{ date: '2026-10-11', type: 'hard', minutes: 20 }]));
  const initial = await harness.handlers.get('init')();
  assert.equal(initial.darkMode, true);
  assert.equal(initial.restored, true);
  assert.equal(initial.entries[0].minutes, 20);
  assert.equal(harness.handlers.get('get-current-file')().filePath, training);
  files.set(training, '[]');
  assert.equal((await harness.handlers.get('init')()).entries.length, 0);
});

test('missing config/file and malformed data still produce usable initial state', async () => {
  for (const scenario of ['no-config', 'missing-file', 'invalid-json', 'not-array']) {
    const files = new Map();
    const harness = mainHarness(files);
    const training = path.join(ROOT, 'training.json');
    if (scenario !== 'no-config') files.set(harness.configPath, JSON.stringify({ lastFilePath: training, darkMode: false }));
    if (scenario === 'invalid-json') files.set(training, '{');
    if (scenario === 'not-array') files.set(training, '{}');
    const result = await harness.handlers.get('init')();
    assert.equal(result.entries.length, 0, scenario);
    assert.equal(result.darkMode, false, scenario);
    assert.equal(result.restored, scenario === 'invalid-json' || scenario === 'not-array', scenario);
  }
});

function rendererHarness() {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      innerHTML: '', textContent: '', value: id === 'analyseRange' ? '6m' : '',
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}, setAttribute() {}
    });
    return elements.get(id);
  }
  const classList = { add() {}, remove() {}, toggle() {} };
  const context = vm.createContext({
    document: { getElementById: element, querySelectorAll: () => [], querySelector: () => null, body: { classList } },
    window: { addEventListener() {}, fitnessAPI: {} },
    Date, Map, console
  });
  // Skip canvas drawing, but exercise the actual dashboard/progress and analysis calculations.
  element('barChart').parentElement = { getBoundingClientRect: () => ({ width: 0, height: 0 }) };
  element('barChart').getContext = () => ({});
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'renderer.js'), 'utf8'), context);
  Object.assign(context, context.window);
  return { context, element, run: code => vm.runInContext(code, context) };
}

test('cached totals preserve Monday weeks across year and daylight-saving boundaries', () => {
  const harness = rendererHarness();
  harness.run(`entries = [
    { date: '2025-12-29', type: 'moderate', minutes: '30' },
    { date: '2026-01-04', type: 'hard', minutes: 60 },
    { date: '2026-01-05', type: 'hard', minutes: 5 },
    { date: '2026-03-29', type: 'moderate', minutes: 10 },
    { date: '2026-03-30', type: 'moderate', minutes: 20 },
    { date: '2026-10-25', type: 'hard', minutes: 15 },
    { date: '2026-10-26', type: 'hard', minutes: 25 },
    { date: '2026-10-26', type: 'hard', minutes: -1 }
  ]; sanitizeEntries();`);
  assert.equal(harness.run("weeklyTotals.get('2025-12-29').moderate + 2 * weeklyTotals.get('2025-12-29').hard"), 150);
  assert.equal(harness.run("weeklyTotals.get('2026-01-05').hard"), 5);
  assert.equal(harness.run("weeklyTotals.get('2026-03-23').moderate"), 10);
  assert.equal(harness.run("weeklyTotals.get('2026-03-30').moderate"), 20);
  assert.equal(harness.run("weeklyTotals.get('2026-10-19').hard"), 15);
  assert.equal(harness.run("weeklyTotals.get('2026-10-26').hard"), 25);
});

test('add/edit/delete rebuild totals, while dashboard refresh does not rescan entries', () => {
  const harness = rendererHarness();
  harness.run("entries = [{ date: ymd(new Date()), type: 'hard', minutes: 75 }]; sanitizeEntries(); refresh();");
  assert.match(harness.element('weekProgress').innerHTML, /100%/);
  harness.run('entries[0].minutes = 15; sanitizeEntries(); refresh();');
  assert.match(harness.element('weekProgress').innerHTML, /20%/);
  harness.run('entries.push({ date: ymd(new Date()), type: "moderate", minutes: 30 }); sanitizeEntries(); refresh();');
  assert.match(harness.element('weekProgress').innerHTML, /40%/);
  harness.run(`entries = new Proxy(entries, { get() { throw new Error('Unexpected entry scan'); } }); refresh();`);
  assert.match(harness.element('weekProgress').innerHTML, /40%/);
  harness.run('entries = []; sanitizeEntries(); refresh();');
  assert.match(harness.element('weekProgress').innerHTML, /0%/);
});

test('loading/replacing/creating a file refreshes caches and renders an empty initial dashboard', async () => {
  const harness = rendererHarness();
  harness.context.window.fitnessAPI = {
    init: async () => ({ filePath: null, entries: [], darkMode: false }),
    chooseFile: async () => ({ filePath: 'test.json', entries: [{ date: new Date().toLocaleDateString('sv-SE'), type: 'hard', minutes: 75 }] }),
    createFile: async () => ({ filePath: 'new.json', entries: [] })
  };
  await harness.run('initApp()');
  assert.match(harness.element('weekProgress').innerHTML, /0%/);
  await harness.run('chooseFile()');
  assert.match(harness.element('weekProgress').innerHTML, /100%/);
  await harness.run('createNewFile()');
  assert.match(harness.element('weekProgress').innerHTML, /0%/);
});
