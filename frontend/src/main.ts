type PageModule = {
  mount(root: HTMLElement): Promise<void>;
  unmount(): void;
};

const routes: Record<string, () => Promise<PageModule>> = {
  '/dashboard':  () => import('./pages/dashboard.js'),
  '/exercises':  () => import('./pages/exercises.js'),
  '/workouts':   () => import('./pages/workouts.js'),
  '/log':        () => import('./pages/log.js'),
  '/history':    () => import('./pages/history.js'),
  '/profile':    () => import('./pages/profile.js'),
  '/login':      () => import('./pages/login.js'),
};

let currentModule: PageModule | null = null;
let mainContent: HTMLElement;

function getRoute(): string {
  const hash = window.location.hash.replace('#', '').split('?')[0] || '/login';
  return hash;
}

async function navigate(): Promise<void> {
  const route = getRoute();
  const loader = routes[route];

  // Unmount current
  if (currentModule) {
    currentModule.unmount();
    currentModule = null;
  }

  if (!loader) {
    if (route !== '/login') {
      window.location.hash = '#/dashboard';
    }
    return;
  }

  // Update active nav
  document.querySelectorAll('.nav__link').forEach(link => {
    link.classList.toggle('nav__link--active', link.getAttribute('href') === `#${route}`);
  });

  // Show/hide nav for login page
  const nav = document.querySelector('.sidebar');
  if (nav) {
    (nav as HTMLElement).style.display = route === '/login' ? 'none' : '';
  }
  mainContent.classList.toggle('main--full', route === '/login');

  // Rebuild sidebar to reflect current user (e.g. after login)
  if (route !== '/login' && (window as any).__rebuildSidebar) {
    (window as any).__rebuildSidebar();
  }

  mainContent.innerHTML = '<div class="loading system-text">Inizializzazione...</div>';

  try {
    const mod = await loader();
    currentModule = mod;
    mainContent.innerHTML = '';
    await mod.mount(mainContent);
  } catch (err) {
    console.error('Page load error:', err);
    mainContent.innerHTML = '<div class="empty-state">Errore nel caricamento della pagina.</div>';
  }
}

function initCursor(): void {
  const ring = document.getElementById('cursor-ring');
  const dot  = document.getElementById('cursor-dot');
  if (!ring || !dot) return;

  // Skip on touch devices
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    // Dot follows instantly
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
  });

  // Ring follows with easing
  function animateRing(): void {
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    ring!.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
    requestAnimationFrame(animateRing);
  }
  animateRing();

  document.addEventListener('mousedown', () => {
    ring.classList.add('cursor--click');
    dot.classList.add('cursor--click');
  });
  document.addEventListener('mouseup', () => {
    ring.classList.remove('cursor--click');
    dot.classList.remove('cursor--click');
  });

  // Hide cursor when leaving viewport
  document.addEventListener('mouseleave', () => {
    ring.style.opacity = '0';
    dot.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    ring.style.opacity = '1';
    dot.style.opacity = '1';
  });
}

async function initCapacitor(): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;

    // Handle Android hardware back button
    const { App: CapApp } = await import('@capacitor/app');
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    });
  } catch {
    // Not running in Capacitor context, ignore
  }
}

function init(): void {
  mainContent = document.getElementById('main-content')!;
  initCursor();
  initCapacitor();

  // Build sidebar nav
  const sidebar = document.querySelector('.sidebar')!;

  // Read cached user info (set during login)
  function getCachedUser(): { username?: string; pfp_url?: string; role?: string } {
    try { return JSON.parse(localStorage.getItem('auth_user') ?? '{}'); } catch { return {}; }
  }

  const doLogout = async () => {
    try {
      const { post } = await import('./api/client.js');
      await post('/auth/logout', {});
    } catch {}
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.hash = '#/login';
  };

  function buildSidebar(): void {
    const u = getCachedUser();
    const pfpSrc = u.pfp_url
      ? u.pfp_url
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username ?? 'U')}&background=0a0e17&color=00e5ff&size=64`;

    sidebar.innerHTML = `
      <div class="sidebar__logo">
        <span class="logo-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M16 2 L28 10 L24 28 L8 28 L4 10 Z" stroke-linejoin="miter"/>
            <path d="M16 8 L22 13 L20 22 L12 22 L10 13 Z" stroke-linejoin="miter"/>
            <circle cx="16" cy="16" r="2" fill="currentColor"/>
          </svg>
        </span>
        <span class="logo-text">WL</span>
      </div>
      <nav class="nav">
        <a href="#/dashboard" class="nav__link" data-page="dashboard">
          <span class="nav__icon" aria-hidden="true">&#9670;</span>
          <span class="nav__label">Status</span>
        </a>
        <a href="#/exercises" class="nav__link" data-page="exercises">
          <span class="nav__icon" aria-hidden="true">&#9650;</span>
          <span class="nav__label">Esercizi</span>
        </a>
        <a href="#/workouts" class="nav__link" data-page="workouts">
          <span class="nav__icon" aria-hidden="true">&#9636;</span>
          <span class="nav__label">Schede</span>
        </a>
        <a href="#/log" class="nav__link" data-page="log">
          <span class="nav__icon" aria-hidden="true">&#9658;</span>
          <span class="nav__label">Allenamento</span>
        </a>
        <a href="#/history" class="nav__link" data-page="history">
          <span class="nav__icon" aria-hidden="true">&#9719;</span>
          <span class="nav__label">Cronologia</span>
        </a>
        <a href="#/profile" class="nav__link" data-page="profile">
          <span class="nav__icon" aria-hidden="true">
            <img class="sidebar-avatar" src="${pfpSrc}" alt="" width="20" height="20" style="border-radius:50%;object-fit:cover;vertical-align:middle" />
          </span>
          <span class="nav__label">${u.username ?? 'Profilo'}</span>
        </a>
        <button class="nav__link nav__link--logout" id="btn-logout-mobile" aria-label="Logout">
          <span class="nav__icon" aria-hidden="true">&#10006;</span>
          <span class="nav__label">Esci</span>
        </button>
      </nav>
      <div class="sidebar__footer">
        <button class="btn btn--ghost btn--sm" id="btn-logout">Logout</button>
      </div>
    `;

    document.getElementById('btn-logout')!.addEventListener('click', doLogout);
    document.getElementById('btn-logout-mobile')!.addEventListener('click', doLogout);

    // Re-apply active state
    const route = getRoute();
    document.querySelectorAll('.nav__link').forEach(link => {
      link.classList.toggle('nav__link--active', link.getAttribute('href') === `#${route}`);
    });
  }

  buildSidebar();
  // Expose for profile page to trigger rebuild
  (window as any).__rebuildSidebar = buildSidebar;

  window.addEventListener('hashchange', navigate);
  navigate();
}

document.addEventListener('DOMContentLoaded', init);
