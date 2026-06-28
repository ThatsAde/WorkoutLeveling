import {
  listExercises, createExercise, updateExercise, deleteExercise,
  listMuscles, listMovementTypes, uploadExerciseMedia, type ExerciseFilters
} from '../api/exercises.js';
import type { Exercise, Muscle } from '../types/index.js';
import { openModal, closeModal } from '../components/modal.js';
import { toastSuccess, toastError } from '../components/toast.js';
import { confirm } from '../components/confirm.js';
import { delegateEvent, clearChildren } from '../utils/dom.js';
import { ApiException } from '../api/client.js';
import { renderAnatomyCard } from '../components/exercise-anatomy-card.js';

let muscles: Muscle[] = [];
let movementTypes: { id: number; name: string }[] = [];
let currentFilters: ExerciseFilters = { page: 1, limit: 50 };
let container: HTMLElement;
let destroyFns: (() => void)[] = [];

export async function mount(root: HTMLElement): Promise<void> {
  container = root;
  container.innerHTML = `
    <div class="page-header">
      <h1>Esercizi</h1>
      <button class="btn btn--primary" id="btn-new-exercise">+ Nuovo Esercizio</button>
    </div>

    <div class="filters-bar">
      <input class="form-input" type="search" id="filter-search" placeholder="Cerca esercizio..." />
      <select class="form-select" id="filter-movement">
        <option value="">Tutti i movimenti</option>
      </select>
      <select class="form-select" id="filter-difficulty">
        <option value="">Tutte le difficoltà</option>
        <option value="1">★ Principiante</option>
        <option value="2">★★ Base</option>
        <option value="3">★★★ Intermedio</option>
        <option value="4">★★★★ Avanzato</option>
        <option value="5">★★★★★ Elite</option>
      </select>
      <select class="form-select" id="filter-weighted">
        <option value="">Tutti</option>
        <option value="0">Solo Corpo libero</option>
        <option value="1">Solo Zavorrato</option>
      </select>
    </div>

    <div id="exercises-list" class="card-grid"></div>
    <div id="exercises-pagination" class="pagination"></div>
  `;

  // Load reference data
  try {
    const [mRes, mtRes] = await Promise.all([listMuscles(), listMovementTypes()]);
    muscles = mRes.data;
    movementTypes = mtRes.data;
  } catch {
    toastError('Errore nel caricamento dei dati di riferimento');
  }

  // Populate movement type filter
  const movementSelect = container.querySelector<HTMLSelectElement>('#filter-movement')!;
  for (const mt of movementTypes) {
    const opt = document.createElement('option');
    opt.value = mt.name;
    opt.textContent = mt.name;
    movementSelect.appendChild(opt);
  }

  await loadExercises();

  // Event bindings
  const d1 = delegateEvent(container, '#btn-new-exercise', 'click', () => openExerciseForm(null));
  const d2 = delegateEvent(container, '.exercise-card__edit', 'click', async (_, t) => {
    const id = parseInt(t.closest('[data-id]')!.getAttribute('data-id')!);
    try {
      const res = await import('../api/exercises.js').then(m => m.getExercise(id));
      openExerciseForm(res.data);
    } catch { toastError('Errore nel caricamento dell\'esercizio'); }
  });
  const d3 = delegateEvent(container, '.exercise-card__delete', 'click', async (_, t) => {
    const id = parseInt(t.closest('[data-id]')!.getAttribute('data-id')!);
    const name = t.closest('[data-id]')!.querySelector('.exercise-card__name')!.textContent!;
    if (await confirm(`Eliminare "${name}"?`)) {
      try {
        await deleteExercise(id);
        toastSuccess('Esercizio eliminato');
        await loadExercises();
      } catch { toastError('Errore nell\'eliminazione'); }
    }
  });

  // Click on media → fullscreen lightbox
  const d4 = delegateEvent(container, '.exercise-card__media', 'click', (_, t) => {
    const v = t.getAttribute('data-media-video');
    const i = t.getAttribute('data-media-image');
    if (v) openMediaLightbox({ video: v });
    else if (i) openMediaLightbox({ image: i });
  });

  // Hover-play preview videos (mouseover bubbles, unlike mouseenter)
  const d5 = delegateEvent(container, '.exercise-card__media', 'mouseover', (_, t) => {
    const v = t.querySelector('video') as HTMLVideoElement | null;
    v?.play().catch(() => {});
  });
  const d6 = delegateEvent(container, '.exercise-card__media', 'mouseout', (e, t) => {
    // Only act when leaving the media box entirely
    const related = (e as MouseEvent).relatedTarget as Node | null;
    if (related && t.contains(related)) return;
    const v = t.querySelector('video') as HTMLVideoElement | null;
    if (v) { v.pause(); v.currentTime = 0; }
  });

  // Filter events
  let searchTimer: ReturnType<typeof setTimeout>;
  const searchInput = container.querySelector<HTMLInputElement>('#filter-search')!;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentFilters.search = searchInput.value;
      currentFilters.page = 1;
      loadExercises();
    }, 300);
  });

  movementSelect.addEventListener('change', () => {
    currentFilters.movement_type = movementSelect.value || undefined;
    currentFilters.page = 1;
    loadExercises();
  });

  container.querySelector('#filter-difficulty')!.addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    currentFilters.difficulty = v ? parseInt(v) : undefined;
    currentFilters.page = 1;
    loadExercises();
  });

  container.querySelector('#filter-weighted')!.addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    currentFilters.is_weighted = v !== '' ? parseInt(v) : undefined;
    currentFilters.page = 1;
    loadExercises();
  });

  destroyFns = [d1, d2, d3, d4, d5, d6];
}

// ── Media lightbox ────────────────────────────────────────────────────────────
function openMediaLightbox(media: { image?: string; video?: string }): void {
  const overlay = document.createElement('div');
  overlay.className = 'media-lightbox';
  overlay.innerHTML = media.video
    ? `<video src="${escapeAttr(media.video)}" autoplay loop controls playsinline></video>`
    : `<img src="${escapeAttr(media.image!)}" alt="Esecuzione" />`;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('media-lightbox--visible'));
}

export function unmount(): void {
  destroyFns.forEach(fn => fn());
  destroyFns = [];
}

async function loadExercises(): Promise<void> {
  const listEl = container.querySelector<HTMLElement>('#exercises-list')!;
  listEl.innerHTML = '<div class="loading">Caricamento...</div>';

  try {
    const res = await listExercises(currentFilters);
    renderExercises(res.data, listEl);
    renderPagination(res.meta);
  } catch (e) {
    listEl.innerHTML = '<div class="empty-state">Errore nel caricamento degli esercizi.</div>';
    toastError('Errore nel caricamento');
  }
}

function renderExercises(exercises: Exercise[], listEl: HTMLElement): void {
  clearChildren(listEl);

  if (exercises.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Nessun esercizio trovato. Creane uno nuovo!</div>';
    return;
  }

  for (const ex of exercises) {
    const card = document.createElement('div');
    card.className = 'exercise-card card';
    card.setAttribute('data-id', String(ex.id));

    const diffStars = '★'.repeat(ex.difficulty) + '☆'.repeat(5 - ex.difficulty);
    const primaryMuscles = ex.muscles.filter(m => m.role === 'primary').map(m => m.name).join(', ');
    const tags = [
      `<span class="badge badge--movement">${ex.movement_type_name}</span>`,
      ex.is_weighted ? '<span class="badge badge--weighted">Zavorrato</span>' : '<span class="badge badge--bodyweight">Corpo libero</span>',
      ex.is_timed ? '<span class="badge badge--timed">A tempo</span>' : '',
    ].filter(Boolean).join('');

    const mediaHtml = ex.video_url
      ? `<div class="exercise-card__media" data-media-video="${escapeAttr(ex.video_url)}"><video src="${escapeAttr(ex.video_url)}" muted loop playsinline preload="metadata"></video><div class="exercise-card__media-overlay system-text">PLAY</div></div>`
      : ex.image_url
        ? `<div class="exercise-card__media" data-media-image="${escapeAttr(ex.image_url)}"><img src="${escapeAttr(ex.image_url)}" alt="${escapeAttr(ex.name)}" loading="lazy" /></div>`
        : '';

    card.innerHTML = `
      <div class="card__header">
        <span class="exercise-card__name">${ex.name}</span>
        <div class="card__actions">
          <button class="btn btn--ghost btn--sm exercise-card__edit" title="Modifica">EDIT</button>
          <button class="btn btn--ghost btn--sm exercise-card__delete" title="Elimina">DEL</button>
        </div>
      </div>
      ${mediaHtml}
      <div class="card__body">
        <div class="exercise-card__tags">${tags}</div>
        <div class="exercise-card__difficulty" title="Difficoltà">${diffStars}</div>
        ${primaryMuscles ? `<div class="exercise-card__muscles"><strong>Muscoli:</strong> ${primaryMuscles}</div>` : ''}
        ${ex.tendons.length ? `<div class="exercise-card__tendons"><strong>Tendini:</strong> ${ex.tendons.join(', ')}</div>` : ''}
        ${ex.description ? `<p class="exercise-card__desc">${ex.description}</p>` : ''}
        ${ex.muscles.length ? `<div class="exercise-card__anatomy" data-anatomy-id="${ex.id}"></div>` : ''}
      </div>
    `;
    listEl.appendChild(card);

    // Render anatomy mini-card if exercise has muscles
    if (ex.muscles.length) {
      const anatomyEl = card.querySelector<HTMLElement>(`[data-anatomy-id="${ex.id}"]`)!;
      renderAnatomyCard(anatomyEl, ex.muscles);
    }
  }
}

function renderPagination(meta: { total: number; page: number; limit: number; total_pages: number }): void {
  const pag = container.querySelector<HTMLElement>('#exercises-pagination')!;
  clearChildren(pag);

  if (meta.total_pages <= 1) return;

  const info = document.createElement('span');
  info.className = 'pagination__info';
  info.textContent = `Pagina ${meta.page} di ${meta.total_pages} (${meta.total} totali)`;

  const prev = document.createElement('button');
  prev.className = 'btn btn--ghost btn--sm';
  prev.textContent = '← Prev';
  prev.disabled = meta.page <= 1;
  prev.addEventListener('click', () => { currentFilters.page = meta.page - 1; loadExercises(); });

  const next = document.createElement('button');
  next.className = 'btn btn--ghost btn--sm';
  next.textContent = 'Next →';
  next.disabled = meta.page >= meta.total_pages;
  next.addEventListener('click', () => { currentFilters.page = meta.page + 1; loadExercises(); });

  pag.appendChild(prev);
  pag.appendChild(info);
  pag.appendChild(next);
}

// ── Exercise Form ─────────────────────────────────────────────────────────────

function openExerciseForm(exercise: Exercise | null): void {
  const form = buildExerciseForm(exercise);
  const body = openModal(
    exercise ? 'Modifica Esercizio' : 'Nuovo Esercizio',
    form,
    { size: 'lg' }
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = collectFormData(form, exercise);

    try {
      if (exercise) {
        await updateExercise(exercise.id, data);
        toastSuccess('Esercizio aggiornato');
      } else {
        await createExercise(data);
        toastSuccess('Esercizio creato');
      }
      closeModal();
      await loadExercises();
    } catch (err) {
      if (err instanceof ApiException) {
        toastError(err.message);
      } else {
        toastError('Errore nel salvataggio');
      }
    }
  });
}

function buildExerciseForm(exercise: Exercise | null): HTMLFormElement {
  const form = document.createElement('form');
  form.className = 'exercise-form';

  const movementOptions = movementTypes.map(mt =>
    `<option value="${mt.id}" ${exercise?.movement_type_id === mt.id ? 'selected' : ''}>${mt.name}</option>`
  ).join('');

  form.innerHTML = `
    <div class="form-grid">
      <div class="form-group form-group--full">
        <label class="form-label" for="ex-name">Nome *</label>
        <input class="form-input" id="ex-name" name="name" type="text" required maxlength="200"
               value="${exercise?.name ?? ''}" placeholder="es. Muscle-up" />
      </div>

      <div class="form-group">
        <label class="form-label" for="ex-movement">Tipo di movimento *</label>
        <select class="form-select" id="ex-movement" name="movement_type_id" required>
          <option value="">Seleziona...</option>
          ${movementOptions}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="ex-difficulty">Difficoltà</label>
        <select class="form-select" id="ex-difficulty" name="difficulty">
          <option value="1" ${exercise?.difficulty === 1 ? 'selected' : ''}>★ Principiante</option>
          <option value="2" ${exercise?.difficulty === 2 ? 'selected' : ''}>★★ Base</option>
          <option value="3" ${(!exercise || exercise?.difficulty === 3) ? 'selected' : ''}>★★★ Intermedio</option>
          <option value="4" ${exercise?.difficulty === 4 ? 'selected' : ''}>★★★★ Avanzato</option>
          <option value="5" ${exercise?.difficulty === 5 ? 'selected' : ''}>★★★★★ Elite</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">
          <input type="checkbox" name="is_weighted" ${exercise?.is_weighted ? 'checked' : ''} />
          Esercizio Zavorrato
        </label>
      </div>

      <div class="form-group">
        <label class="form-label">
          <input type="checkbox" name="is_timed" ${exercise?.is_timed ? 'checked' : ''} />
          A tempo (non a ripetizioni)
        </label>
      </div>

      <div class="form-group" id="weight-group" style="${exercise?.is_weighted ? '' : 'display:none'}">
        <label class="form-label" for="ex-weight">Peso di default (kg)</label>
        <input class="form-input" id="ex-weight" name="default_weight" type="number" min="0" step="0.5"
               value="${exercise?.default_weight ?? ''}" />
      </div>

      <div class="form-group form-group--full">
        <label class="form-label" for="ex-desc">Descrizione</label>
        <textarea class="form-input form-textarea" id="ex-desc" name="description" rows="3"
                  placeholder="Descrivi l'esercizio...">${exercise?.description ?? ''}</textarea>
      </div>

      <div class="form-group form-group--full">
        <label class="form-label">Media esecuzione (immagine, GIF o video)</label>
        <div class="media-upload">
          <div class="media-upload__preview" id="ex-media-preview">
            ${renderMediaPreview(exercise?.image_url, exercise?.video_url)}
          </div>
          <div class="media-upload__controls">
            <label class="btn btn--ghost btn--sm media-upload__btn">
              <input type="file" id="ex-media-file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime" style="display:none" />
              <span>SCEGLI FILE</span>
            </label>
            <button type="button" class="btn btn--ghost btn--sm" id="ex-media-clear">RIMUOVI</button>
            <span class="media-upload__hint text-muted">Max 25 MB &middot; jpg, png, gif, webp, mp4, webm</span>
          </div>
          <input type="hidden" name="image_url" id="ex-image-url" value="${exercise?.image_url ?? ''}" />
          <input type="hidden" name="video_url" id="ex-video-url" value="${exercise?.video_url ?? ''}" />
        </div>
      </div>

      <div class="form-group form-group--full">
        <label class="form-label">Muscoli coinvolti</label>
        <div id="muscles-picker" class="muscles-picker"></div>
        <div id="anatomy-preview" class="anatomy-preview-wrap" style="margin-top:var(--space-md)"></div>
      </div>

      <div class="form-group form-group--full">
        <label class="form-label" for="ex-tendons">Tendini coinvolti</label>
        <div class="tendons-input">
          <input class="form-input" id="ex-tendons-input" type="text" placeholder="es. Patellar — premi Enter per aggiungere" />
          <div id="tendons-tags" class="tag-list"></div>
        </div>
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="btn btn--ghost" id="btn-cancel-exercise">Annulla</button>
      <button type="submit" class="btn btn--primary">${exercise ? 'Salva modifiche' : 'Crea esercizio'}</button>
    </div>
  `;

  // Show/hide weight input
  form.querySelector<HTMLInputElement>('[name="is_weighted"]')!.addEventListener('change', (e) => {
    const weightGroup = form.querySelector<HTMLElement>('#weight-group')!;
    weightGroup.style.display = (e.target as HTMLInputElement).checked ? '' : 'none';
  });

  form.querySelector('#btn-cancel-exercise')!.addEventListener('click', closeModal);

  // Media upload
  bindMediaUpload(form);

  // Muscles picker
  buildMusclesPicker(form.querySelector('#muscles-picker')!, exercise?.muscles ?? []);

  // Live anatomy preview
  const anatomyPreviewEl = form.querySelector<HTMLElement>('#anatomy-preview')!;
  function refreshAnatomyPreview(): void {
    const selectedMuscles: Muscle[] = [];
    form.querySelectorAll<HTMLInputElement>('.muscle-checkbox input[type="checkbox"]:checked').forEach(cb => {
      const muscleId = parseInt(cb.dataset.muscleId!);
      const role = (form.querySelector<HTMLSelectElement>(`.muscle-role[data-muscle-id="${muscleId}"]`)?.value ?? 'primary') as 'primary' | 'secondary';
      const muscle = muscles.find(m => m.id === muscleId);
      if (muscle) selectedMuscles.push({ ...muscle, role });
    });
    renderAnatomyCard(anatomyPreviewEl, selectedMuscles);
  }
  // Initial render + wire up change events
  refreshAnatomyPreview();
  form.querySelector('#muscles-picker')!.addEventListener('change', refreshAnatomyPreview);

  // Tendons input
  buildTendonsTags(form, exercise?.tendons ?? []);

  return form;
}

function renderMediaPreview(imageUrl?: string | null, videoUrl?: string | null): string {
  if (videoUrl) {
    return `<video src="${escapeAttr(videoUrl)}" controls loop muted playsinline></video>`;
  }
  if (imageUrl) {
    return `<img src="${escapeAttr(imageUrl)}" alt="Anteprima esecuzione" />`;
  }
  return `<div class="media-upload__placeholder system-text">[ NO MEDIA ]</div>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function bindMediaUpload(form: HTMLFormElement): void {
  const fileInput = form.querySelector<HTMLInputElement>('#ex-media-file')!;
  const preview   = form.querySelector<HTMLElement>('#ex-media-preview')!;
  const imgInput  = form.querySelector<HTMLInputElement>('#ex-image-url')!;
  const vidInput  = form.querySelector<HTMLInputElement>('#ex-video-url')!;
  const clearBtn  = form.querySelector<HTMLButtonElement>('#ex-media-clear')!;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toastError('File troppo grande (max 25 MB)');
      fileInput.value = '';
      return;
    }
    preview.innerHTML = `<div class="media-upload__placeholder system-text loading">UPLOADING...</div>`;
    try {
      const res = await uploadExerciseMedia(file);
      if (res.type === 'video') {
        vidInput.value = res.url;
        imgInput.value = '';
      } else {
        imgInput.value = res.url;
        vidInput.value = '';
      }
      preview.innerHTML = renderMediaPreview(imgInput.value || null, vidInput.value || null);
      toastSuccess('Media caricato');
    } catch (err) {
      const msg = err instanceof ApiException ? err.message : 'Upload fallito';
      toastError(msg);
      preview.innerHTML = renderMediaPreview(imgInput.value || null, vidInput.value || null);
    } finally {
      fileInput.value = '';
    }
  });

  clearBtn.addEventListener('click', () => {
    imgInput.value = '';
    vidInput.value = '';
    preview.innerHTML = renderMediaPreview(null, null);
  });
}

function buildMusclesPicker(container: HTMLElement, selected: Muscle[]): void {
  const groups = [...new Set(muscles.map(m => m.group_name))].sort();

  for (const group of groups) {
    const groupEl = document.createElement('div');
    groupEl.className = 'muscles-group';

    const label = document.createElement('strong');
    label.textContent = group;
    groupEl.appendChild(label);

    const checkboxes = document.createElement('div');
    checkboxes.className = 'muscles-checkboxes';

    for (const m of muscles.filter(mu => mu.group_name === group)) {
      const existing = selected.find(s => s.id === m.id);
      const wrapper = document.createElement('div');
      wrapper.className = 'muscle-checkbox';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `muscle-${m.id}`;
      cb.value = String(m.id);
      cb.checked = !!existing;
      cb.dataset.muscleId = String(m.id);

      const roleSelect = document.createElement('select');
      roleSelect.className = 'form-select form-select--sm muscle-role';
      roleSelect.dataset.muscleId = String(m.id);
      roleSelect.innerHTML = '<option value="primary">Primario</option><option value="secondary">Secondario</option>';
      if (existing?.role === 'secondary') roleSelect.value = 'secondary';
      roleSelect.style.display = existing ? '' : 'none';

      cb.addEventListener('change', () => {
        roleSelect.style.display = cb.checked ? '' : 'none';
      });

      const lbl = document.createElement('label');
      lbl.htmlFor = `muscle-${m.id}`;
      lbl.textContent = m.name;

      wrapper.appendChild(cb);
      wrapper.appendChild(lbl);
      wrapper.appendChild(roleSelect);
      checkboxes.appendChild(wrapper);
    }

    groupEl.appendChild(checkboxes);
    container.appendChild(groupEl);
  }
}

function buildTendonsTags(form: HTMLFormElement, initial: string[]): void {
  const tags = [...initial];
  const tagsEl = form.querySelector<HTMLElement>('#tendons-tags')!;
  const input = form.querySelector<HTMLInputElement>('#ex-tendons-input')!;

  const render = () => {
    tagsEl.innerHTML = '';
    for (const t of tags) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerHTML = `${t} <button type="button" data-tendon="${t}">&times;</button>`;
      tag.querySelector('button')!.addEventListener('click', () => {
        tags.splice(tags.indexOf(t), 1);
        render();
      });
      tagsEl.appendChild(tag);
    }
  };

  render();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = input.value.trim();
      if (v && !tags.includes(v)) {
        tags.push(v);
        input.value = '';
        render();
      }
    }
  });

  (form as any).__tendons = tags;
}

function collectFormData(form: HTMLFormElement, _existing: Exercise | null) {
  const data = new FormData(form);

  const muscles: { id: number; role: string }[] = [];
  form.querySelectorAll<HTMLInputElement>('.muscle-checkbox input[type="checkbox"]:checked').forEach(cb => {
    const muscleId = parseInt(cb.dataset.muscleId!);
    const role = (form.querySelector<HTMLSelectElement>(`.muscle-role[data-muscle-id="${muscleId}"]`)?.value) ?? 'primary';
    muscles.push({ id: muscleId, role });
  });

  return {
    name:             String(data.get('name') ?? ''),
    movement_type_id: parseInt(String(data.get('movement_type_id'))),
    is_weighted:      !!(form.querySelector<HTMLInputElement>('[name="is_weighted"]')?.checked),
    is_timed:         !!(form.querySelector<HTMLInputElement>('[name="is_timed"]')?.checked),
    default_weight:   data.get('default_weight') ? parseFloat(String(data.get('default_weight'))) : null,
    difficulty:       parseInt(String(data.get('difficulty') ?? '3')) as 1|2|3|4|5,
    description:      String(data.get('description') ?? '') || null,
    video_url:        String(data.get('video_url') ?? '') || null,
    image_url:        String(data.get('image_url') ?? '') || null,
    muscles,
    tendons:          (form as any).__tendons ?? [],
  };
}
