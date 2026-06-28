import { listSessions, getSession, deleteSession } from '../api/sessions.js';
import type { Session } from '../types/index.js';
import { openModal, closeModal } from '../components/modal.js';
import { toastSuccess, toastError } from '../components/toast.js';
import { confirm } from '../components/confirm.js';
import { delegateEvent, clearChildren } from '../utils/dom.js';
import { formatDateTime, sessionDuration } from '../utils/date.js';

let container: HTMLElement;
let destroyFns: (() => void)[] = [];

export async function mount(root: HTMLElement): Promise<void> {
  container = root;
  container.innerHTML = `
    <div class="page-header">
      <h1><span class="glow-text">CRONOLOGIA</span></h1>
    </div>
    <div id="history-list" class="session-list"></div>
    <div id="history-pagination" class="pagination"></div>
  `;

  await loadSessions();

  const d1 = delegateEvent(container, '.session-item__view', 'click', async (_, t) => {
    const id = parseInt(t.closest('[data-id]')!.getAttribute('data-id')!);
    openSessionDetail(id);
  });
  const d2 = delegateEvent(container, '.session-item__delete', 'click', async (_, t) => {
    const id = parseInt(t.closest('[data-id]')!.getAttribute('data-id')!);
    if (await confirm('Eliminare questa sessione?')) {
      try { await deleteSession(id); toastSuccess('Sessione eliminata'); loadSessions(); }
      catch { toastError('Errore'); }
    }
  });

  destroyFns = [d1, d2];
}

export function unmount(): void {
  destroyFns.forEach(fn => fn());
  destroyFns = [];
}

async function loadSessions(page = 1): Promise<void> {
  const listEl = container.querySelector<HTMLElement>('#history-list')!;
  listEl.innerHTML = '<div class="loading system-text">Caricamento log...</div>';

  try {
    const res = await listSessions({ page, limit: 20 });
    clearChildren(listEl);

    if (res.data.length === 0) {
      listEl.innerHTML = '<div class="empty-state system-text">Nessun allenamento registrato. Inizia ad allenarti, Hunter!</div>';
      return;
    }

    for (const s of res.data) {
      const item = document.createElement('div');
      item.className = 'session-item card card--system';
      item.setAttribute('data-id', String(s.id));

      const duration = sessionDuration(s.started_at, s.ended_at);
      const rpeColor = s.overall_rpe && s.overall_rpe >= 8 ? 'text-danger' : s.overall_rpe && s.overall_rpe >= 6 ? 'text-warning' : '';

      item.innerHTML = `
        <div class="session-item__main">
          <div class="session-item__info">
            <strong class="session-item__name">${s.name ?? s.workout_template_name ?? 'Allenamento'}</strong>
            <span class="text-muted">${formatDateTime(s.started_at)}</span>
          </div>
          <div class="session-item__stats">
            <span class="stat-badge">${s.set_count ?? 0} set</span>
            <span class="stat-badge">${duration}</span>
            ${s.overall_rpe ? `<span class="stat-badge ${rpeColor}">RPE ${s.overall_rpe}</span>` : ''}
          </div>
          <div class="card__actions">
            <button class="btn btn--ghost btn--sm session-item__view">Dettagli</button>
            <button class="btn btn--ghost btn--sm text-danger session-item__delete">DEL</button>
          </div>
        </div>
      `;
      listEl.appendChild(item);
    }

    // Pagination
    const pagEl = container.querySelector<HTMLElement>('#history-pagination')!;
    clearChildren(pagEl);
    if (res.meta.total_pages > 1) {
      const prev = document.createElement('button');
      prev.className = 'btn btn--ghost btn--sm';
      prev.textContent = '← Prev';
      prev.disabled = page <= 1;
      prev.addEventListener('click', () => loadSessions(page - 1));

      const info = document.createElement('span');
      info.className = 'pagination__info system-text';
      info.textContent = `${page}/${res.meta.total_pages}`;

      const next = document.createElement('button');
      next.className = 'btn btn--ghost btn--sm';
      next.textContent = 'Next →';
      next.disabled = page >= res.meta.total_pages;
      next.addEventListener('click', () => loadSessions(page + 1));

      pagEl.append(prev, info, next);
    }
  } catch {
    listEl.innerHTML = '<div class="empty-state">Errore nel caricamento.</div>';
  }
}

async function openSessionDetail(id: number): Promise<void> {
  try {
    const res = await getSession(id);
    const s = res.data;

    const content = document.createElement('div');
    content.className = 'session-detail';

    const duration = sessionDuration(s.started_at, s.ended_at);

    // Group sets by exercise
    const grouped = new Map<number, typeof s.sets>();
    for (const set of s.sets) {
      if (!grouped.has(set.exercise_id)) grouped.set(set.exercise_id, []);
      grouped.get(set.exercise_id)!.push(set);
    }

    let exercisesHtml = '';
    for (const [exId, sets] of grouped) {
      const name = sets[0].exercise_name;
      const setsHtml = sets.map(set => `
        <div class="detail-set-row">
          <span class="set-row__num">#${set.set_number}</span>
          ${set.reps != null ? `<span>${set.reps} reps</span>` : ''}
          ${set.duration_s != null ? `<span>${set.duration_s}s</span>` : ''}
          ${set.weight != null ? `<span>${set.weight}kg</span>` : ''}
          ${set.rpe != null ? `<span>RPE ${set.rpe}</span>` : ''}
          <span class="${set.completed ? 'text-success' : 'text-muted'}">${set.completed ? '✓' : '—'}</span>
        </div>
      `).join('');

      exercisesHtml += `
        <div class="detail-exercise">
          <h4>${name}</h4>
          ${setsHtml}
        </div>
      `;
    }

    content.innerHTML = `
      <div class="session-detail__stats">
        <div class="stat-card"><span class="stat-card__value">${s.sets.length}</span><span class="stat-card__label">Set totali</span></div>
        <div class="stat-card"><span class="stat-card__value">${duration}</span><span class="stat-card__label">Durata</span></div>
        <div class="stat-card"><span class="stat-card__value">${s.overall_rpe ?? '—'}</span><span class="stat-card__label">RPE</span></div>
        <div class="stat-card"><span class="stat-card__value">${grouped.size}</span><span class="stat-card__label">Esercizi</span></div>
      </div>
      ${s.notes ? `<div class="session-detail__notes"><strong>Note:</strong> ${s.notes}</div>` : ''}
      <div class="session-detail__exercises">${exercisesHtml}</div>
    `;

    openModal(
      `${s.name ?? 'Allenamento'} — ${formatDateTime(s.started_at)}`,
      content,
      { size: 'lg' }
    );
  } catch { toastError('Errore nel caricamento'); }
}
