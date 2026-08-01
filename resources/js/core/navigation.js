// ==================== NAVIGATION ACCESS ====================
let psAuthState = {
  checked: false,
  role: null,
  user: null,
};

async function refreshAuthState() {
  try {
    const result = await getCurrentUser();
    psAuthState = {
      checked: true,
      role: result.role || null,
      user: result.user || null,
    };
    syncStoredAuthState();
  } catch (error) {
    psAuthState = {
      checked: true,
      role: null,
      user: null,
    };
    clearStoredAuthState();
  }
  return psAuthState;
}

function syncStoredAuthState() {
  if (psAuthState.role === 'admin') {
    localStorage.setItem('ps_admin_logged_in', '1');
    localStorage.removeItem('ps_user_email');
    return;
  }

  if (psAuthState.role === 'user' && isValidEmail(psAuthState.user?.email || '')) {
    localStorage.removeItem('ps_admin_logged_in');
    localStorage.setItem('ps_user_email', psAuthState.user.email);
    return;
  }

  clearStoredAuthState();
}

function clearStoredAuthState() {
  localStorage.removeItem('ps_user_email');
  localStorage.removeItem('ps_admin_logged_in');
}

function isClientLoggedIn() {
  return psAuthState.role === 'user' && isValidEmail(psAuthState.user?.email || localStorage.getItem('ps_user_email') || '');
}

function isAdminLoggedIn() {
  return psAuthState.role === 'admin';
}

function isLoggedIn() {
  return isClientLoggedIn() || isAdminLoggedIn();
}

function setupNavigationAccess() {
  const loggedIn = psAuthState.checked && isLoggedIn();
  const navActions = document.querySelector('#main-nav .nav-actions');

  updateProtectedNavLinks(loggedIn);
  updateNavActions(navActions, loggedIn);
  bindAccountMenu();
}

function updateProtectedNavLinks(loggedIn) {
  document.querySelectorAll('button[onclick]').forEach((button) => {
    const action = button.getAttribute('onclick') || '';
    const isProtectedLink = isProtectedRouteAction(action);

    if (!isProtectedLink) return;

    button.disabled = !loggedIn;
    button.classList.toggle('nav-link-disabled', !loggedIn);
    button.title = loggedIn ? '' : 'Sila log masuk dahulu';
  });
}

function isProtectedRouteAction(action) {
  return [
    ROUTES.booking,
    ROUTES.status,
    ROUTES.dashboard,
    '/resources/views/booking/index.html',
    '/resources/views/status/index.html',
    '/resources/views/dashboard/index.html',
  ].some((route) => action.includes(route));
}

function updateNavActions(navActions, loggedIn) {
  if (!navActions) return;

  if (!loggedIn) {
    navActions.innerHTML = `
      <div class="account-menu">
        <button class="btn-nav-icon account-menu-trigger" type="button" aria-label="Menu akaun" aria-expanded="false">
          <i class="bi bi-person-circle"></i>
        </button>
        <div class="account-dropdown" role="menu">
          <button class="account-dropdown-item is-disabled" type="button" disabled>
            <i class="bi bi-speedometer2"></i>
            <span>Dashboard</span>
          </button>
          <button class="account-dropdown-item" type="button" onclick="window.location.href='${ROUTES.login}'">
            <i class="bi bi-box-arrow-in-right"></i>
            <span>Log Masuk</span>
          </button>
          <button class="account-dropdown-item" type="button" onclick="window.location.href='${ROUTES.signup}'">
            <i class="bi bi-person-plus"></i>
            <span>Daftar Akaun</span>
          </button>
        </div>
      </div>
    `;
    return;
  }

  const logoutHandler = isAdminLoggedIn() ? 'doLogout()' : 'logoutUser()';
  const dashboardRoute = isAdminLoggedIn() ? ROUTES.adminDashboard : ROUTES.dashboard;
  const dashboardActive = document.getElementById('admin') || document.getElementById('dashboard');
  navActions.innerHTML = `
    <div class="account-menu">
      <button class="btn-nav-icon account-menu-trigger ${dashboardActive ? 'active' : ''}" type="button" aria-label="Menu akaun" aria-expanded="false">
        <i class="bi bi-person-circle"></i>
      </button>
      <div class="account-dropdown" role="menu">
        <button class="account-dropdown-item" type="button" onclick="window.location.href='${ROUTES.home}'">
          <i class="bi bi-house-door"></i>
          <span>Laman Utama</span>
        </button>
        <button class="account-dropdown-item" type="button" onclick="window.location.href='${dashboardRoute}'">
          <i class="bi bi-speedometer2"></i>
          <span>Dashboard</span>
        </button>
        <button class="account-dropdown-item" type="button" onclick="${logoutHandler}">
          <i class="bi bi-box-arrow-right"></i>
          <span>Log Keluar</span>
        </button>
      </div>
    </div>
  `;
}

function bindAccountMenu() {
  const accountMenu = document.querySelector('.account-menu');
  const trigger = document.querySelector('.account-menu-trigger');
  if (!accountMenu || !trigger) return;

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = accountMenu.classList.toggle('is-open');
    trigger.setAttribute('aria-expanded', String(isOpen));
  });
}

document.addEventListener('click', (event) => {
  const accountMenu = document.querySelector('.account-menu');
  if (!accountMenu || accountMenu.contains(event.target)) return;

  accountMenu.classList.remove('is-open');
  document.querySelector('.account-menu-trigger')?.setAttribute('aria-expanded', 'false');
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  document.querySelector('.account-menu')?.classList.remove('is-open');
  document.querySelector('.account-menu-trigger')?.setAttribute('aria-expanded', 'false');
});

function protectLoggedInPages() {
  const needsClientLogin = document.getElementById('booking')
    || document.getElementById('status')
    || document.getElementById('dashboard');

  if (needsClientLogin && !isLoggedIn()) {
    window.location.href = ROUTES.login;
  }
}

