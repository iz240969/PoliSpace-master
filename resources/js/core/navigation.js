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
  if (isClientLoggedIn()) ensureProfileModal();
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
  const dashboardActive = document.getElementById('admin') || document.getElementById('dashboard');
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

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-arrow-repeat"></i> Menyimpan';
  }

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
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.innerHTML = '<i class="bi bi-check-lg"></i> Simpan';
    }
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

