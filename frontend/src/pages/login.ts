import { get } from '../api/client.js';
import { renderAuthTabs } from '../components/auth-tabs.js';
import type { User } from '../types/index.js';

let container: HTMLElement;

export async function mount(root: HTMLElement): Promise<void> {
  container = root;

  // Check if already logged in
  try {
    const res = await get<{ data: User | null }>('/auth/me');
    if (res.data) {
      window.location.hash = '#/dashboard';
      return;
    }
  } catch {}

  container.innerHTML = `
    <div class="login-page">
      <div class="login-portal">
        <div class="login-portal__ring login-portal__ring--outer"></div>
        <div class="login-portal__ring login-portal__ring--inner"></div>
        <div class="login-portal__core"></div>
      </div>
      <div class="login-card card card--system">
        <div class="login-card__header">
          <div class="login-logo">
            <div class="login-logo__icon" aria-hidden="true">
              <svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M32 4 L56 18 L48 56 L16 56 L8 18 Z" stroke-linejoin="miter"/>
                <path d="M32 14 L46 22 L42 46 L22 46 L18 22 Z" stroke-linejoin="miter" opacity="0.7"/>
                <circle cx="32" cy="32" r="4" fill="currentColor"/>
                <line x1="32" y1="2" x2="32" y2="10" stroke-linecap="round"/>
                <line x1="32" y1="54" x2="32" y2="62" stroke-linecap="round"/>
                <line x1="2" y1="32" x2="10" y2="32" stroke-linecap="round"/>
                <line x1="54" y1="32" x2="62" y2="32" stroke-linecap="round"/>
              </svg>
            </div>
            <h1 class="login-title">WORKOUT<br>LEVELING</h1>
            <p class="login-subtitle system-text">SISTEMA ATTIVATO</p>
          </div>
        </div>
        <div id="auth-tabs-container"></div>
      </div>
    </div>
  `;

  const tabsContainer = container.querySelector<HTMLElement>('#auth-tabs-container')!;
  renderAuthTabs(tabsContainer, (user: User) => {
    window.location.hash = '#/dashboard';
  });
}

export function unmount(): void {}
