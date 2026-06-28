type ToastType = 'success' | 'error' | 'info';

let container: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function toast(message: string, type: ToastType = 'info', duration = 3500): void {
  const c = getContainer();
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = message;
  c.appendChild(t);

  requestAnimationFrame(() => t.classList.add('toast--visible'));

  setTimeout(() => {
    t.classList.remove('toast--visible');
    t.addEventListener('transitionend', () => t.remove(), { once: true });
  }, duration);
}

export const toastSuccess = (msg: string) => toast(msg, 'success');
export const toastError = (msg: string) => toast(msg, 'error');
export const toastInfo = (msg: string) => toast(msg, 'info');
