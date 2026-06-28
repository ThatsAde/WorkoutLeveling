import { getProfile, updateProfile, uploadPfp } from '../api/profile.js';
import { toastSuccess, toastError } from '../components/toast.js';
import type { User } from '../types/index.js';

let container: HTMLElement;
let currentUser: User | null = null;

export async function mount(root: HTMLElement): Promise<void> {
  container = root;

  container.innerHTML = `
    <div class="page-header">
      <h1><span class="glow-text">PROFILO</span></h1>
    </div>
    <div id="profile-content" class="profile-content">
      <div class="loading system-text">Caricamento...</div>
    </div>
  `;

  try {
    const res = await getProfile();
    currentUser = res.data;
    renderProfile();
  } catch {
    toastError('Errore nel caricamento del profilo');
  }
}

export function unmount(): void {}

function renderProfile(): void {
  if (!currentUser) return;
  const u = currentUser;

  const pfpSrc = u.pfp_url
    ? u.pfp_url
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=0a0e17&color=00e5ff&size=128`;

  const emailVerifiedBadge = u.email
    ? u.email_verified_at
      ? `<span class="badge badge--success" style="margin-left:var(--space-sm)">✓ Verificata</span>`
      : `<span class="badge badge--warning" style="margin-left:var(--space-sm)">⚠ Non verificata</span>`
    : '';

  const joinDate = u.created_at ? new Date(u.created_at).toLocaleDateString('it-IT', { year: 'numeric', month: 'long' }) : '';

  const roleLabel: Record<string, string> = { user: 'HUNTER', moderator: 'MODERATORE', admin: 'ADMIN' };

  container.querySelector('#profile-content')!.innerHTML = `
    <div class="profile-grid">

      <!-- Left: Avatar + basic info -->
      <div class="profile-card card card--system">
        <div class="profile-avatar-wrap">
          <img class="profile-avatar" id="profile-pfp-img" src="${pfpSrc}" alt="Avatar di ${u.username}" />
          <button class="btn btn--ghost btn--sm profile-avatar__btn" id="btn-change-pfp" title="Cambia foto">
            <span>&#9998;</span>
          </button>
          <input type="file" id="pfp-file-input" accept="image/*" style="display:none" />
        </div>
        <h2 class="profile-username system-text">${u.username}</h2>
        <div class="profile-role-badge">${roleLabel[u.role] ?? u.role}</div>
        ${joinDate ? `<p class="text-muted profile-join">Dal ${joinDate}</p>` : ''}
      </div>

      <!-- Right: Edit form -->
      <div class="card card--system" style="padding:var(--space-lg)">
        <h3 class="system-text" style="margin-bottom:var(--space-lg)">IMPOSTAZIONI ACCOUNT</h3>

        <form id="profile-edit-form">
          <div class="form-group">
            <label class="form-label">BIO</label>
            <textarea class="form-input form-textarea" name="bio" rows="3" placeholder="Descrivi il tuo training...">${u.bio ?? ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">EMAIL ${emailVerifiedBadge}</label>
            <input class="form-input" name="email" type="email" value="${u.email ?? ''}" placeholder="hunter@example.com" />
            ${u.email && !u.email_verified_at
              ? `<button type="button" class="btn btn--ghost btn--sm" id="btn-resend-verify" style="margin-top:var(--space-xs)">Reinvia verifica</button>`
              : ''}
          </div>

          <details style="margin-bottom:var(--space-md)">
            <summary class="form-label" style="cursor:pointer">CAMBIA PASSWORD</summary>
            <div style="padding-top:var(--space-md)">
              <div class="form-group">
                <label class="form-label">PASSWORD ATTUALE</label>
                <input class="form-input" name="current_password" type="password" placeholder="••••••••" autocomplete="current-password" />
              </div>
              <div class="form-group">
                <label class="form-label">NUOVA PASSWORD</label>
                <input class="form-input" name="new_password" type="password" placeholder="Min. 8 caratteri" autocomplete="new-password" />
              </div>
            </div>
          </details>

          <button type="submit" class="btn btn--primary btn--glow">SALVA MODIFICHE</button>
        </form>
      </div>

    </div>
  `;

  // PFP change
  const pfpBtn = container.querySelector('#btn-change-pfp')!;
  const pfpInput = container.querySelector<HTMLInputElement>('#pfp-file-input')!;
  pfpBtn.addEventListener('click', () => pfpInput.click());
  pfpInput.addEventListener('change', handlePfpChange);

  // Resend verify
  container.querySelector('#btn-resend-verify')?.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/verify-email/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('auth_token') ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } : {}),
        },
        credentials: 'include',
      });
      toastSuccess('Email di verifica inviata (o token salvato nel DB)');
    } catch {
      toastError('Errore nell\'invio');
    }
  });

  // Edit form
  const form = container.querySelector<HTMLFormElement>('#profile-edit-form')!;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload: Record<string, string | undefined> = {};

    const bio = String(fd.get('bio') ?? '').trim();
    payload['bio'] = bio;

    const email = String(fd.get('email') ?? '').trim();
    payload['email'] = email;

    const currentPw = String(fd.get('current_password') ?? '').trim();
    const newPw     = String(fd.get('new_password') ?? '').trim();
    if (newPw) {
      if (!currentPw) { toastError('Inserisci la password attuale'); return; }
      if (newPw.length < 8) { toastError('La nuova password deve avere almeno 8 caratteri'); return; }
      payload['current_password'] = currentPw;
      payload['new_password'] = newPw;
    }

    try {
      const res = await updateProfile(payload);
      currentUser = res.data;
      // Update cached user info
      const cached = JSON.parse(localStorage.getItem('auth_user') ?? '{}');
      localStorage.setItem('auth_user', JSON.stringify({ ...cached, pfp_url: currentUser.pfp_url }));
      toastSuccess('Profilo aggiornato!');
      renderProfile();
    } catch (err: any) {
      toastError(err?.error?.message ?? 'Errore nel salvataggio');
    }
  });
}

async function handlePfpChange(): Promise<void> {
  const input = container.querySelector<HTMLInputElement>('#pfp-file-input')!;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const res = await uploadPfp(file);
    const pfpUrl = (res as any)?.data?.pfp_url ?? (res as any)?.pfp_url;
    if (pfpUrl && currentUser) {
      currentUser.pfp_url = pfpUrl;
      // Update img
      const img = container.querySelector<HTMLImageElement>('#profile-pfp-img');
      if (img) img.src = pfpUrl;
      // Update sidebar avatar
      updateSidebarAvatar(pfpUrl);
      // Update cached
      const cached = JSON.parse(localStorage.getItem('auth_user') ?? '{}');
      localStorage.setItem('auth_user', JSON.stringify({ ...cached, pfp_url: pfpUrl }));
      toastSuccess('Foto profilo aggiornata!');
    }
  } catch (err: any) {
    toastError(err?.error?.message ?? 'Errore nel caricamento della foto');
  }
}

function updateSidebarAvatar(pfpUrl: string): void {
  const avatarEl = document.querySelector<HTMLImageElement>('.sidebar-avatar');
  if (avatarEl) avatarEl.src = pfpUrl;
}
