export function confirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal__overlay modal__overlay--visible';

    const dialog = document.createElement('div');
    dialog.className = 'modal__content modal__content--sm confirm-dialog';

    dialog.innerHTML = `
      <div class="modal__body">
        <p class="confirm-dialog__message">${message}</p>
        <div class="confirm-dialog__actions">
          <button class="btn btn--ghost" data-action="cancel">Annulla</button>
          <button class="btn btn--danger" data-action="confirm">Conferma</button>
        </div>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const close = (result: boolean) => {
      overlay.classList.remove('modal__overlay--visible');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      resolve(result);
    };

    dialog.querySelector('[data-action="confirm"]')!.addEventListener('click', () => close(true));
    dialog.querySelector('[data-action="cancel"]')!.addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
  });
}
