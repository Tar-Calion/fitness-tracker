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
const barChartEl = document.getElementById('barChart');

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

function drawBarChart(){
  if (!barChartEl) return;
  const canvas = barChartEl;
  const ctx = canvas.getContext('2d');
  const container = canvas.parentElement;
  
  // Set canvas size to match container (auto-adjust to remaining window size)
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(dpr, dpr);
  
  const width = rect.width;
  const height = rect.height;
  
  // Collect data for last 15 weeks
  const today = new Date();
  const weeksData = [];
  for (let w = 14; w >= 0; w--) {
    const ref = new Date(today);
    ref.setDate(ref.getDate() - 7*w);
    const monday = startOfWeek(ref);
    const hard = entries.filter(e=>isInSameWeek(e.date,ref) && e.type==='hard').reduce((s,e)=>s+Number(e.minutes),0);
    const mod  = entries.filter(e=>isInSameWeek(e.date,ref) && e.type==='moderate').reduce((s,e)=>s+Number(e.minutes),0);
    const eq = mod + hard*2;
    weeksData.push({ monday, eq });
  }
  
  // Chart dimensions
  const padding = { left: 50, right: 20, top: 30, bottom: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Determine max value for scaling
  const maxEq = Math.max(...weeksData.map(w => w.eq), 150); // At least show goal line
  const yScale = chartHeight / maxEq;
  
  // Bar width
  const barWidth = Math.max(8, chartWidth / weeksData.length - 15);
  const barSpacing = chartWidth / weeksData.length;
  
  // Colors based on theme
  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#e7e9ed' : '#121314';
  const gridColor = isDark ? '#505659' : '#d0d4d9';
  const barColor = isDark ? '#ff9800' : '#ff9800';
  const barGreenColor = '#0a8f24';
  const goalLineColor = isDark ? '#ffc857' : '#d8aa1e';
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Draw grid lines (every 50 minutes)
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'right';
  for (let i = 0; i <= maxEq; i += 50) {
    const y = padding.top + chartHeight - (i * yScale);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(i.toString(), padding.left - 5, y + 4);
  }
  
  // Draw goal line at 150 (line only, label drawn later on top)
  let goalY = null;
  if (maxEq >= 150) {
    goalY = padding.top + chartHeight - (150 * yScale);
    ctx.strokeStyle = goalLineColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(padding.left, goalY);
    ctx.lineTo(width - padding.right, goalY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  // Draw bars
  weeksData.forEach((week, i) => {
    const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
    const barHeight = week.eq * yScale;
    const y = padding.top + chartHeight - barHeight;
    
    // Bar color (green if >= 150, orange otherwise)
    ctx.fillStyle = week.eq >= 150 ? barGreenColor : barColor;
    ctx.fillRect(x, y, barWidth, barHeight);
    
    // Week label (date)
    ctx.save();
    ctx.translate(x + barWidth / 2, height - padding.bottom + 15);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = textColor;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    const dateStr = week.monday.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    ctx.fillText(dateStr, 0, 0);
    ctx.restore();
    
    // Value on top of bar (if bar is tall enough)
    if (barHeight > 15) {
      ctx.fillStyle = textColor;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(week.eq.toString(), x + barWidth / 2, y - 3);
    }
  });
  
  // Draw goal line label on top (after bars)
  if (goalY !== null) {
    ctx.fillStyle = goalLineColor;
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('Ziel: 150', width - padding.right - 30, goalY - 5);
  }
  
  // Axis labels
  ctx.fillStyle = textColor;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Zeit (Wochen)', width / 2, height - 5);
  
  ctx.save();
  ctx.translate(15, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Äquivalente Minuten', 0, 0);
  ctx.restore();
}

function refresh(){
  sanitizeEntries();
  showWeek();
  drawBarChart();
}

/* --------------------------- Automatische Aktualisierung --------------------------- */
// Aktualisiert die Ansicht jeden Tag kurz nach Mitternacht, damit:
// - Am Montag automatisch die neue Woche angezeigt wird (ohne Benutzeraktion)
// - Die "Heute"-Markierung bei Tageswechsel korrekt springt
let dailyRefreshTimer = null;
function scheduleDailyRefresh(){
  if (dailyRefreshTimer) clearTimeout(dailyRefreshTimer);
  const now = new Date();
  const next = new Date(now);
  // Nächster Tag 00:00:05 (kleiner Puffer von 5 Sekunden, falls System zur Sekunde 0 noch beschäftigt)
  next.setDate(now.getDate()+1);
  next.setHours(0,0,5,0);
  const diff = Math.max(1000, next.getTime() - now.getTime());
  dailyRefreshTimer = setTimeout(()=>{
    try { refresh(); } catch(e){ console.warn('Geplanter Refresh fehlgeschlagen', e); }
    scheduleDailyRefresh(); // erneut planen
  }, diff);
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
}

function setupQuickButtons(){
  const quickContainer = document.getElementById('quickButtons');
  quickContainer.innerHTML='';
  const standardMinutes = [5,10,15,20,30,45,60];
  // Labels
  const groupModLabel = document.createElement('div'); groupModLabel.textContent='Moderat'; groupModLabel.className='group-label';
  quickContainer.appendChild(groupModLabel);
  standardMinutes.forEach(m=>{
    const btn = document.createElement('button');
    btn.classList.add('quick-btn');
    btn.textContent = `+${m} Min.`; // Nur Minutentext
    btn.title = `${m} Minuten moderat hinzufügen`;
    btn.addEventListener('click', ()=>addEntry('moderate', m));
    quickContainer.appendChild(btn);
  });
  // Custom input + add button for Moderate at end of row (visually separated)
  const modControls = document.createElement('div');
  modControls.className = 'custom-controls';
  const modInput = document.createElement('input');
  modInput.type = 'number';
  modInput.id = 'customMinutesModerate';
  modInput.placeholder = 'Min.';
  modInput.inputMode = 'numeric';
  modInput.min = '1';
  modControls.appendChild(modInput);
  const addModBtn = document.createElement('button');
  addModBtn.id = 'addModerate';
  addModBtn.textContent = '+ Moderat';
  addModBtn.title = 'Eigene Minuten moderat hinzufügen';
  addModBtn.addEventListener('click', ()=>{
    const val = Number(document.getElementById('customMinutesModerate').value);
    addEntry('moderate', val);
    document.getElementById('customMinutesModerate').value='';
  });
  modControls.appendChild(addModBtn);
  quickContainer.appendChild(modControls);
  // Hart
  const groupHardLabel = document.createElement('div'); groupHardLabel.textContent='Hart'; groupHardLabel.className='group-label';
  // Zeilenumbruch erzwingen zwischen den Gruppen: flex-basis 100%
  const lineBreak = document.createElement('div'); lineBreak.style.flexBasis='100%'; lineBreak.style.height='0';
  quickContainer.appendChild(lineBreak);
  quickContainer.appendChild(groupHardLabel);
  standardMinutes.forEach(m=>{
    const btn = document.createElement('button');
    btn.classList.add('quick-btn');
    btn.textContent = `+${m} Min.`;
    btn.title = `${m} Minuten hart hinzufügen`;
    btn.addEventListener('click', ()=>addEntry('hard', m));
    quickContainer.appendChild(btn);
  });
  // Custom input + add button for Hard at end of row (visually separated)
  const hardControls = document.createElement('div');
  hardControls.className = 'custom-controls';
  const hardInput = document.createElement('input');
  hardInput.type = 'number';
  hardInput.id = 'customMinutesHard';
  hardInput.placeholder = 'Min.';
  hardInput.inputMode = 'numeric';
  hardInput.min = '1';
  hardControls.appendChild(hardInput);
  const addHardBtn = document.createElement('button');
  addHardBtn.id = 'addHard';
  addHardBtn.textContent = '+ Hart';
  addHardBtn.title = 'Eigene Minuten hart hinzufügen';
  addHardBtn.addEventListener('click', ()=>{
    const val = Number(document.getElementById('customMinutesHard').value);
    addEntry('hard', val);
    document.getElementById('customMinutesHard').value='';
  });
  hardControls.appendChild(addHardBtn);
  quickContainer.appendChild(hardControls);
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
  drawBarChart(); // Redraw chart with new theme colors
  window.fitnessAPI.setDarkMode(darkMode);
}

/* --------------------------- Event Wiring --------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  setupQuickButtons();
  document.getElementById('chooseFileBtn').addEventListener('click', chooseFile);
  document.getElementById('createFileBtn').addEventListener('click', createNewFile);
  document.getElementById('reloadBtn').addEventListener('click', reloadFile);
  // Buttons are created in setupQuickButtons; listeners are attached there
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  updateThemeToggleIcon();
  initApp();
  scheduleDailyRefresh(); // Tägliche Aktualisierung starten
  window.addEventListener('focus', refresh); // Bei Rückkehr ins Fenster ebenfalls aktualisieren
  window.addEventListener('resize', drawBarChart); // Redraw chart on window resize
});