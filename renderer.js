// Renderer: UI, Routing, Dashboard, History, Analyse

let entries = [];
let currentFilePath = null;
let darkMode = true; // dark by default for Kinetic Volt

/* ============================== Date Helpers ============================== */
function ymd(date) {
  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  return `${Y}-${M}-${D}`;
}
function parseDate(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function startOfWeek(d) {
  const date = (d instanceof Date) ? new Date(d) : parseDate(d);
  date.setHours(0, 0, 0, 0);
  const dayIndex = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayIndex);
  date.setHours(0, 0, 0, 0);
  return date;
}
function isInSameWeek(dateStr, refDate) {
  return startOfWeek(parseDate(dateStr)).getTime() === startOfWeek(refDate).getTime();
}
function sanitizeEntries() {
  entries = (entries || []).map(e => ({
    date: String(e.date || ''),
    type: (e.type === 'hard' ? 'hard' : 'moderate'),
    minutes: Number(e.minutes) || 0
  })).filter(e => e.date && e.minutes > 0);
}
function formatDateShort(d) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}
function formatDateFull(d) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ============================== DOM Elements ============================== */
const fileStatusEl = document.getElementById('fileStatus');
const weekViewEl = document.getElementById('weekView');
const weekProgressEl = document.getElementById('weekProgress');
const barChartEl = document.getElementById('barChart');
const headerWeekDisplay = document.getElementById('headerWeekDisplay');
const historyTableWrap = document.getElementById('historyTableWrap');
const analyseStatsEl = document.getElementById('analyseStats');
const analyseRangeEl = document.getElementById('analyseRange');
const weeklyTrendChartEl = document.getElementById('weeklyTrendChart');
const analyseInsightsEl = document.getElementById('analyseInsights');
const monthlyTimelineEl = document.getElementById('monthlyTimeline');

/* ============================== View Routing ============================== */
let currentView = 'dashboard';

window.switchView = function switchView(viewName) {
  currentView = viewName;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById('view-' + viewName);
  if (target) target.classList.add('active');
  const navBtn = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (navBtn) navBtn.classList.add('active');
  // Refresh view-specific content
  if (viewName === 'dashboard') { showWeek(); drawBarChart(); }
  if (viewName === 'history') renderHistory();
  if (viewName === 'analyse') renderAnalyse();
}

/* ============================== Header ============================== */
function updateHeaderWeek() {
  const today = new Date();
  const monday = startOfWeek(today);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  headerWeekDisplay.innerHTML =
    `Kalenderwoche <span>${formatDateShort(monday)} – ${formatDateShort(sunday)}</span>`;
}

/* ============================== Dashboard: Week View ============================== */
function showWeek() {
  const today = new Date();
  const todayStr = ymd(today);
  const monday = startOfWeek(today);
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = ymd(d);
    const dayName = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][i];
    const dayEntries = entries.filter(e => e.date === ds);
    const hard = dayEntries.filter(e => e.type === 'hard').reduce((s, e) => s + e.minutes, 0);
    const mod = dayEntries.filter(e => e.type === 'moderate').reduce((s, e) => s + e.minutes, 0);
    const isToday = ds === todayStr;
    html += `<div class="day-card${isToday ? ' today' : ''}">
      <div class="day-card-name">${dayName}</div>
      <div class="day-card-date">${formatDateShort(d)}</div>
      <div class="day-card-value">
        ${hard > 0 ? `<div class="hard-val">${hard} min</div>` : `<div class="zero">–</div>`}
        ${mod > 0 ? `<div class="mod-val">${mod} min</div>` : (hard > 0 ? '' : '')}
      </div>
    </div>`;
  }
  weekViewEl.innerHTML = html;

  // Progress
  const weekHard = entries.filter(e => isInSameWeek(e.date, today) && e.type === 'hard').reduce((s, e) => s + e.minutes, 0);
  const weekMod = entries.filter(e => isInSameWeek(e.date, today) && e.type === 'moderate').reduce((s, e) => s + e.minutes, 0);
  const totalEq = weekMod + weekHard * 2;
  const percent = (totalEq / 150) * 100;
  const capped = Math.max(0, Math.min(percent, 100));
  const goalReached = percent >= 100;
  weekProgressEl.innerHTML = `
    <div class="progress-header">
      <div class="progress-percent ${goalReached ? 'goal-reached' : ''}">${Math.round(percent)}%</div>
      <div class="progress-label">von 150 Äquivalent-Minuten</div>
    </div>
    <div class="progress-track">
      <div class="progress-fill ${goalReached ? 'goal' : ''}" style="width:${capped}%"></div>
    </div>
    <div class="progress-detail">${totalEq} eq-min (${weekMod} moderat + ${weekHard} intensiv × 2)</div>`;
}

/* ============================== Dashboard: 15-Week Bar Chart ============================== */
function drawBarChart() {
  if (!barChartEl) return;
  const canvas = barChartEl;
  const ctx = canvas.getContext('2d');
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const today = new Date();
  const weeksData = [];
  for (let w = 14; w >= 0; w--) {
    const ref = new Date(today);
    ref.setDate(ref.getDate() - 7 * w);
    const monday = startOfWeek(ref);
    const hard = entries.filter(e => isInSameWeek(e.date, ref) && e.type === 'hard').reduce((s, e) => s + e.minutes, 0);
    const mod = entries.filter(e => isInSameWeek(e.date, ref) && e.type === 'moderate').reduce((s, e) => s + e.minutes, 0);
    weeksData.push({ monday, eq: mod + hard * 2 });
  }

  const style = getComputedStyle(document.documentElement);
  const textColor = style.getPropertyValue('--on-surface-variant').trim() || '#A0A0A0';
  const gridColor = style.getPropertyValue('--outline-variant').trim() || 'rgba(255,255,255,0.08)';
  const barGoal = style.getPropertyValue('--primary').trim() || '#A2FE00';
  const barBelow = style.getPropertyValue('--warning').trim() || '#FFB347';

  const padding = { left: 44, right: 16, top: 24, bottom: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxEq = Math.max(...weeksData.map(w => w.eq), 150);
  const yScale = chartHeight / maxEq;
  const barWidth = Math.max(8, chartWidth / weeksData.length - 12);
  const barSpacing = chartWidth / weeksData.length;

  ctx.clearRect(0, 0, width, height);

  // Grid
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'right';
  for (let i = 0; i <= maxEq; i += 50) {
    const y = padding.top + chartHeight - (i * yScale);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(i.toString(), padding.left - 6, y + 3);
  }

  // Compute goal Y position (used after bars)
  const goalY = padding.top + chartHeight - (150 * yScale);
  const goalLineColor = style.getPropertyValue('--error').trim() || '#FF5252';

  // Bars
  weeksData.forEach((week, i) => {
    const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
    const barHeight = week.eq * yScale;
    const y = padding.top + chartHeight - barHeight;
    const radius = Math.min(4, barWidth / 2);
    ctx.fillStyle = week.eq >= 150 ? barGoal : barBelow;
    // Rounded top
    ctx.beginPath();
    ctx.moveTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
    ctx.lineTo(x + barWidth, padding.top + chartHeight);
    ctx.lineTo(x, padding.top + chartHeight);
    ctx.closePath();
    ctx.fill();

    // X label
    ctx.save();
    ctx.translate(x + barWidth / 2, height - padding.bottom + 12);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = textColor;
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(week.monday.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }), 0, 0);
    ctx.restore();

    // Value
    if (barHeight > 14) {
      ctx.fillStyle = textColor;
      ctx.font = '9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(week.eq.toString(), x + barWidth / 2, y - 4);
    }
  });

  // Goal line – drawn AFTER bars so it appears on top
  ctx.strokeStyle = goalLineColor;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(padding.left, goalY);
  ctx.lineTo(width - padding.right, goalY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Goal label
  ctx.fillStyle = goalLineColor;
  ctx.font = 'bold 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Ziel: 150', width - padding.right, goalY - 4);
}

/* ============================== History View ============================== */
let historyEditingIdx = null;

function getFilteredEntries() {
  const fromVal = document.getElementById('historyDateFrom').value;
  const toVal = document.getElementById('historyDateTo').value;
  const sortBy = document.getElementById('historySortBy').value;
  let filtered = entries.slice();

  if (fromVal) filtered = filtered.filter(e => e.date >= fromVal);
  if (toVal) filtered = filtered.filter(e => e.date <= toVal);

  filtered.sort((a, b) => {
    if (sortBy === 'date-desc') return a.date < b.date ? 1 : -1;
    if (sortBy === 'date-asc') return a.date > b.date ? 1 : -1;
    if (sortBy === 'minutes-desc') return b.minutes - a.minutes;
    if (sortBy === 'minutes-asc') return a.minutes - b.minutes;
    return 0;
  });
  return filtered;
}

function renderHistory() {
  if (!historyTableWrap) return;
  if (!entries.length) {
    historyTableWrap.innerHTML = `<div class="history-empty">
      <div class="history-empty-icon">📋</div>
      <div>Noch keine Einträge vorhanden.</div>
    </div>`;
    return;
  }
  const filtered = getFilteredEntries();
  let html = `<table class="history-table"><thead><tr>
    <th>Datum</th><th>Typ</th><th>Dauer</th><th style="width:100px">Aktionen</th>
  </tr></thead><tbody>`;

  filtered.forEach((entry) => {
    const realIdx = entries.indexOf(entry);
    const isEditing = historyEditingIdx === realIdx;
    if (isEditing) {
      html += `<tr class="editing" data-idx="${realIdx}">
        <td><input type="date" class="edit-input" id="edit-date" value="${entry.date}" /></td>
        <td><select class="edit-select" id="edit-type">
          <option value="moderate" ${entry.type === 'moderate' ? 'selected' : ''}>Moderat</option>
          <option value="hard" ${entry.type === 'hard' ? 'selected' : ''}>Intensiv</option>
        </select></td>
        <td><input type="number" class="edit-input" id="edit-minutes" value="${entry.minutes}" min="1" style="width:80px" /></td>
        <td>
          <button class="action-btn save" title="Speichern" onclick="historySave(${realIdx})">✓</button>
          <button class="action-btn cancel" title="Abbrechen" onclick="historyCancel()">✕</button>
        </td>
      </tr>`;
    } else {
      const d = parseDate(entry.date);
      html += `<tr data-idx="${realIdx}">
        <td>${formatDateFull(d)}</td>
        <td><span class="type-tag ${entry.type === 'hard' ? 'hard' : 'mod'}">${entry.type === 'hard' ? 'Intensiv' : 'Moderat'}</span></td>
        <td>${entry.minutes} min</td>
        <td><div class="action-btns-row"><button class="action-btn" title="Bearbeiten" onclick="historyEdit(${realIdx})">✏️</button><button class="action-btn delete" title="Löschen" onclick="historyDelete(${realIdx})">🗑️</button></div></td>
      </tr>`;
    }
  });
  html += '</tbody></table>';
  historyTableWrap.innerHTML = html;
}

window.historyEdit = function(idx) {
  historyEditingIdx = idx;
  renderHistory();
};
window.historyCancel = function() {
  historyEditingIdx = null;
  renderHistory();
};
window.historySave = function(idx) {
  const dateVal = document.getElementById('edit-date').value;
  const typeVal = document.getElementById('edit-type').value;
  const minVal = Number(document.getElementById('edit-minutes').value);
  if (!dateVal || minVal <= 0) return;
  entries[idx] = { date: dateVal, type: typeVal, minutes: minVal };
  historyEditingIdx = null;
  sanitizeEntries();
  saveEntries();
  renderHistory();
};
window.historyDelete = function(idx) {
  showConfirm('Eintrag wirklich löschen?', () => {
    entries.splice(idx, 1);
    sanitizeEntries();
    saveEntries();
    historyEditingIdx = null;
    renderHistory();
  });
};

function historyAddNew() {
  if (!currentFilePath) { alert('Bitte zuerst eine Datei wählen.'); return; }
  const today = ymd(new Date());
  entries.unshift({ date: today, type: 'moderate', minutes: 30 });
  historyEditingIdx = 0;
  sanitizeEntries();
  saveEntries();
  renderHistory();
}

/* Confirm dialog */
function showConfirm(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `<div class="confirm-dialog">
    <p>${message}</p>
    <div class="confirm-actions">
      <button class="btn-secondary" id="confirmNo">Abbrechen</button>
      <button class="btn-danger" id="confirmYes">Löschen</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#confirmYes').addEventListener('click', () => { overlay.remove(); onConfirm(); });
  overlay.querySelector('#confirmNo').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

/* ============================== Analyse View ============================== */
const WEEKLY_GOAL = 150;

function renderAnalyse() {
  const data = buildAnalyseData();
  renderAnalyseStats(data);
  renderAnalyseInsights(data);
  renderMonthlyTimeline(data);
  drawWeeklyTrendChart(data);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date, style = 'long') {
  return date.toLocaleDateString('de-DE', { month: style, year: 'numeric' });
}

function formatWeekRange(weekStart) {
  return `${formatDateShort(weekStart)} – ${formatDateShort(addDays(weekStart, 6))}`;
}

function formatDelta(value) {
  if (value === null || value === undefined) return '–';
  if (value > 0) return `+${value}`;
  return String(value);
}

function getWeekNumber(date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

function getAnalysePeriod() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const selected = analyseRangeEl ? analyseRangeEl.value : '6m';
  let start;
  let label;

  if (selected === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    label = 'dieses Jahr';
  } else if (selected === 'all') {
    const firstEntry = entries.length
      ? entries.reduce((first, entry) => entry.date < first.date ? entry : first, entries[0])
      : null;
    const firstDate = firstEntry ? parseDate(firstEntry.date) : now;
    start = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    label = 'alle Daten';
  } else {
    const months = selected === '3m' ? 3 : selected === '12m' ? 12 : 6;
    start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    label = `letzte ${months} Monate`;
  }
  start.setHours(0, 0, 0, 0);

  return {
    start,
    end: now,
    endMarker: addDays(startOfWeek(now), 3),
    label
  };
}

function createWeekBuckets() {
  const buckets = {};
  entries.forEach(entry => {
    const weekStart = startOfWeek(parseDate(entry.date));
    const key = ymd(weekStart);
    if (!buckets[key]) buckets[key] = { moderate: 0, hard: 0 };
    if (entry.type === 'hard') buckets[key].hard += entry.minutes;
    else buckets[key].moderate += entry.minutes;
  });
  return buckets;
}

function summarizeMonth(month) {
  const completeWeeks = month.weeks.filter(week => week.isComplete);
  const hitCount = completeWeeks.filter(week => week.eq >= WEEKLY_GOAL).length;
  const totalEq = month.weeks.reduce((sum, week) => sum + week.eq, 0);
  const avgEq = completeWeeks.length
    ? Math.round(completeWeeks.reduce((sum, week) => sum + week.eq, 0) / completeWeeks.length)
    : 0;

  return {
    ...month,
    completeWeeks,
    completeCount: completeWeeks.length,
    hitCount,
    totalEq,
    avgEq,
    hasEntries: month.weeks.some(week => week.eq > 0)
  };
}

function buildAnalyseData() {
  const period = getAnalysePeriod();
  const buckets = createWeekBuckets();
  const currentWeekStart = startOfWeek(new Date());
  const weeks = [];
  const monthsByKey = new Map();

  for (let cursor = startOfWeek(period.start); cursor <= currentWeekStart; cursor = addDays(cursor, 7)) {
    const monthAnchor = addDays(cursor, 3);
    if (monthAnchor < period.start || monthAnchor > period.endMarker) continue;

    const key = ymd(cursor);
    const bucket = buckets[key] || { moderate: 0, hard: 0 };
    const eq = bucket.moderate + bucket.hard * 2;
    const week = {
      key,
      start: new Date(cursor),
      end: addDays(cursor, 6),
      weekNumber: getWeekNumber(cursor),
      monthKey: monthKey(monthAnchor),
      monthLabel: monthLabel(monthAnchor),
      monthShortLabel: monthLabel(monthAnchor, 'short'),
      moderate: bucket.moderate,
      hard: bucket.hard,
      eq,
      delta: null,
      isComplete: cursor.getTime() < currentWeekStart.getTime(),
      isCurrent: cursor.getTime() === currentWeekStart.getTime()
    };
    weeks.push(week);

    if (!monthsByKey.has(week.monthKey)) {
      monthsByKey.set(week.monthKey, {
        key: week.monthKey,
        label: week.monthLabel,
        shortLabel: week.monthShortLabel,
        weeks: []
      });
    }
    monthsByKey.get(week.monthKey).weeks.push(week);
  }

  weeks.forEach((week, index) => {
    week.delta = index > 0 ? week.eq - weeks[index - 1].eq : null;
  });

  const months = Array.from(monthsByKey.values()).map(summarizeMonth);
  months.forEach((month, index) => {
    const previous = months[index - 1];
    month.deltaAvg = previous && previous.completeCount && month.completeCount
      ? month.avgEq - previous.avgEq
      : null;
  });

  const completeWeeks = weeks.filter(week => week.isComplete);
  const weeksForStats = completeWeeks.length ? completeWeeks : weeks;
  const hitWeeks = completeWeeks.filter(week => week.eq >= WEEKLY_GOAL);
  const avgWeekly = weeksForStats.length
    ? Math.round(weeksForStats.reduce((sum, week) => sum + week.eq, 0) / weeksForStats.length)
    : 0;
  const bestWeek = completeWeeks.reduce((best, week) => !best || week.eq > best.eq ? week : best, null);
  const worstWeek = completeWeeks.reduce((worst, week) => !worst || week.eq < worst.eq ? week : worst, null);
  const varianceBase = completeWeeks.length ? completeWeeks : weeks;
  const mean = varianceBase.length ? varianceBase.reduce((sum, week) => sum + week.eq, 0) / varianceBase.length : 0;
  const stdDev = varianceBase.length
    ? Math.sqrt(varianceBase.reduce((sum, week) => sum + Math.pow(week.eq - mean, 2), 0) / varianceBase.length)
    : 0;
  const consistencyPercent = mean > 0 ? Math.round((stdDev / mean) * 100) : 0;
  const consistencyLabel = !varianceBase.length || mean === 0
    ? '–'
    : consistencyPercent <= 25 ? 'stabil'
      : consistencyPercent <= 50 ? 'wechselhaft'
        : 'stark schwankend';
  let currentStreak = 0;
  for (let i = completeWeeks.length - 1; i >= 0; i--) {
    if (completeWeeks[i].eq >= WEEKLY_GOAL) currentStreak += 1;
    else break;
  }
  const latestMonth = [...months].reverse().find(month => month.completeCount > 0);
  const previousMonth = latestMonth
    ? months.slice(0, months.indexOf(latestMonth)).reverse().find(month => month.completeCount > 0)
    : null;
  const monthTrend = latestMonth && previousMonth
    ? {
        value: latestMonth.avgEq - previousMonth.avgEq,
        latest: latestMonth,
        previous: previousMonth
      }
    : null;

  return {
    period,
    weeks,
    months,
    completeWeeks,
    avgWeekly,
    hitWeeks,
    goalRate: completeWeeks.length ? Math.round((hitWeeks.length / completeWeeks.length) * 100) : null,
    bestWeek,
    worstWeek,
    consistencyPercent,
    consistencyLabel,
    currentStreak,
    monthTrend,
    hasEntriesInPeriod: weeks.some(week => week.eq > 0)
  };
}

function renderAnalyseStats(data) {
  if (!analyseStatsEl) return;
  const trend = data.monthTrend;
  const trendClass = trend && trend.value > 0 ? 'trend-up' : trend && trend.value < 0 ? 'trend-down' : 'trend-flat';
  const trendValue = trend ? `${formatDelta(trend.value)} eq` : '–';
  const trendSub = trend
    ? `${trend.latest.shortLabel} vs. ${trend.previous.shortLabel}`
    : 'noch kein Vormonat';
  const goalRateValue = data.goalRate === null ? '–' : `${data.goalRate}%`;
  const goalRateSub = data.completeWeeks.length
    ? `${data.hitWeeks.length} von ${data.completeWeeks.length} abgeschlossenen Wochen`
    : 'aktuelle Woche noch offen';

  analyseStatsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-label">Ø pro Woche</div>
      <div class="stat-card-value">${data.avgWeekly}</div>
      <div class="stat-card-sub">${data.period.label}, eq-min</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Zielquote</div>
      <div class="stat-card-value">${goalRateValue}</div>
      <div class="stat-card-sub">${goalRateSub}</div>
    </div>
    <div class="stat-card ${trendClass}">
      <div class="stat-card-label">Monatstrend</div>
      <div class="stat-card-value">${trendValue}</div>
      <div class="stat-card-sub">${trendSub}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Konsistenz</div>
      <div class="stat-card-value">${data.consistencyLabel}</div>
      <div class="stat-card-sub">${data.consistencyPercent ? `${data.consistencyPercent}% Schwankung` : 'mehr Daten nötig'}</div>
    </div>`;
}

function renderAnalyseInsights(data) {
  if (!analyseInsightsEl) return;
  const trendValue = data.monthTrend ? data.monthTrend.value : 0;
  const trendLabel = !data.monthTrend
    ? 'Noch kein belastbarer Monatstrend.'
    : trendValue >= 15 ? 'Deine Wochen werden im Monatsvergleich stärker.'
      : trendValue <= -15 ? 'Deine Wochen fallen im Monatsvergleich ab.'
        : 'Deine Wochen sind im Monatsvergleich stabil.';
  const bestWeek = data.bestWeek
    ? `KW ${data.bestWeek.weekNumber}: ${data.bestWeek.eq} eq-min (${formatWeekRange(data.bestWeek.start)})`
    : 'Noch keine abgeschlossene Woche';
  const worstWeek = data.worstWeek
    ? `KW ${data.worstWeek.weekNumber}: ${data.worstWeek.eq} eq-min (${formatWeekRange(data.worstWeek.start)})`
    : 'Noch keine abgeschlossene Woche';
  const mostConsistentMonth = data.months
    .filter(month => month.completeWeeks.length >= 2)
    .map(month => {
      const mean = month.completeWeeks.reduce((sum, week) => sum + week.eq, 0) / month.completeWeeks.length;
      const stdDev = Math.sqrt(month.completeWeeks.reduce((sum, week) => sum + Math.pow(week.eq - mean, 2), 0) / month.completeWeeks.length);
      return { month, score: mean > 0 ? stdDev / mean : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.score - b.score)[0];

  analyseInsightsEl.innerHTML = `
    <div class="card-title">Einordnung</div>
    <div class="insight-hero">${trendLabel}</div>
    <div class="insight-list">
      <div class="insight-item">
        <span>Beste Woche</span>
        <strong>${bestWeek}</strong>
      </div>
      <div class="insight-item">
        <span>Schwächste Woche</span>
        <strong>${worstWeek}</strong>
      </div>
      <div class="insight-item">
        <span>Aktuelle Zielserie</span>
        <strong>${data.currentStreak} Woche${data.currentStreak === 1 ? '' : 'n'}</strong>
      </div>
      <div class="insight-item">
        <span>Konsequentester Monat</span>
        <strong>${mostConsistentMonth ? mostConsistentMonth.month.shortLabel : 'mehr Daten nötig'}</strong>
      </div>
    </div>`;
}

function renderMonthlyTimeline(data) {
  if (!monthlyTimelineEl) return;
  if (!data.hasEntriesInPeriod) {
    monthlyTimelineEl.innerHTML = `<div class="analyse-empty">
      <div class="history-empty-icon">📈</div>
      <div>Für diesen Zeitraum gibt es noch keine Einträge.</div>
      <div class="analyse-empty-sub">Sobald du Trainingsminuten erfasst, erscheinen hier Wochenverlauf, Zielquote und Monatsvergleich.</div>
    </div>`;
    return;
  }

  monthlyTimelineEl.innerHTML = [...data.months].reverse().map(month => {
    const monthDelta = month.deltaAvg === null
      ? '–'
      : `${formatDelta(month.deltaAvg)} eq Ø`;
    const deltaClass = month.deltaAvg > 0 ? 'positive' : month.deltaAvg < 0 ? 'negative' : 'neutral';
    const completeLabel = month.completeCount
      ? `${month.hitCount} von ${month.completeCount} Wochen im Ziel`
      : 'laufender Monat';

    const weeksHtml = month.weeks.map(week => {
      const status = week.eq >= WEEKLY_GOAL ? 'goal' : week.eq > 0 ? 'below' : 'empty';
      const deltaClass = week.delta > 0 ? 'positive' : week.delta < 0 ? 'negative' : 'neutral';
      const width = week.eq > 0 ? Math.max(6, Math.min((week.eq / WEEKLY_GOAL) * 100, 100)) : 0;
      return `<div class="month-week-row ${week.isCurrent ? 'current' : ''}">
        <div class="month-week-label">
          <strong>KW ${week.weekNumber}</strong>
          <span>${formatWeekRange(week.start)}${week.isCurrent ? ' · läuft' : ''}</span>
        </div>
        <div class="month-week-bar" aria-label="KW ${week.weekNumber}: ${week.eq} Äquivalent-Minuten">
          <div class="month-week-fill ${status}" style="width:${width}%"></div>
        </div>
        <div class="month-week-value">${week.eq}</div>
        <div class="month-week-delta ${deltaClass}">${formatDelta(week.delta)}</div>
      </div>`;
    }).join('');

    return `<section class="month-card">
      <div class="month-card-header">
        <div>
          <div class="month-card-title">${month.label}</div>
          <div class="month-card-sub">${completeLabel}</div>
        </div>
        <div class="month-card-metrics">
          <div><span>Ø</span><strong>${month.avgEq}</strong></div>
          <div class="${deltaClass}"><span>vs. Vormonat</span><strong>${monthDelta}</strong></div>
        </div>
      </div>
      <div class="month-week-list">${weeksHtml}</div>
    </section>`;
  }).join('');
}

function drawWeeklyTrendChart(data = buildAnalyseData()) {
  if (!weeklyTrendChartEl) return;
  const canvas = weeklyTrendChartEl;
  const ctx = canvas.getContext('2d');
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(dpr, dpr);
  const width = rect.width;
  const height = rect.height;
  const weeks = data.weeks;
  if (!weeks.length) return;

  const style = getComputedStyle(document.documentElement);
  const textColor = style.getPropertyValue('--on-surface-variant').trim() || '#A0A0A0';
  const lineColor = style.getPropertyValue('--primary').trim() || '#A2FE00';
  const gridColor = style.getPropertyValue('--outline-variant').trim() || 'rgba(255,255,255,0.08)';
  const warningColor = style.getPropertyValue('--warning').trim() || '#FFB347';
  const goalColor = style.getPropertyValue('--error').trim() || '#FF5252';

  const pad = { left: 44, right: 18, top: 24, bottom: 42 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;
  const rawMax = Math.max(...weeks.map(week => week.eq), WEEKLY_GOAL);
  const maxVal = Math.max(WEEKLY_GOAL, Math.ceil(rawMax / 50) * 50);
  const yScale = ch / maxVal;

  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'right';
  const step = maxVal > 500 ? 200 : maxVal > 200 ? 100 : 50;
  for (let v = 0; v <= maxVal; v += step) {
    const y = pad.top + ch - v * yScale;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
    ctx.fillText(v.toString(), pad.left - 5, y + 3);
  }

  const goalY = pad.top + ch - WEEKLY_GOAL * yScale;
  ctx.strokeStyle = goalColor;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(pad.left, goalY);
  ctx.lineTo(width - pad.right, goalY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = goalColor;
  ctx.font = 'bold 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Ziel 150', width - pad.right, goalY - 5);

  const denominator = Math.max(weeks.length - 1, 1);
  const points = weeks.map((week, i) => ({
    x: pad.left + (i / denominator) * cw,
    y: pad.top + ch - week.eq * yScale,
    week
  }));

  points.forEach((point, index) => {
    if (index === 0 || point.week.monthKey !== points[index - 1].week.monthKey) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(point.x, pad.top);
      ctx.lineTo(point.x, pad.top + ch);
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(point.week.monthShortLabel, Math.min(point.x + 4, width - pad.right - 40), height - 14);
    }
  });

  ctx.beginPath();
  ctx.moveTo(points[0].x, pad.top + ch);
  points.forEach(point => ctx.lineTo(point.x, point.y));
  ctx.lineTo(points[points.length - 1].x, pad.top + ch);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
  grad.addColorStop(0, lineColor.replace(')', ', 0.25)').replace('rgb', 'rgba'));
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  points.forEach(point => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.week.isCurrent ? 4 : 3, 0, Math.PI * 2);
    ctx.fillStyle = point.week.eq >= WEEKLY_GOAL ? lineColor : warningColor;
    ctx.fill();
  });
}

/* ============================== Refresh ============================== */
window.refresh = function refresh() {
  sanitizeEntries();
  updateHeaderWeek();
  if (currentView === 'dashboard') { showWeek(); drawBarChart(); }
  if (currentView === 'history') renderHistory();
  if (currentView === 'analyse') renderAnalyse();
}

/* ============================== Daily Auto-Refresh ============================== */
let dailyRefreshTimer = null;
function scheduleDailyRefresh() {
  if (dailyRefreshTimer) clearTimeout(dailyRefreshTimer);
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(0, 0, 5, 0);
  dailyRefreshTimer = setTimeout(() => {
    try { refresh(); } catch (e) { console.warn('Geplanter Refresh fehlgeschlagen', e); }
    scheduleDailyRefresh();
  }, Math.max(1000, next.getTime() - now.getTime()));
}

/* ============================== File Handling (IPC) ============================== */
async function initApp() {
  try {
    const res = await window.fitnessAPI.init();
    if (res.darkMode === false) {
      darkMode = false;
      document.body.classList.add('light');
    } else {
      darkMode = true;
      document.body.classList.remove('light');
    }
    updateThemeToggleIcon();
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

function updateFileStatus(hasFile, restored) {
  if (!hasFile || !currentFilePath) {
    fileStatusEl.textContent = 'Keine Datei gewählt.';
  } else {
    const name = currentFilePath.split(/\\|\//).pop();
    fileStatusEl.textContent = `${name}${restored ? ' (wiederhergestellt)' : ''}`;
  }
}

async function chooseFile() {
  const res = await window.fitnessAPI.chooseFile();
  if (res.filePath) {
    currentFilePath = res.filePath;
    entries = res.entries || [];
    updateFileStatus(true, false);
    refresh();
  }
}

async function createNewFile() {
  const res = await window.fitnessAPI.createFile();
  if (res.filePath) {
    currentFilePath = res.filePath;
    entries = [];
    updateFileStatus(true, false);
    refresh();
  }
}

async function saveEntries() {
  await window.fitnessAPI.saveEntries(entries);
}

/* ============================== Entry Adding ============================== */
function addEntry(type, minutes) {
  if (!currentFilePath) { alert('Bitte zuerst eine Datei wählen.'); return; }
  if (!minutes || minutes <= 0 || !['hard', 'moderate'].includes(type)) return;
  entries.push({ date: ymd(new Date()), type, minutes: Number(minutes) });
  sanitizeEntries();
  saveEntries();
  refresh();
}

function setupQuickButtons() {
  const container = document.getElementById('quickButtons');
  if (!container) return;
  container.innerHTML = '';
  // 5 to 60 in steps of 5
  const allMinutes = [];
  for (let m = 5; m <= 60; m += 5) allMinutes.push(m);
  const row1 = allMinutes.slice(0, 6);  // 5..30
  const row2 = allMinutes.slice(6);     // 35..60

  const row = document.createElement('div');
  row.className = 'input-cards-row';

  [{ type: 'moderate', label: 'Moderat', cls: 'mod' },
   { type: 'hard', label: 'Intensiv', cls: 'hard' }].forEach(({ type, label, cls }) => {
    const card = document.createElement('div');
    card.className = 'input-card';

    // Custom input row with label at the top
    const customRow = document.createElement('div');
    customRow.className = 'input-card-custom';
    const lbl = document.createElement('span');
    lbl.className = 'input-card-custom-label ' + cls;
    lbl.textContent = label;
    customRow.appendChild(lbl);
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'custom-input';
    inp.id = `custom-${type}`;
    inp.placeholder = 'Minuten';
    inp.min = '1';
    customRow.appendChild(inp);
    const addBtn = document.createElement('button');
    addBtn.className = 'add-icon-btn';
    addBtn.innerHTML = '+';
    addBtn.title = `Eigene Minuten ${label} hinzufügen`;
    addBtn.addEventListener('click', () => {
      const v = Number(document.getElementById(`custom-${type}`).value);
      addEntry(type, v);
      document.getElementById(`custom-${type}`).value = '';
    });
    customRow.appendChild(addBtn);
    card.appendChild(customRow);

    // Two rows of quick buttons
    [row1, row2].forEach(mins => {
      const btnRow = document.createElement('div');
      btnRow.className = 'quick-buttons-row';
      mins.forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'quick-btn';
        btn.textContent = m;
        btn.title = `${m} Minuten ${label}`;
        btn.addEventListener('click', () => addEntry(type, m));
        btnRow.appendChild(btn);
      });
      card.appendChild(btnRow);
    });

    row.appendChild(card);
  });

  container.appendChild(row);
}

/* ============================== Theme ============================== */
window.updateThemeToggleIcon = function updateThemeToggleIcon() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.textContent = darkMode ? '☀️' : '🌙';
  btn.setAttribute('aria-label', darkMode ? 'Zu hellem Modus wechseln' : 'Zu dunklem Modus wechseln');
}
function toggleTheme() {
  darkMode = !darkMode;
  document.body.classList.toggle('light', !darkMode);
  updateThemeToggleIcon();
  refresh();
  window.fitnessAPI.setDarkMode(darkMode);
}

/* ============================== Event Wiring ============================== */
window.addEventListener('DOMContentLoaded', () => {
  setupQuickButtons();
  document.getElementById('chooseFileBtn').addEventListener('click', chooseFile);
  document.getElementById('createFileBtn').addEventListener('click', createNewFile);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('addEntryBtn').addEventListener('click', historyAddNew);
  document.getElementById('historyDateFrom').addEventListener('change', renderHistory);
  document.getElementById('historyDateTo').addEventListener('change', renderHistory);
  document.getElementById('historyResetFilter').addEventListener('click', () => {
    document.getElementById('historyDateFrom').value = '';
    document.getElementById('historyDateTo').value = '';
    renderHistory();
  });
  document.getElementById('historySortBy').addEventListener('change', renderHistory);
  if (analyseRangeEl) analyseRangeEl.addEventListener('change', renderAnalyse);

  // Nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  updateThemeToggleIcon();
  updateHeaderWeek();
  initApp();
  scheduleDailyRefresh();
  window.addEventListener('focus', refresh);
  window.addEventListener('resize', () => {
    if (currentView === 'dashboard') drawBarChart();
    if (currentView === 'analyse') drawWeeklyTrendChart();
  });
});
