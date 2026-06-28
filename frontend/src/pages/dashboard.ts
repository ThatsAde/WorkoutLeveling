import { getSummary, getVolume, getFrequency, getCalendar, getProgression } from '../api/stats.js';
import { listExercises } from '../api/exercises.js';
import type { StatSummary, StatVolume, StatFrequency, StatCalendar, Exercise } from '../types/index.js';
import { toastError } from '../components/toast.js';
import { clearChildren } from '../utils/dom.js';
import { daysAgoISO, todayISO } from '../utils/date.js';

// Chart.js loaded via CDN
declare const Chart: any;

let container: HTMLElement;
let charts: any[] = [];

export async function mount(root: HTMLElement): Promise<void> {
  container = root;
  container.innerHTML = `
    <div class="page-header">
      <h1><span class="glow-text">HUNTER STATUS</span></h1>
    </div>

    <div id="summary-cards" class="summary-grid"></div>

    <div class="dashboard-grid">
      <div class="card card--system dashboard-card">
        <h3 class="system-text">VOLUME SETTIMANALE</h3>
        <canvas id="chart-volume"></canvas>
      </div>
      <div class="card card--system dashboard-card">
        <h3 class="system-text">MUSCOLI COLPITI</h3>
        <div id="heatmap-muscles" class="muscle-heatmap"></div>
      </div>
      <div class="card card--system dashboard-card">
        <h3 class="system-text">CALENDARIO</h3>
        <div id="calendar-grid" class="calendar-grid"></div>
      </div>
      <div class="card card--system dashboard-card">
        <h3 class="system-text">PROGRESSIONE</h3>
        <div class="form-group" style="margin-bottom:var(--space-sm)">
          <select class="form-select" id="progression-exercise"><option value="">Seleziona esercizio</option></select>
          <select class="form-select" id="progression-metric">
            <option value="max_weight">Peso Max</option>
            <option value="max_reps">Reps Max</option>
            <option value="volume">Volume</option>
          </select>
        </div>
        <canvas id="chart-progression"></canvas>
      </div>
    </div>
  `;

  await loadDashboard();
}

export function unmount(): void {
  charts.forEach(c => c.destroy());
  charts = [];
}

async function loadDashboard(): Promise<void> {
  try {
    const [summaryRes, volumeRes, frequencyRes, calendarRes, exercisesRes] = await Promise.all([
      getSummary({ days: 30 }),
      getVolume({ group_by: 'week', from: daysAgoISO(90), to: todayISO() }),
      getFrequency({ from: daysAgoISO(90), to: todayISO() }),
      getCalendar({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }),
      listExercises({ limit: 200 }),
    ]);

    renderSummary(summaryRes.data);
    renderVolumeChart(volumeRes.data);
    renderMuscleHeatmap(frequencyRes.data);
    renderCalendar(calendarRes.data);
    populateProgressionSelect(exercisesRes.data);
  } catch (e) {
    toastError('Errore nel caricamento della dashboard');
  }
}

function renderSummary(summary: StatSummary): void {
  const el = container.querySelector<HTMLElement>('#summary-cards')!;
  el.innerHTML = `
    <div class="stat-card stat-card--glow">
      <span class="stat-card__value stat-card__value--xl">${summary.current_streak}</span>
      <span class="stat-card__label">Streak (giorni)</span>
      <div class="stat-card__icon">&#9670;</div>
    </div>
    <div class="stat-card stat-card--glow">
      <span class="stat-card__value stat-card__value--xl">${summary.sessions}</span>
      <span class="stat-card__label">Sessioni (30gg)</span>
      <div class="stat-card__icon">&#9650;</div>
    </div>
    <div class="stat-card stat-card--glow">
      <span class="stat-card__value stat-card__value--xl">${summary.total_sets}</span>
      <span class="stat-card__label">Set totali</span>
      <div class="stat-card__icon">&#9636;</div>
    </div>
    <div class="stat-card stat-card--glow">
      <span class="stat-card__value stat-card__value--xl">${summary.top_exercises.length > 0 ? summary.top_exercises[0].name : '—'}</span>
      <span class="stat-card__label">Esercizio top</span>
      <div class="stat-card__icon">&#9733;</div>
    </div>
  `;
}

function renderVolumeChart(data: StatVolume[]): void {
  const canvas = container.querySelector<HTMLCanvasElement>('#chart-volume');
  if (!canvas || typeof Chart === 'undefined') return;

  const periods = [...new Set(data.map(d => d.period))].sort();
  const exercises = [...new Set(data.map(d => d.exercise_name))];

  const colors = [
    '#00d4ff', '#7b2ff7', '#00ff88', '#ff4444', '#ffaa00',
    '#ff00ff', '#44aaff', '#88ff00', '#ff6644', '#aa44ff',
  ];

  const datasets = exercises.map((name, i) => ({
    label: name,
    data: periods.map(p => {
      const match = data.find(d => d.period === p && d.exercise_name === name);
      return match ? match.volume || match.total_reps : 0;
    }),
    backgroundColor: colors[i % colors.length] + '88',
    borderColor: colors[i % colors.length],
    borderWidth: 1,
  }));

  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels: periods, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#b0c4de' } },
      },
      scales: {
        x: { stacked: true, ticks: { color: '#6a7a8a' }, grid: { color: '#1a2a3a' } },
        y: { stacked: true, ticks: { color: '#6a7a8a' }, grid: { color: '#1a2a3a' } },
      },
    },
  });
  charts.push(chart);
}

function renderMuscleHeatmap(data: StatFrequency[]): void {
  const el = container.querySelector<HTMLElement>('#heatmap-muscles')!;
  clearChildren(el);

  if (data.length === 0) {
    el.innerHTML = '<div class="empty-state system-text">Nessun dato disponibile</div>';
    return;
  }

  const maxSets = Math.max(...data.map(d => d.set_count));
  const groups = [...new Set(data.map(d => d.group_name))].sort();

  for (const group of groups) {
    const groupEl = document.createElement('div');
    groupEl.className = 'heatmap-group';

    const label = document.createElement('div');
    label.className = 'heatmap-group__label system-text';
    label.textContent = group;
    groupEl.appendChild(label);

    const cells = document.createElement('div');
    cells.className = 'heatmap-cells';

    const groupMuscles = data.filter(d => d.group_name === group);
    // Merge primary + secondary
    const merged = new Map<string, number>();
    for (const m of groupMuscles) {
      merged.set(m.muscle_name, (merged.get(m.muscle_name) ?? 0) + m.set_count);
    }

    for (const [name, count] of merged) {
      const intensity = Math.ceil((count / maxSets) * 5);
      const cell = document.createElement('div');
      cell.className = `heatmap-cell heatmap-cell--${intensity}`;
      cell.innerHTML = `<span>${name}</span><span class="heatmap-cell__count">${count}</span>`;
      cell.title = `${name}: ${count} set`;
      cells.appendChild(cell);
    }

    groupEl.appendChild(cells);
    el.appendChild(groupEl);
  }
}

function renderCalendar(data: StatCalendar[]): void {
  const el = container.querySelector<HTMLElement>('#calendar-grid')!;
  clearChildren(el);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const header = document.createElement('div');
  header.className = 'calendar-header system-text';
  header.textContent = new Date(year, month).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  el.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'calendar-days';

  // Day labels
  for (const d of ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']) {
    const lbl = document.createElement('div');
    lbl.className = 'calendar-day-label';
    lbl.textContent = d;
    grid.appendChild(lbl);
  }

  // Offset (Monday-based)
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < offset; i++) {
    grid.appendChild(document.createElement('div'));
  }

  const sessionMap = new Map(data.map(d => [d.date, d]));

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const session = sessionMap.get(dateStr);
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    if (session) {
      cell.classList.add('calendar-cell--active');
      cell.title = session.session_names;
    }
    if (d === now.getDate()) cell.classList.add('calendar-cell--today');
    cell.textContent = String(d);
    grid.appendChild(cell);
  }

  el.appendChild(grid);
}

function populateProgressionSelect(exercises: Exercise[]): void {
  const select = container.querySelector<HTMLSelectElement>('#progression-exercise')!;
  for (const ex of exercises) {
    const opt = document.createElement('option');
    opt.value = String(ex.id);
    opt.textContent = ex.name;
    select.appendChild(opt);
  }

  select.addEventListener('change', loadProgression);
  container.querySelector('#progression-metric')!.addEventListener('change', loadProgression);
}

async function loadProgression(): Promise<void> {
  const exerciseId = parseInt((container.querySelector<HTMLSelectElement>('#progression-exercise')!).value);
  const metric = (container.querySelector<HTMLSelectElement>('#progression-metric')!).value as any;

  if (!exerciseId) return;

  try {
    const res = await getProgression({ exercise_id: exerciseId, metric, from: daysAgoISO(365) });
    renderProgressionChart(res.data.data);
  } catch { toastError('Errore nel caricamento della progressione'); }
}

function renderProgressionChart(data: { date: string; value: number }[]): void {
  const canvas = container.querySelector<HTMLCanvasElement>('#chart-progression');
  if (!canvas || typeof Chart === 'undefined') return;

  // Destroy existing if any
  const existing = charts.findIndex(c => c.canvas === canvas);
  if (existing >= 0) { charts[existing].destroy(); charts.splice(existing, 1); }

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'Progressione',
        data: data.map(d => d.value),
        borderColor: '#00d4ff',
        backgroundColor: 'rgba(0, 212, 255, 0.1)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#7b2ff7',
        pointBorderColor: '#00d4ff',
        pointRadius: 4,
        pointHoverRadius: 7,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#b0c4de' } },
      },
      scales: {
        x: { ticks: { color: '#6a7a8a' }, grid: { color: '#1a2a3a' } },
        y: { ticks: { color: '#6a7a8a' }, grid: { color: '#1a2a3a' } },
      },
    },
  });
  charts.push(chart);
}
