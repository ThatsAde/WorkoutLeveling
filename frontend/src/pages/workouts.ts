import { listWorkouts, getWorkout, createWorkout, updateWorkout, deleteWorkout, addExerciseToWorkout, updateWorkoutExercise, removeExerciseFromWorkout } from '../api/workouts.js';
import { listExercises, listWorkoutCategories } from '../api/exercises.js';
import type { Workout, Exercise } from '../types/index.js';
import { openModal, closeModal } from '../components/modal.js';
import { toastSuccess, toastError } from '../components/toast.js';
import { confirm } from '../components/confirm.js';
import { delegateEvent, clearChildren } from '../utils/dom.js';

let categories: { id: number; name: string }[] = [];
let container: HTMLElement;
let destroyFns: (() => void)[] = [];

export async function mount(root: HTMLElement): Promise<void> {
  container = root;
  container.innerHTML = `
    <div class="page-header">
      <h1><span class="glow-text">SCHEDE ALLENAMENTO</span></h1>
      <button class="btn btn--primary btn--glow" id="btn-new-workout">+ Nuova Scheda</button>
    </div>
    <div class="filters-bar">
      <input class="form-input" type="search" id="filter-workout-search" placeholder="Cerca scheda..." />
      <select class="form-select" id="filter-workout-cat">
        <option value="">Tutte le categorie</option>
      </select>
    </div>
    <div id="workouts-list" class="card-grid"></div>
  `;

  try {
    const catRes = await listWorkoutCategories();
    categories = catRes.data;
    const sel = container.querySelector<HTMLSelectElement>('#filter-workout-cat')!;
    for (const c of categories) {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = c.name;
      sel.appendChild(opt);
    }
  } catch {}

  await loadWorkouts();

  const d1 = delegateEvent(container, '#btn-new-workout', 'click', () => openWorkoutForm(null));
  const d2 = delegateEvent(container, '.workout-card__view', 'click', async (_, t) => {
    const id = parseInt(t.closest('[data-id]')!.getAttribute('data-id')!);
    openWorkoutDetail(id);
  });
  const d3 = delegateEvent(container, '.workout-card__delete', 'click', async (_, t) => {
    const id = parseInt(t.closest('[data-id]')!.getAttribute('data-id')!);
    const name = t.closest('[data-id]')!.querySelector('.workout-card__name')!.textContent!;
    if (await confirm(`Eliminare la scheda "${name}"?`)) {
      try { await deleteWorkout(id); toastSuccess('Scheda eliminata'); loadWorkouts(); }
      catch { toastError('Errore nell\'eliminazione'); }
    }
  });

  let searchTimer: ReturnType<typeof setTimeout>;
  container.querySelector('#filter-workout-search')!.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadWorkouts({ search: (e.target as HTMLInputElement).value }), 300);
  });
  container.querySelector('#filter-workout-cat')!.addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    loadWorkouts(v ? { category_id: parseInt(v) } : {});
  });

  destroyFns = [d1, d2, d3];
}

export function unmount(): void {
  destroyFns.forEach(fn => fn());
  destroyFns = [];
}

async function loadWorkouts(params?: { category_id?: number; search?: string }): Promise<void> {
  const listEl = container.querySelector<HTMLElement>('#workouts-list')!;
  listEl.innerHTML = '<div class="loading system-text">Scansione in corso...</div>';
  try {
    const res = await listWorkouts(params);
    renderWorkouts(res.data, listEl);
  } catch {
    listEl.innerHTML = '<div class="empty-state">Errore nel caricamento.</div>';
  }
}

function renderWorkouts(workouts: Workout[], listEl: HTMLElement): void {
  clearChildren(listEl);
  if (workouts.length === 0) {
    listEl.innerHTML = '<div class="empty-state system-text">Nessuna scheda trovata. Creane una nuova, Hunter!</div>';
    return;
  }
  for (const w of workouts) {
    const card = document.createElement('div');
    card.className = 'workout-card card card--system';
    card.setAttribute('data-id', String(w.id));
    card.innerHTML = `
      <div class="card__header">
        <span class="workout-card__name">${w.name}</span>
        <div class="card__actions">
          <button class="btn btn--ghost btn--sm workout-card__view" title="Dettagli">VIEW</button>
          <button class="btn btn--ghost btn--sm workout-card__delete" title="Elimina">DEL</button>
        </div>
      </div>
      <div class="card__body">
        ${w.category_name ? `<span class="badge badge--rank">${w.category_name}</span>` : ''}
        <div class="workout-card__info">
          <span>${w.exercise_count ?? 0} esercizi</span>
          ${w.estimated_duration_min ? `<span>${w.estimated_duration_min} min</span>` : ''}
        </div>
        ${w.description ? `<p class="text-muted">${w.description}</p>` : ''}
      </div>
    `;
    listEl.appendChild(card);
  }
}

function openWorkoutForm(workout: Workout | null): void {
  const form = document.createElement('form');
  form.className = 'workout-form';
  const catOptions = categories.map(c =>
    `<option value="${c.id}" ${workout?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  form.innerHTML = `
    <div class="form-grid">
      <div class="form-group form-group--full">
        <label class="form-label">Nome scheda *</label>
        <input class="form-input" name="name" type="text" required value="${workout?.name ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select class="form-select" name="category_id">
          <option value="">Nessuna</option>
          ${catOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Durata stimata (min)</label>
        <input class="form-input" name="estimated_duration_min" type="number" min="1" value="${workout?.estimated_duration_min ?? ''}" />
      </div>
      <div class="form-group form-group--full">
        <label class="form-label">Descrizione</label>
        <textarea class="form-input form-textarea" name="description" rows="3">${workout?.description ?? ''}</textarea>
      </div>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn--ghost" id="btn-cancel-workout">Annulla</button>
      <button type="submit" class="btn btn--primary btn--glow">${workout ? 'Salva' : 'Crea scheda'}</button>
    </div>
  `;

  openModal(workout ? 'Modifica Scheda' : 'Nuova Scheda', form, { size: 'md' });
  form.querySelector('#btn-cancel-workout')!.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = {
      name: String(fd.get('name')),
      category_id: fd.get('category_id') ? parseInt(String(fd.get('category_id'))) : null,
      estimated_duration_min: fd.get('estimated_duration_min') ? parseInt(String(fd.get('estimated_duration_min'))) : null,
      description: String(fd.get('description') || '') || null,
    };
    try {
      if (workout) { await updateWorkout(workout.id, data); toastSuccess('Scheda aggiornata'); }
      else { await createWorkout(data); toastSuccess('Scheda creata'); }
      closeModal(); loadWorkouts();
    } catch { toastError('Errore nel salvataggio'); }
  });
}

async function openWorkoutDetail(id: number): Promise<void> {
  try {
    const res = await getWorkout(id);
    const w = res.data;

    const content = document.createElement('div');
    content.className = 'workout-detail';
    content.innerHTML = `
      <div class="workout-detail__header">
        ${w.category_name ? `<span class="badge badge--rank">${w.category_name}</span>` : ''}
        ${w.estimated_duration_min ? `<span class="badge badge--info">${w.estimated_duration_min} min</span>` : ''}
        ${w.description ? `<p class="text-muted">${w.description}</p>` : ''}
      </div>
      <div class="workout-detail__exercises">
        <h3 class="system-text">ESERCIZI</h3>
        <div id="workout-exercises-list"></div>
        <button class="btn btn--primary btn--sm btn--glow" id="btn-add-exercise-to-workout">+ Aggiungi esercizio</button>
      </div>
      <div class="form-actions" style="margin-top:var(--space-lg)">
        <button class="btn btn--ghost" id="btn-edit-workout">Modifica scheda</button>
        <button class="btn btn--primary btn--glow" id="btn-start-session">INIZIA ALLENAMENTO</button>
      </div>
    `;

    const body = openModal(w.name, content, { size: 'lg' });

    renderWorkoutExercises(w, body.querySelector('#workout-exercises-list')!);

    body.querySelector('#btn-add-exercise-to-workout')!.addEventListener('click', () => openAddExerciseModal(w));
    body.querySelector('#btn-edit-workout')!.addEventListener('click', () => { closeModal(); openWorkoutForm(w); });
    body.querySelector('#btn-start-session')!.addEventListener('click', () => {
      closeModal();
      window.location.hash = `#/log?workout_id=${w.id}`;
    });
  } catch { toastError('Errore nel caricamento della scheda'); }
}

function renderWorkoutExercises(workout: Workout, listEl: HTMLElement): void {
  clearChildren(listEl);
  if (!workout.exercises.length) {
    listEl.innerHTML = '<div class="empty-state system-text">Nessun esercizio. Aggiungine uno!</div>';
    return;
  }
  for (const we of workout.exercises) {
    const item = document.createElement('div');
    item.className = 'workout-exercise-item';
    item.innerHTML = `
      <div class="workout-exercise-item__info">
        <span class="workout-exercise-item__pos">#${we.position}</span>
        <strong>${we.exercise_name}</strong>
        <span class="badge badge--movement">${we.movement_type_name}</span>
      </div>
      <div class="workout-exercise-item__config">
        <span>${we.sets} serie</span>
        <span>${we.is_timed ? `${we.target_time_s ?? '?'}s` : `${we.target_reps ?? '?'} reps`}</span>
        <span>Pausa: ${we.rest_s}s</span>
      </div>
      <button class="btn btn--ghost btn--sm" data-remove-we="${we.id}">✕</button>
    `;

    item.querySelector(`[data-remove-we="${we.id}"]`)!.addEventListener('click', async () => {
      if (await confirm('Rimuovere questo esercizio dalla scheda?')) {
        try {
          await removeExerciseFromWorkout(workout.id, we.id);
          toastSuccess('Esercizio rimosso');
          openWorkoutDetail(workout.id);
        } catch { toastError('Errore nella rimozione'); }
      }
    });

    listEl.appendChild(item);
  }
}

async function openAddExerciseModal(workout: Workout): Promise<void> {
  closeModal();
  const content = document.createElement('div');
  content.innerHTML = '<div class="loading system-text">Caricamento esercizi...</div>';

  const body = openModal('Aggiungi Esercizio', content, { size: 'lg', onClose: () => openWorkoutDetail(workout.id) });

  try {
    const res = await listExercises({ limit: 100 });
    const exercises = res.data;
    clearChildren(content);

    content.innerHTML = `
      <input class="form-input" id="add-ex-search" type="search" placeholder="Cerca esercizio..." style="margin-bottom:var(--space-md)" />
      <div id="add-ex-list" class="exercise-pick-list"></div>
    `;

    const listEl = content.querySelector('#add-ex-list')!;
    const render = (filter = '') => {
      clearChildren(listEl as HTMLElement);
      const filtered = exercises.filter(e => !filter || e.name.toLowerCase().includes(filter.toLowerCase()));
      for (const ex of filtered) {
        const item = document.createElement('div');
        item.className = 'exercise-pick-item';
        item.innerHTML = `
          <div>
            <strong>${ex.name}</strong>
            <span class="badge badge--movement">${ex.movement_type_name}</span>
          </div>
          <button class="btn btn--primary btn--sm btn--glow" data-pick-ex="${ex.id}">Aggiungi</button>
        `;
        item.querySelector(`[data-pick-ex="${ex.id}"]`)!.addEventListener('click', async () => {
          try {
            await addExerciseToWorkout(workout.id, { exercise_id: ex.id, sets: 3, target_reps: 10, rest_s: 90 });
            toastSuccess(`${ex.name} aggiunto`);
            closeModal();
            openWorkoutDetail(workout.id);
          } catch { toastError('Errore nell\'aggiunta'); }
        });
        listEl.appendChild(item);
      }
      if (filtered.length === 0) listEl.innerHTML = '<div class="empty-state">Nessun esercizio trovato.</div>';
    };

    render();
    content.querySelector('#add-ex-search')!.addEventListener('input', (e) => render((e.target as HTMLInputElement).value));
  } catch { content.innerHTML = '<div class="empty-state">Errore nel caricamento.</div>'; }
}
