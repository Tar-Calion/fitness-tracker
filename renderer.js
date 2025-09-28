// Renderer Prozess: UI + Logik (angepasst von der Browser-Version)

let entries = []; // {date: 'YYYY-MM-DD', type: 'hard'|'moderate', minutes:Number}
let currentFilePath = null;
let darkMode = false;

/* --------------------------- Datum & Helpers --------------------------- */
function ymd(date){
  const Y = date.getFullYear();
  const M = String(date.getMonth()+1).padStart(2,'0');
  const D = String(date.getDate()).padStart(2,'0');
  return `${Y}-${M}-${D}`;
}
function parseDate(dateStr){
  const [y,m,d] = String(dateStr||'').split('-').map(Number);
  return new Date(y, (m||1)-1, d||1);
}
function startOfWeek(d){
  const date = (d instanceof Date) ? new Date(d) : parseDate(d);
  date.setHours(0,0,0,0);
  const dayIndex = (date.getDay()+6)%7; // Montag=0
  date.setDate(date.getDate()-dayIndex);
  date.setHours(0,0,0,0);
  return date;
}
function isInSameWeek(dateStr, refDate){
  const d = parseDate(dateStr);
  const mondayRef = startOfWeek(refDate);
  const mondayD = startOfWeek(d);
  return mondayRef.getTime() === mondayD.getTime();
}
function sanitizeEntries(){
  entries = (entries||[]).map(e=>({
    date: String(e.date||''),
    type: (e.type==='hard'?'hard':'moderate'),
    minutes: Number(e.minutes)||0
  })).filter(e=>e.date && (e.type==='hard'||e.type==='moderate') && e.minutes>0);
}

/* --------------------------- UI Elemente --------------------------- */
const fileStatusEl = document.getElementById('fileStatus');
const weekViewEl = document.getElementById('weekView');
const weekProgressEl = document.getElementById('weekProgress');
const fourWeeksEl = document.getElementById('fourWeeks');

/* --------------------------- Rendering --------------------------- */
function formatDateShort(d){
  return d.toLocaleDateString('de-DE',{ day:'2-digit', month:'2-digit' });
}

function showWeek(){
  const today = new Date();
  const todayStr = ymd(today);
  const monday = startOfWeek(today);
  let html = '';
  for (let i=0;i<7;i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate()+i);
    const ds = ymd(d);
    const dayName = ['Mo','Di','Mi','Do','Fr','Sa','So'][i];
    const dayEntries = entries.filter(e=>e.date===ds);
    const hard = dayEntries.filter(e=>e.type==='hard').reduce((s,e)=>s+Number(e.minutes),0);
    const mod  = dayEntries.filter(e=>e.type==='moderate').reduce((s,e)=>s+Number(e.minutes),0);
    const isToday = ds === todayStr;
    html += `<div class="day${isToday?' today':''}"><b>${dayName}<br>${formatDateShort(d)}</b><br>`+
            `<span class="hard">${hard} min. hart</span><br>`+
            `<span class="moderate">${mod} min. moderat</span></div>`;
  }
  const weekHard = entries.filter(e=>isInSameWeek(e.date,today) && e.type==='hard').reduce((s,e)=>s+Number(e.minutes),0);
  const weekMod  = entries.filter(e=>isInSameWeek(e.date,today) && e.type==='moderate').reduce((s,e)=>s+Number(e.minutes),0);
  const totalEq = weekMod + weekHard*2;
  const percent = (totalEq/150)*100;
  const capped = Math.max(0, Math.min(percent,100));
  const barClass = percent >= 100 ? 'progress-bar progress-green' : 'progress-bar';
  const progressHtml = `
        <div class="progress-container" aria-label="Wochenfortschritt">
      <div class="${barClass}" style="width:${capped}%">${Math.round(percent)}%</div>
    </div>
    <div class="week-summary-text">Ziel: 150 equiv-Minuten (150 min. moderat bzw. 75 min. hart). Bereits geleistet: ${totalEq} equiv-Minuten (${weekMod} min. moderat und ${weekHard} min. hart).</div>`;
  weekViewEl.innerHTML = html;
  weekProgressEl.innerHTML = progressHtml;
}

function showFourWeeks(){
  const today = new Date();
  let html = '';
  for (let w=0; w<4; w++) {
    const ref = new Date(today);
    ref.setDate(ref.getDate() - 7*w);
    const monday = startOfWeek(ref);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate()+6);
    const hard = entries.filter(e=>isInSameWeek(e.date,ref) && e.type==='hard').reduce((s,e)=>s+Number(e.minutes),0);
    const mod  = entries.filter(e=>isInSameWeek(e.date,ref) && e.type==='moderate').reduce((s,e)=>s+Number(e.minutes),0);
    const eq = mod + hard*2;
    const percent = Math.min(100, (eq/150)*100);
    const green = eq >= 150;
    html += `<div class="week-small" title="Woche ${formatDateShort(monday)} - ${formatDateShort(sunday)}: ${eq} eq">`+
      `<span class="week-label">${formatDateShort(monday)} - ${formatDateShort(sunday)}</span>`+
      `<span class="week-small-bar-wrapper"><span class="week-small-bar ${green?'green':''}" style="width:${percent}%;"></span></span>`+
      `<span class="week-eq">${eq}</span>`+
      `</div>`;
  }
  fourWeeksEl.innerHTML = html;
}

function refresh(){
  sanitizeEntries();
  showWeek();
  showFourWeeks();
}

/* --------------------------- Datei Handling (IPC) --------------------------- */
async function initApp(){
  try {
    const res = await window.fitnessAPI.init();
    if (res.darkMode) {
      darkMode = true;
      document.body.classList.add('dark');
      updateThemeToggleIcon();
    }
    if (res.filePath) {
      currentFilePath = res.filePath;
      entries = res.entries || [];
      updateFileStatus(true, res.restored);
      refresh();
    }
  } catch (e) {
    console.warn('Init fehlgeschlagen', e);
  }
}

function updateFileStatus(hasFile, restored){
  if (!hasFile || !currentFilePath) {
    fileStatusEl.textContent = 'Keine Datei gewählt.';
  } else {
    const name = currentFilePath.split(/\\|\//).pop();
    fileStatusEl.textContent = `Datei: ${name}${restored?' (wiederhergestellt)':''}`;
  }
}

async function chooseFile(){
  const res = await window.fitnessAPI.chooseFile();
  if (res.filePath) {
    currentFilePath = res.filePath;
    entries = res.entries || [];
    updateFileStatus(true, false);
    refresh();
  }
}

async function createNewFile(){
  const res = await window.fitnessAPI.createFile();
  if (res.filePath) {
    currentFilePath = res.filePath;
    entries = [];
    updateFileStatus(true, false);
    refresh();
  }
}

async function reloadFile(){
  if (!currentFilePath) return;
  const res = await window.fitnessAPI.init(); // lädt erneut
  if (res.filePath) {
    currentFilePath = res.filePath;
    entries = res.entries || [];
    updateFileStatus(true, true);
    refresh();
  }
}

async function saveEntries(){
  await window.fitnessAPI.saveEntries(entries);
}

/* --------------------------- Eingabe --------------------------- */
function addEntry(type, minutes){
  if (!currentFilePath) { alert('Bitte zuerst eine Datei wählen.'); return; }
  if (!minutes || minutes <= 0 || !['hard','moderate'].includes(type)) return;
  const today = ymd(new Date());
  entries.push({ date: today, type, minutes:Number(minutes) });
  sanitizeEntries();
  saveEntries();
  refresh();
  document.getElementById('customMinutes').value='';
}

function setupQuickButtons(){
  const quickContainer = document.getElementById('quickButtons');
  quickContainer.innerHTML='';
  const standardMinutes = [5,10,15,20,30,45];
  const groupHardLabel = document.createElement('div'); groupHardLabel.textContent='Hart'; groupHardLabel.className='group-label';
  const groupModLabel = document.createElement('div'); groupModLabel.textContent='Moderat'; groupModLabel.className='group-label';

  // Moderat zuerst
  quickContainer.appendChild(groupModLabel);
  standardMinutes.forEach(m=>{
    const btn = document.createElement('button');
    btn.classList.add('quick-btn');
    btn.textContent = `${m} min. moderat`;
    btn.addEventListener('click', ()=>addEntry('moderate', m));
    quickContainer.appendChild(btn);
  });
  // Hart
  quickContainer.appendChild(groupHardLabel);
  standardMinutes.forEach(m=>{
    const btn = document.createElement('button');
    btn.classList.add('quick-btn');
    btn.textContent = `${m} min. hart`;
    btn.addEventListener('click', ()=>addEntry('hard', m));
    quickContainer.appendChild(btn);
  });
}

/* --------------------------- Theme Handling --------------------------- */
function updateThemeToggleIcon(){
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.textContent = darkMode ? '☀️' : '🌙';
  btn.setAttribute('aria-label', darkMode ? 'Zu hellem Modus wechseln' : 'Zu dunklem Modus wechseln');
}
function toggleTheme(){
  darkMode = !darkMode;
  document.body.classList.toggle('dark', darkMode);
  updateThemeToggleIcon();
  window.fitnessAPI.setDarkMode(darkMode);
}

/* --------------------------- Event Wiring --------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  setupQuickButtons();
  document.getElementById('chooseFileBtn').addEventListener('click', chooseFile);
  document.getElementById('createFileBtn').addEventListener('click', createNewFile);
  document.getElementById('reloadBtn').addEventListener('click', reloadFile);
  document.getElementById('addModerate').addEventListener('click', ()=>{
    const val = Number(document.getElementById('customMinutes').value);
    addEntry('moderate', val);
  });
  document.getElementById('addHard').addEventListener('click', ()=>{
    const val = Number(document.getElementById('customMinutes').value);
    addEntry('hard', val);
  });
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  updateThemeToggleIcon();
  initApp();
});
