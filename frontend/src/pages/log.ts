import { startSession, updateSession, logSet, updateSet, deleteSet, getSession } from '../api/sessions.js';
import { getWorkout } from '../api/workouts.js';
import { listExercises } from '../api/exercises.js';
import type { Session, SessionSet, Exercise, WorkoutExercise } from '../types/index.js';
import { renderAnatomyCard } from '../components/exercise-anatomy-card.js';
import { toastSuccess, toastError } from '../components/toast.js';
import { confirm } from '../components/confirm.js';
import { clearChildren } from '../utils/dom.js';
import { toLocalISOString, formatDuration } from '../utils/date.js';

let container: HTMLElement;
let currentSession: Session | null = null;
let workoutTemplate: { exercises: WorkoutExercise[] } | null = null;
let allExercises: Exercise[] = [];
let timerInterval: ReturnType<typeof setInterval> | null = null;
let sessionStart: Date | null = null;

export async function mount(root: HTMLElement): Promise<void> {
  container = root;

  // Check URL params for workout_id
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const workoutId = params.get('workout_id');

  container.innerHTML = `
    <div class="page-header">
      <h1><span class="glow-text">LOG ALLENAMENTO</span></h1>
      <div id="session-timer" class="session-timer system-text">00:00</div>
    </div>
    <div id="session-controls" class="session-controls"></div>
    <div id="session-log" class="session-log"></div>
  `;

  try {
    const res = await listExercises({ limit: 200 });
    allExercises = res.data;
  } catch {}

  if (workoutId) {
    try {
      const wRes = await getWorkout(parseInt(workoutId));
      workoutTemplate = wRes.data;
      await startNewSession(parseInt(workoutId), wRes.data.name);
    } catch { toastError('Errore nel caricamento della scheda'); }
  } else {
    renderStartControls();
  }
}

export function unmount(): void {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function renderStartControls(): void {
  const ctrl = container.querySelector<HTMLElement>('#session-controls')!;
  ctrl.innerHTML = `
    <div class="session-start-panel card card--system">
      <h2 class="system-text">INIZIA NUOVO ALLENAMENTO</h2>
      <div class="form-group">
        <label class="form-label">Nome sessione</label>
        <input class="form-input" id="session-name" type="text" placeholder="es. Push Day" />
      </div>
      <button class="btn btn--primary btn--glow btn--lg" id="btn-start-free">INIZIA SESSIONE LIBERA</button>
    </div>
  `;

  ctrl.querySelector('#btn-start-free')!.addEventListener('click', () => {
    const name = (ctrl.querySelector<HTMLInputElement>('#session-name')!).value || 'Allenamento';
    startNewSession(undefined, name);
  });
}

async function startNewSession(workoutId?: number, name?: string): Promise<void> {
  try {
    const res = await startSession({
      workout_id: workoutId,
      name: name ?? 'Allenamento',
      started_at: toLocalISOString(),
    });
    currentSession = res.data;
    sessionStart = new Date();
    startTimer();
    renderActiveSession();
  } catch { toastError('Errore nell\'avvio della sessione'); }
}

function startTimer(): void {
  const timerEl = container.querySelector<HTMLElement>('#session-timer')!;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!sessionStart) return;
    const diff = Math.floor((Date.now() - sessionStart.getTime()) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    timerEl.textContent = h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, 1000);
}

function renderActiveSession(): void {
  const ctrl = container.querySelector<HTMLElement>('#session-controls')!;
  ctrl.innerHTML = `
    <div class="session-active-controls">
      <span class="session-name system-text">${currentSession?.name ?? 'Allenamento'}</span>
      <button class="btn btn--danger btn--glow" id="btn-end-session">FINE ALLENAMENTO</button>
    </div>
  `;

  ctrl.querySelector('#btn-end-session')!.addEventListener('click', endSession);

  renderLogArea();
}

function renderLogArea(): void {
  const logEl = container.querySelector<HTMLElement>('#session-log')!;
  clearChildren(logEl);

  // Group sets by exercise
  const grouped = new Map<number, SessionSet[]>();
  if (currentSession?.sets) {
    for (const set of currentSession.sets) {
      if (!grouped.has(set.exercise_id)) grouped.set(set.exercise_id, []);
      grouped.get(set.exercise_id)!.push(set);
    }
  }

  // If workout template, show expected exercises
  if (workoutTemplate?.exercises.length) {
    for (const we of workoutTemplate.exercises) {
      const sets = grouped.get(we.exercise_id) ?? [];
      renderExerciseBlock(logEl, we.exercise_id, we.exercise_name, we.sets, we.target_reps, we.target_time_s, we.is_timed, sets);
    }
  }

  // Show logged exercises not in template
  for (const [exId, sets] of grouped) {
    if (workoutTemplate?.exercises.some(we => we.exercise_id === exId)) continue;
    const name = sets[0]?.exercise_name ?? 'Esercizio';
    const isTimed = sets[0]?.is_timed ?? false;
    renderExerciseBlock(logEl, exId, name, 0, null, null, isTimed, sets);
  }

  // Add exercise button
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn--primary btn--glow';
  addBtn.textContent = '+ Aggiungi Esercizio';
  addBtn.addEventListener('click', openAddExercisePicker);
  logEl.appendChild(addBtn);
}

function renderExerciseBlock(
  parent: HTMLElement,
  exerciseId: number,
  name: string,
  targetSets: number,
  targetReps: number | null,
  targetTimeS: number | null,
  isTimed: boolean,
  loggedSets: SessionSet[]
): void {
  const block = document.createElement('div');
  block.className = 'exercise-block card card--system';

  const target = isTimed
    ? (targetTimeS ? `${targetSets} x ${targetTimeS}s` : '')
    : (targetReps ? `${targetSets} x ${targetReps} reps` : '');

  block.innerHTML = `
    <div class="exercise-block__header">
      <strong>${name}</strong>
      ${target ? `<span class="text-muted">${target}</span>` : ''}
      <button class="btn btn--ghost btn--sm" data-show-media="${exerciseId}" title="Mostra esecuzione">MEDIA</button>
    </div>
    <div class="exercise-block__sets"></div>
    <div class="exercise-block__add-set">
      <button class="btn btn--ghost btn--sm btn--glow" data-add-set="${exerciseId}">+ Set</button>
    </div>
  `;

  block.querySelector(`[data-show-media="${exerciseId}"]`)!.addEventListener('click', async () => {
    try {
      const { getExercise } = await import('../api/exercises.js');
      const res = await getExercise(exerciseId);
      const ex = res.data;
      if (!ex.image_url && !ex.video_url) {
        toastError('Nessun media per questo esercizio');
        return;
      }
      openLogMediaLightbox(ex.image_url ?? undefined, ex.video_url ?? undefined);
    } catch { toastError('Errore nel caricamento'); }
  });

  const setsContainer = block.querySelector('.exercise-block__sets')!;

  // Render existing logged sets
  for (const set of loggedSets) {
    renderSetRow(setsContainer as HTMLElement, set, isTimed);
  }

  // Add set button
  block.querySelector(`[data-add-set="${exerciseId}"]`)!.addEventListener('click', async () => {
    const nextNum = loggedSets.length + 1;
    try {
      const res = await logSet(currentSession!.id, {
        exercise_id: exerciseId,
        set_number: nextNum,
        reps: isTimed ? undefined : (targetReps ?? undefined),
        duration_s: isTimed ? (targetTimeS ?? undefined) : undefined,
        completed: true,
      });
      loggedSets.push(res.data as unknown as SessionSet);
      renderSetRow(setsContainer as HTMLElement, res.data as unknown as SessionSet, isTimed);
      toastSuccess(`Set #${nextNum} registrato`);
    } catch { toastError('Errore nel salvataggio del set'); }
  });

  parent.appendChild(block);
}

function renderSetRow(container: HTMLElement, set: SessionSet, isTimed: boolean): void {
  const row = document.createElement('div');
  row.className = `set-row ${set.completed ? 'set-row--done' : ''}`;
  row.setAttribute('data-set-id', String(set.id));

  row.innerHTML = `
    <span class="set-row__num">#${set.set_number}</span>
    ${isTimed
      ? `<input class="form-input form-input--sm set-input" data-field="duration_s" type="number" min="0" value="${set.duration_s ?? ''}" placeholder="sec" />`
      : `<input class="form-input form-input--sm set-input" data-field="reps" type="number" min="0" value="${set.reps ?? ''}" placeholder="reps" />`
    }
    <input class="form-input form-input--sm set-input" data-field="weight" type="number" min="0" step="0.5" value="${set.weight ?? ''}" placeholder="kg" />
    <select class="form-select form-select--sm set-input" data-field="rpe">
      <option value="">RPE</option>
      ${[6,7,7.5,8,8.5,9,9.5,10].map(v => `<option value="${v}" ${set.rpe === v ? 'selected' : ''}>${v}</option>`).join('')}
    </select>
    <button class="btn btn--ghost btn--sm set-row__check ${set.completed ? 'set-row__check--done' : ''}" data-toggle-complete>✓</button>
    <button class="btn btn--ghost btn--sm text-danger" data-delete-set>✕</button>
  `;

  // Save on blur
  row.querySelectorAll('.set-input').forEach(input => {
    input.addEventListener('change', async () => {
      const field = (input as HTMLElement).dataset.field!;
      const val = (input as HTMLInputElement).value;
      try {
        await updateSet(currentSession!.id, set.id, { [field]: val || null });
      } catch { toastError('Errore nel salvataggio'); }
    });
  });

  row.querySelector('[data-toggle-complete]')!.addEventListener('click', async () => {
    set.completed = !set.completed;
    try {
      await updateSet(currentSession!.id, set.id, { completed: set.completed });
      row.classList.toggle('set-row--done', set.completed);
      row.querySelector('[data-toggle-complete]')!.classList.toggle('set-row__check--done', set.completed);
    } catch { toastError('Errore'); }
  });

  row.querySelector('[data-delete-set]')!.addEventListener('click', async () => {
    try {
      await deleteSet(currentSession!.id, set.id);
      row.remove();
    } catch { toastError('Errore nell\'eliminazione'); }
  });

  container.appendChild(row);
}

function openLogMediaLightbox(image?: string, video?: string): void {
  const overlay = document.createElement('div');
  overlay.className = 'media-lightbox';
  overlay.innerHTML = video
    ? `<video src="${video}" autoplay loop controls playsinline></video>`
    : `<img src="${image!}" alt="Esecuzione" />`;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('media-lightbox--visible'));
}

function openAddExercisePicker(): void {
  const picker = document.createElement('div');
  picker.className = 'exercise-picker-overlay';
  picker.innerHTML = `
    <div class="exercise-picker card card--system">
      <div class="exercise-picker__header">
        <input class="form-input" id="picker-search" type="search" placeholder="Cerca esercizio..." />
        <button class="btn btn--ghost btn--sm" id="picker-close">✕</button>
      </div>
      <div class="exercise-picker__body">
        <div id="picker-list" class="exercise-pick-list"></div>
        <div id="picker-anatomy" class="exercise-picker__anatomy"></div>
      </div>
    </div>
  `;

  document.body.appendChild(picker);

  const listEl    = picker.querySelector<HTMLElement>('#picker-list')!;
  const anatomyEl = picker.querySelector<HTMLElement>('#picker-anatomy')!;

  let anatomyTimer: ReturnType<typeof setTimeout>;

  const showAnatomy = (ex: Exercise) => {
    clearTimeout(anatomyTimer);
    anatomyTimer = setTimeout(() => {
      if (ex.muscles.length) {
        renderAnatomyCard(anatomyEl, ex.muscles);
      } else {
        anatomyEl.innerHTML = `<div class="anatomy-empty system-text">NO MUSCLE DATA</div>`;
      }
    }, 80);
  };

  const render = (filter = '') => {
    clearChildren(listEl);
    const filtered = allExercises.filter(e =>
      !filter || e.name.toLowerCase().includes(filter.toLowerCase())
    );
    for (const ex of filtered.slice(0, 40)) {
      const item = document.createElement('div');
      item.className = 'exercise-pick-item';
      const stars = '★'.repeat(ex.difficulty) + '☆'.repeat(5 - ex.difficulty);
      item.innerHTML = `
        <div class="exercise-pick-item__info">
          <strong>${ex.name}</strong>
          <div>
            <span class="badge badge--movement">${ex.movement_type_name}</span>
            <span class="exercise-pick-item__diff">${stars}</span>
          </div>
        </div>
        <button class="btn btn--primary btn--sm btn--glow">+</button>
      `;
      // Show anatomy on hover/focus
      item.addEventListener('mouseenter', () => showAnatomy(ex));
      item.addEventListener('focus', () => showAnatomy(ex), true);

      item.querySelector('button')!.addEventListener('click', async () => {
        try {
          const res = await logSet(currentSession!.id, {
            exercise_id: ex.id,
            set_number: 1,
            reps: ex.is_timed ? undefined : 10,
            duration_s: ex.is_timed ? 30 : undefined,
            completed: true,
          });
          picker.remove();
          toastSuccess(`${ex.name} aggiunto`);
          const sRes = await getSession(currentSession!.id);
          currentSession = sRes.data;
          renderLogArea();
        } catch { toastError('Errore'); }
      });
      listEl.appendChild(item);
    }
    // Show anatomy for first result automatically
    if (filtered.length > 0) showAnatomy(filtered[0]);
  };
  render();

  picker.querySelector('#picker-search')!.addEventListener('input', (e) => render((e.target as HTMLInputElement).value));
  picker.querySelector('#picker-close')!.addEventListener('click', () => picker.remove());
  picker.addEventListener('click', (e) => { if (e.target === picker) picker.remove(); });
}

async function endSession(): Promise<void> {
  if (!currentSession) return;
  if (!(await confirm('Vuoi terminare l\'allenamento?'))) return;

  try {
    await updateSession(currentSession.id, {
      ended_at: toLocalISOString(),
    });

    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    // Ask for RPE
    const rpeContent = document.createElement('div');
    rpeContent.innerHTML = `
      <p class="system-text">Quanto è stato duro? (RPE)</p>
      <div class="rpe-picker">
        ${[1,2,3,4,5,6,7,8,9,10].map(v =>
          `<button class="btn btn--ghost rpe-btn" data-rpe="${v}">${v}</button>`
        ).join('')}
      </div>
      <div class="form-group" style="margin-top:var(--space-md)">
        <label class="form-label">Note</label>
        <textarea class="form-input form-textarea" id="session-end-notes" rows="3" placeholder="Come ti sei sentito?"></textarea>
      </div>
      <button class="btn btn--primary btn--glow" id="btn-save-rpe" style="margin-top:var(--space-md)">SALVA</button>
    `;

    const { openModal: openM, closeModal: closeM } = await import('../components/modal.js');
    openM('Allenamento Completato!', rpeContent, { size: 'sm' });

    let selectedRpe: number | null = null;
    rpeContent.querySelectorAll('.rpe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        rpeContent.querySelectorAll('.rpe-btn').forEach(b => b.classList.remove('btn--primary'));
        btn.classList.add('btn--primary');
        selectedRpe = parseInt(btn.getAttribute('data-rpe')!);
      });
    });

    rpeContent.querySelector('#btn-save-rpe')!.addEventListener('click', async () => {
      const notes = (rpeContent.querySelector<HTMLTextAreaElement>('#session-end-notes')!).value;
      try {
        await updateSession(currentSession!.id, {
          overall_rpe: selectedRpe ?? undefined,
          notes: notes || undefined,
        });
        toastSuccess('Allenamento salvato!');
        closeM();
        window.location.hash = '#/history';
      } catch { toastError('Errore'); }
    });
  } catch { toastError('Errore nel salvataggio'); }
}
