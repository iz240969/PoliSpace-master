// ==================== NAVIGATION ACCESS ====================
let psAuthState = {
  checked: false,
  role: null,
  user: null,
};
let psAuthRequest = null;
let psClientNavigationPending = false;

function refreshAuthState() {
  if (!psAuthRequest) psAuthRequest = fetchAuthState().finally(() => { psAuthRequest = null; });
  return psAuthRequest;
}

async function fetchAuthState() {
  try {
    const result = await getCurrentUser();
    psAuthState = {
      checked: true,
      role: result.role || null,
      user: result.user || null,
    };
    syncStoredAuthState();
  } catch (error) {
    const adminEmail = localStorage.getItem('ps_admin_logged_in') === '1';
    const userEmail = localStorage.getItem('ps_user_email') || '';
    const hadStoredSession = adminEmail || isValidEmail(userEmail);
    const canKeepReadOnlySession = Boolean(error.networkFailure || error.offline || error.status >= 500);
    if (canKeepReadOnlySession && adminEmail) {
      psAuthState = { checked: true, role: 'admin', user: null };
    } else if (canKeepReadOnlySession && isValidEmail(userEmail)) {
      psAuthState = { checked: true, role: 'user', user: { email: userEmail } };
    } else {
      psAuthState = { checked: true, role: null, user: null };
      if (hadStoredSession && [401, 419].includes(error.status)) {
        psAuthState.sessionExpired = true;
        showToast('Sesi anda telah tamat. Sila log masuk semula.', 'error');
        const loginRoute = adminEmail ? ROUTES.adminLogin : ROUTES.login;
        window.setTimeout(() => window.location.replace(loginRoute), 700);
      }
      clearStoredAuthState();
    }
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
  setupMobileNavigation();
  if (isClientLoggedIn()) ensureProfileModal();
  bindAccountMenu();
}

function setupMobileNavigation() {
  const nav = document.getElementById('main-nav');
  const navLinks = nav?.querySelector('.nav-links');
  const navActions = nav?.querySelector('.nav-actions');
  if (!nav || !navLinks || !navActions) return;

  const hasPageLinks = Boolean(navLinks.querySelector('.nav-link'));
  navLinks.id = navLinks.id || 'primaryNavigation';
  navActions.querySelector('.nav-menu-toggle')?.remove();
  if (!hasPageLinks) return;

  const toggle = document.createElement('button');
  toggle.className = 'nav-menu-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Buka menu navigasi');
  toggle.setAttribute('aria-controls', navLinks.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<i class="bi bi-list" aria-hidden="true"></i>';
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = nav.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi');
    toggle.innerHTML = `<i class="bi ${isOpen ? 'bi-x-lg' : 'bi-list'}" aria-hidden="true"></i>`;
  });
  navActions.prepend(toggle);
}

function updateProtectedNavLinks(loggedIn) {
  document.querySelectorAll('.nav-link[onclick]').forEach((button) => {
    const action = button.getAttribute('onclick') || '';
    const isProtectedLink = isProtectedRouteAction(action);

    if (!isProtectedLink) return;

    button.disabled = false;
    button.classList.remove('nav-link-disabled');
    button.title = loggedIn ? '' : 'Sila log masuk dahulu';
  });
}

function isProtectedRouteAction(action) {
  if (action.includes('navigateToClientPage(')) return true;
  return [
    ROUTES.booking,
    ROUTES.status,
    ROUTES.dashboard,
    '/resources/views/booking/index.html',
    '/resources/views/status/index.html',
    '/resources/views/dashboard/index.html',
  ].some((route) => action.includes(route));
}

async function navigateToClientPage(route) {
  if (![ROUTES.booking, ROUTES.dashboard, ROUTES.status].includes(route)) return;
  if (psClientNavigationPending) return;
  psClientNavigationPending = true;
  try {
    if (!psAuthState.checked) await refreshAuthState();
    // Resolve the destination before loading a document; avoid booking -> login.
    const destination = isAdminLoggedIn() ? ROUTES.adminDashboard : isClientLoggedIn() ? route : ROUTES.login;
    if (window.location.pathname === destination) {
      if (destination === ROUTES.login) document.getElementById('login-email')?.focus();
      return;
    }
    window.location.assign(destination);
  } finally {
    psClientNavigationPending = false;
  }
}

function updateNavActions(navActions, loggedIn) {
  if (!navActions) return;

  // Keep a neutral account icon while the session is checked, rather than
  // briefly presenting the guest menu to an authenticated user.
  if (!psAuthState.checked) {
    navActions.setAttribute('aria-busy', 'true');
    navActions.innerHTML = '<button class="btn-nav-icon" type="button" aria-label="Menyemak akaun" disabled><i class="bi bi-person-circle" aria-hidden="true"></i></button>';
    return;
  }
  navActions.setAttribute('aria-busy', 'false');

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
  const dashboardActive = document.getElementById('admin') || document.getElementById('dashboard');
  const bookingCartButton = isClientLoggedIn() && document.getElementById('booking')
    ? `
        <button class="btn-nav-icon booking-cart-nav" type="button" onclick="openBookingCart()" title="Lihat troli tempahan" aria-label="Lihat troli tempahan">
          <i class="bi bi-cart3"></i>
          <span class="booking-cart-count" id="bookingCartCount" aria-label="0 item dalam troli">0</span>
        </button>
      `
    : '';
  const menuItems = isAdminLoggedIn()
    ? `
        <button class="account-dropdown-item" type="button" onclick="${logoutHandler}">
          <i class="bi bi-box-arrow-right"></i>
          <span>Log Keluar</span>
        </button>
      `
    : `
        <button class="account-dropdown-item" type="button" onclick="openProfileModal()">
          <i class="bi bi-person-gear"></i>
          <span>Edit Profil</span>
        </button>
        <button class="account-dropdown-item" type="button" onclick="${logoutHandler}">
          <i class="bi bi-box-arrow-right"></i>
          <span>Log Keluar</span>
        </button>
      `;

  navActions.innerHTML = `
    ${bookingCartButton}
    <div class="account-menu">
      <button class="btn-nav-icon account-menu-trigger ${dashboardActive ? 'active' : ''}" type="button" aria-label="Menu akaun" aria-expanded="false">
        <i class="bi bi-person-circle"></i>
      </button>
      <div class="account-dropdown" role="menu">
        ${menuItems}
      </div>
    </div>
  `;
}

function ensureProfileModal() {
  if (document.getElementById('profileModal')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="profileModal">
      <div class="modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profileModalTitle">
        <div class="modal-header">
          <div class="modal-title" id="profileModalTitle"><i class="bi bi-person-gear modal-title-icon"></i> Edit Profil</div>
          <button class="modal-close" type="button" onclick="closeModal('profileModal')" aria-label="Tutup"><i class="bi bi-x-lg"></i></button>
        </div>
        <form onsubmit="saveUserProfile(event)">
          <div class="modal-body profile-form">
            <div class="form-group">
              <label for="profileName">Nama Penuh *</label>
              <input type="text" id="profileName" maxlength="100" autocomplete="name" required>
            </div>
            <div class="form-group">
              <label for="profileEmail">Alamat E-mel</label>
              <input class="profile-readonly" type="email" id="profileEmail" autocomplete="email" readonly>
            </div>
            <div class="form-group">
              <label for="profilePhone">No Telefon</label>
              <input type="tel" id="profilePhone" maxlength="20" autocomplete="tel" placeholder="Contoh: 012-3456789">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" type="button" onclick="closeModal('profileModal')">Batal</button>
            <button class="btn btn-primary" id="saveProfileButton" type="submit"><i class="bi bi-check-lg"></i> Simpan</button>
          </div>
        </form>
      </div>
    </div>
  `);
}

function openProfileModal() {
  ensureProfileModal();
  const user = psAuthState.user || {};
  document.getElementById('profileName').value = user.name || '';
  document.getElementById('profileEmail').value = user.email || localStorage.getItem('ps_user_email') || '';
  document.getElementById('profilePhone').value = user.phone || '';
  document.querySelector('.account-menu')?.classList.remove('is-open');
  document.querySelector('.account-menu-trigger')?.setAttribute('aria-expanded', 'false');
  document.getElementById('profileModal')?.classList.add('active');
  document.getElementById('profileName')?.focus();
}

async function saveUserProfile(event) {
  event.preventDefault();
  const name = document.getElementById('profileName')?.value.trim() || '';
  const phone = document.getElementById('profilePhone')?.value.trim() || '';
  const saveButton = document.getElementById('saveProfileButton');

  if (name.length < 2) {
    showToast('Nama penuh mesti mengandungi sekurang-kurangnya 2 aksara.', 'error');
    return;
  }

  if (phone && !/^[0-9+()\-\s]{7,20}$/.test(phone)) {
    showToast('Sila masukkan nombor telefon yang sah.', 'error');
    return;
  }

  if (saveButton) setButtonLoading(saveButton, true, 'Menyimpan profil...');

  try {
    const result = await apiRequest('auth.php?action=profile', 'PUT', { full_name: name, phone });
    psAuthState.user = result.user;
    const bookingName = document.getElementById('f-name');
    const bookingPhone = document.getElementById('f-phone');
    if (bookingName) bookingName.value = result.user.name || '';
    if (bookingPhone) bookingPhone.value = result.user.phone || '';
    closeModal('profileModal');
    showToast('Profil berjaya dikemas kini.', 'success');
  } catch (error) {
    showToast(error.message || 'Profil tidak dapat dikemas kini.', 'error');
  } finally {
    if (saveButton) setButtonLoading(saveButton, false);
  }
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
  if (accountMenu && !accountMenu.contains(event.target)) {
    accountMenu.classList.remove('is-open');
    document.querySelector('.account-menu-trigger')?.setAttribute('aria-expanded', 'false');
  }

  const nav = document.getElementById('main-nav');
  if (nav && !nav.contains(event.target)) closeMobileNavigation();
});

function closeMobileNavigation() {
  const nav = document.getElementById('main-nav');
  const toggle = nav?.querySelector('.nav-menu-toggle');
  if (!nav || !toggle) return;
  nav.classList.remove('menu-open');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Buka menu navigasi');
  toggle.innerHTML = '<i class="bi bi-list" aria-hidden="true"></i>';
}

// The administrative drawer is independent of public navigation.
function toggleAdminNavigation() {
  if (document.body.classList.contains('admin-menu-open')) {
    closeAdminNavigation();
    return;
  }
  const sidebar = document.getElementById('adminSidebar');
  if (!sidebar) return;
  document.body.classList.add('admin-menu-open');
  document.querySelector('.admin-nav-toggle')?.setAttribute('aria-expanded', 'true');
  document.querySelector('.admin-nav-backdrop').hidden = false;
  document.getElementById('adminWorkspace').inert = true;
  document.getElementById('main-nav').inert = true;
  sidebar.querySelector('.admin-menu-item.active')?.focus();
}

function closeAdminNavigation(returnFocus = true) {
  const wasOpen = document.body.classList.contains('admin-menu-open');
  document.body.classList.remove('admin-menu-open');
  document.querySelector('.admin-nav-toggle')?.setAttribute('aria-expanded', 'false');
  const backdrop = document.querySelector('.admin-nav-backdrop');
  if (backdrop) backdrop.hidden = true;
  const workspace = document.getElementById('adminWorkspace');
  if (workspace) workspace.inert = false;
  const nav = document.getElementById('main-nav');
  if (nav) nav.inert = false;
  if (wasOpen && returnFocus) document.querySelector('.admin-nav-toggle')?.focus();
}

function setupAdminWorkspace() {
  if (!document.getElementById('adminSidebar')) return;
  document.querySelector('.admin-menu-item.active')?.setAttribute('aria-current', 'page');
  window.matchMedia('(max-width: 1024px)').addEventListener('change', () => closeAdminNavigation(false));
}

function trapSurfaceFocus(event, surface) {
  if (event.key !== 'Tab' || !surface) return;
  const controls = [...surface.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')]
    .filter((element) => !element.disabled && !element.closest('[inert]') && element.getClientRects().length);
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (!first) { event.preventDefault(); surface.focus(); return; }
  if (event.shiftKey && (document.activeElement === first || !surface.contains(document.activeElement))) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !surface.contains(document.activeElement))) {
    event.preventDefault(); first.focus();
  }
}

// Keep dynamically rendered dialogs and scrollable tables keyboard accessible.
function setupSurfaceAccessibility() {
  const dialogState = new Map();
  let lastOutsideDialogFocus = document.activeElement;
  document.addEventListener('focusin', (event) => {
    if (!event.target.closest('.modal-overlay')) lastOutsideDialogFocus = event.target;
  });
  const update = () => {
    document.querySelectorAll('.data-table-wrap, .dash-table-wrap').forEach((wrap) => {
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', 'Jadual data, tatal ke sisi untuk melihat semua lajur');
    });
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      const dialog = overlay.querySelector('.modal');
      if (!dialog) return;
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.tabIndex = -1;
      const title = dialog.querySelector('.modal-title');
      if (title) {
        title.id = title.id || `${overlay.id || 'polispace'}Title`;
        dialog.setAttribute('aria-labelledby', title.id);
      }
      dialog.querySelectorAll('.modal-close').forEach((button) => button.setAttribute('aria-label', 'Tutup dialog'));
      const open = overlay.classList.contains('active');
      if (open && !dialogState.has(overlay)) {
        dialogState.set(overlay, lastOutsideDialogFocus);
        if (!dialog.contains(document.activeElement)) dialog.focus();
      } else if (!open && dialogState.has(overlay)) {
        const trigger = dialogState.get(overlay);
        dialogState.delete(overlay);
        if (trigger?.isConnected && !trigger.closest('.modal-overlay')) trigger.focus();
      }
    });
    const hasDialog = dialogState.size > 0;
    if (document.body.classList.contains('dialog-open') !== hasDialog) document.body.classList.toggle('dialog-open', hasDialog);
  };
  update();
  new MutationObserver(update).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

document.addEventListener('keydown', (event) => {
  const modals = document.querySelectorAll('.modal-overlay.active .modal');
  const surface = modals.length ? modals[modals.length - 1]
    : document.body.classList.contains('admin-menu-open') ? document.getElementById('adminSidebar') : null;
  trapSurfaceFocus(event, surface);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  document.querySelector('.account-menu')?.classList.remove('is-open');
  document.querySelector('.account-menu-trigger')?.setAttribute('aria-expanded', 'false');
  closeMobileNavigation();
  closeAdminNavigation();
  if (typeof closeBookingCart === 'function') closeBookingCart();

  const activeModals = document.querySelectorAll('.modal-overlay.active');
  const activeModal = activeModals[activeModals.length - 1];
  if (activeModal) activeModal.classList.remove('active');
});

function protectLoggedInPages() {
  const needsClientLogin = document.getElementById('booking')
    || document.getElementById('status')
    || document.getElementById('dashboard');

  if (needsClientLogin && isAdminLoggedIn()) {
    window.location.replace(ROUTES.adminDashboard);
    return false;
  }

  if (needsClientLogin && !isClientLoggedIn()) {
    if (psAuthState.sessionExpired) return false;
    window.location.replace(ROUTES.login);
    return false;
  }
  return true;
}

