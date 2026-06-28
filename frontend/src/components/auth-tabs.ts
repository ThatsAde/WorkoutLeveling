import { post } from '../api/client.js';
import { toastSuccess, toastError } from './toast.js';
import type { User } from '../types/index.js';

type AuthMode = 'login' | 'register';

/**
 * Renders a Login/Register tabbed UI into the given container.
 * Calls onSuccess(user) after a successful auth.
 */
export function renderAuthTabs(
  container: HTMLElement,
  onSuccess: (user: User) => void,
  initialMode: AuthMode = 'login'
): void {
  let activeTab: AuthMode = initialMode;

  function render(): void {
    container.innerHTML = `
      <div class="auth-tabs">
        <div class="auth-tabs__header">
          <button class="auth-tab ${activeTab === 'login' ? 'auth-tab--active' : ''}" data-tab="login">
            ACCEDI
          </button>
          <button class="auth-tab ${activeTab === 'register' ? 'auth-tab--active' : ''}" data-tab="register">
            REGISTRATI
          </button>
        </div>

        ${activeTab === 'login' ? renderLogin() : renderRegister()}
      </div>
    `;

    container.querySelectorAll('.auth-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = (btn as HTMLElement).dataset.tab as AuthMode;
        render();
      });
    });

    if (activeTab === 'login') {
      attachLoginHandlers();
    } else {
      attachRegisterHandlers();
    }
  }

  function renderLogin(): string {
    return `
      <form id="auth-login-form" class="auth-form" novalidate>
        <div class="form-group">
          <label class="form-label system-text">HUNTER ID</label>
          <input class="form-input" name="username" type="text" required placeholder="Username" autocomplete="username" />
        </div>
        <div class="form-group">
          <label class="form-label system-text">PASSWORD</label>
          <input class="form-input" name="password" type="password" required placeholder="••••••••" autocomplete="current-password" />
        </div>
        <button type="submit" class="btn btn--primary btn--glow btn--lg btn--full" id="btn-auth-submit">
          ACCEDI AL SISTEMA
        </button>
        <div class="auth-form__footer">
          <button type="button" class="btn btn--ghost btn--sm" id="btn-forgot">Password dimenticata?</button>
        </div>
      </form>
    `;
  }

  function renderRegister(): string {
    return `
      <form id="auth-register-form" class="auth-form" novalidate>
        <div class="form-group">
          <label class="form-label system-text">HUNTER ID</label>
          <input class="form-input" name="username" type="text" required placeholder="Username (3-50 char)" autocomplete="username" maxlength="50" />
        </div>
        <div class="form-group">
          <label class="form-label system-text">EMAIL <span class="text-muted">(opzionale)</span></label>
          <input class="form-input" name="email" type="email" placeholder="hunter@example.com" autocomplete="email" />
        </div>
        <div class="form-group">
          <label class="form-label system-text">PASSWORD</label>
          <input class="form-input" name="password" type="password" required placeholder="Min. 8 caratteri" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label class="form-label system-text">CONFERMA PASSWORD</label>
          <input class="form-input" name="password_confirm" type="password" required placeholder="Ripeti password" autocomplete="new-password" />
        </div>
        <button type="submit" class="btn btn--primary btn--glow btn--lg btn--full" id="btn-auth-submit">
          CREA ACCOUNT
        </button>
      </form>
    `;
  }

  function attachLoginHandlers(): void {
    const form = container.querySelector<HTMLFormElement>('#auth-login-form')!;
    const submitBtn = container.querySelector<HTMLButtonElement>('#btn-auth-submit')!;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const username = String(fd.get('username')).trim();
      const password = String(fd.get('password'));

      if (!username || !password) {
        toastError('Inserisci username e password');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'AUTENTICAZIONE...';

      try {
        const res = await post<{ data: User }>('/auth/login', { username, password });
        if (res.data?.token) {
          localStorage.setItem('auth_token', res.data.token);
          // Also store basic user info for sidebar
          localStorage.setItem('auth_user', JSON.stringify({
            id: res.data.id,
            username: res.data.username,
            pfp_url: res.data.pfp_url,
            role: res.data.role,
          }));
        }
        toastSuccess(`Benvenuto, ${res.data.username}!`);
        onSuccess(res.data);
      } catch (err: any) {
        toastError(err?.error?.message ?? 'Credenziali non valide');
        submitBtn.disabled = false;
        submitBtn.textContent = 'ACCEDI AL SISTEMA';
      }
    });

    container.querySelector('#btn-forgot')?.addEventListener('click', () => {
      showForgotPassword();
    });
  }

  function attachRegisterHandlers(): void {
    const form = container.querySelector<HTMLFormElement>('#auth-register-form')!;
    const submitBtn = container.querySelector<HTMLButtonElement>('#btn-auth-submit')!;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const username = String(fd.get('username')).trim();
      const email    = String(fd.get('email')).trim();
      const password = String(fd.get('password'));
      const confirm  = String(fd.get('password_confirm'));

      if (!username || username.length < 3) { toastError('Username deve avere almeno 3 caratteri'); return; }
      if (password.length < 8) { toastError('Password deve avere almeno 8 caratteri'); return; }
      if (password !== confirm) { toastError('Le password non coincidono'); return; }

      submitBtn.disabled = true;
      submitBtn.textContent = 'CREAZIONE ACCOUNT...';

      try {
        const payload: Record<string, string> = { username, password };
        if (email) payload['email'] = email;

        const res = await post<{ data: User }>('/auth/register', payload);
        if (res.data?.token) {
          localStorage.setItem('auth_token', res.data.token);
          localStorage.setItem('auth_user', JSON.stringify({
            id: res.data.id,
            username: res.data.username,
            pfp_url: res.data.pfp_url,
            role: res.data.role,
          }));
        }
        toastSuccess(`Account creato! Benvenuto, ${res.data.username}!`);
        onSuccess(res.data);
      } catch (err: any) {
        const code = err?.error?.code;
        if (code === 'USERNAME_TAKEN') toastError('Username già in uso');
        else if (code === 'EMAIL_TAKEN') toastError('Email già registrata');
        else toastError(err?.error?.message ?? 'Errore nella registrazione');
        submitBtn.disabled = false;
        submitBtn.textContent = 'CREA ACCOUNT';
      }
    });
  }

  function showForgotPassword(): void {
    const modal = document.createElement('div');
    modal.className = 'auth-forgot-overlay';
    modal.innerHTML = `
      <div class="auth-forgot card card--system">
        <h3 class="system-text">RESET PASSWORD</h3>
        <p class="text-muted" style="margin-bottom:var(--space-md)">Inserisci la tua email. Se registrata, riceverai un token di reset.</p>
        <div class="form-group">
          <input class="form-input" id="forgot-email" type="email" placeholder="Email" />
        </div>
        <div style="display:flex;gap:var(--space-sm)">
          <button class="btn btn--primary btn--glow btn--full" id="btn-forgot-submit">INVIA</button>
          <button class="btn btn--ghost" id="btn-forgot-cancel">Annulla</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#btn-forgot-cancel')!.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#btn-forgot-submit')!.addEventListener('click', async () => {
      const email = (modal.querySelector<HTMLInputElement>('#forgot-email')!).value.trim();
      if (!email) { toastError('Inserisci un\'email'); return; }
      try {
        await post('/auth/forgot-password', { email });
        toastSuccess('Se l\'email è registrata, riceverai il token di reset.');
        modal.remove();
      } catch {
        toastSuccess('Se l\'email è registrata, riceverai il token di reset.');
        modal.remove();
      }
    });
  }

  render();
}
