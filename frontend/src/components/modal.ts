let activeModal: HTMLElement | null = null;
let onCloseCallback: (() => void) | null = null;

export function openModal(
  title: string,
  content: HTMLElement | string,
  opts: {
    size?: 'sm' | 'md' | 'lg';
    onClose?: () => void;
  } = {}
): HTMLElement {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal__overlay';

  const dialog = document.createElement('div');
  dialog.className = `modal__content modal__content--${opts.size ?? 'md'}`;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'modal__header';

  const titleEl = document.createElement('h2');
  titleEl.className = 'modal__title';
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal__close btn btn--ghost';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.addEventListener('click', closeModal);

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal__body';
  if (typeof content === 'string') body.innerHTML = content;
  else body.appendChild(content);

  dialog.appendChild(header);
  dialog.appendChild(body);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener('keydown', handleEsc);

  requestAnimationFrame(() => overlay.classList.add('modal__overlay--visible'));

  activeModal = overlay;
  onCloseCallback = opts.onClose ?? null;

  return body;
}

export function closeModal(): void {
  if (!activeModal) return;
  document.removeEventListener('keydown', handleEsc);
  const m = activeModal;
  activeModal = null;
  m.classList.remove('modal__overlay--visible');
  m.addEventListener('transitionend', () => m.remove(), { once: true });
  onCloseCallback?.();
  onCloseCallback = null;
}

function handleEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeModal();
}

export function isModalOpen(): boolean {
  return activeModal !== null;
}
