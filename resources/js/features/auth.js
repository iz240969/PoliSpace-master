// ==================== AUTH ====================
function clearInlineFieldErrors(scope = document) {
  scope.querySelectorAll('.field-error-message').forEach((message) => message.remove());
  scope.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
}

function showInlineFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const group = field?.closest('.form-group');
  if (!field || !group) return;
  field.setAttribute('aria-invalid', 'true');
  const feedback = document.createElement('span');
  feedback.className = 'field-error-message';
  feedback.innerHTML = `<i class="bi bi-exclamation-circle" aria-hidden="true"></i>${escapeHtml(message)}`;
  group.appendChild(feedback);
}

function setActionButtonLoading(button, loading, idleHtml, loadingLabel) {
  if (!button) return;
  button.disabled = loading;
  button.innerHTML = loading ? `<i class="bi bi-arrow-repeat"></i>${escapeHtml(loadingLabel)}` : idleHtml;
}

async function doAutoLogin() {
  const email = document.getElementById('login-email')?.value.trim() || '';
  const password = document.getElementById('login-password')?.value || '';
  const errorEl = document.getElementById('loginError');
  const form = document.querySelector('.unified-login-card form');
  const submitButton = document.getElementById('authLoginButton');

  if (errorEl) errorEl.classList.remove('show');
  if (form) clearInlineFieldErrors(form);

  if (!isValidEmail(email) || !password) {
    if (!isValidEmail(email)) showInlineFieldError('login-email', 'Masukkan alamat e-mel yang sah.');
    if (!password) showInlineFieldError('login-password', 'Masukkan kata laluan.');
    if (errorEl) {
      errorEl.textContent = 'Sila masukkan e-mel dan kata laluan yang sah.';
      errorEl.classList.add('show');
    } else {
      showToast('Sila masukkan e-mel dan kata laluan yang sah.', 'error');
    }
    return;
  }

  setActionButtonLoading(submitButton, true, '<i class="bi bi-box-arrow-in-right"></i> Log Masuk', 'Sedang log masuk');
  try {
    const result = await autoLogin(email, password);
    if (result.role === 'admin') {
      localStorage.setItem('ps_admin_logged_in', '1');
      localStorage.removeItem('ps_user_email');
    } else {
      localStorage.removeItem('ps_admin_logged_in');
      localStorage.setItem('ps_user_email', result.email || email);
    }
    window.location.href = result.role === 'admin' ? ROUTES.adminDashboard : ROUTES.dashboard;
  } catch (error) {
    if (errorEl) {
      errorEl.textContent = error.message || 'E-mel atau kata laluan tidak sah.';
      errorEl.classList.add('show');
    } else {
      showToast(error.message || 'Log masuk gagal.', 'error');
    }
  } finally {
    setActionButtonLoading(submitButton, false, '<i class="bi bi-box-arrow-in-right"></i> Log Masuk', 'Sedang log masuk');
  }
}

async function doLogin() {
  const userEl = document.getElementById('login-user');
  const passEl = document.getElementById('login-pass');
  const errorEl = document.getElementById('loginError');
  const submitButton = document.getElementById('adminLoginButton');
  const rawUser = userEl?.value.trim() || '';
  const password = passEl?.value || '';
  const email = rawUser.includes('@') ? rawUser : 'admin@polspace.com';

  clearInlineFieldErrors(document);
  if (!isValidEmail(email) || !password) {
    if (!isValidEmail(email)) showInlineFieldError('login-user', 'Masukkan alamat e-mel admin yang sah.');
    if (!password) showInlineFieldError('login-pass', 'Masukkan kata laluan.');
    return;
  }

  setActionButtonLoading(submitButton, true, 'Log Masuk', 'Sedang log masuk');
  try {
    await adminLogin(email, password);
    localStorage.setItem('ps_admin_logged_in', '1');
    window.location.href = ROUTES.adminDashboard;
  } catch (error) {
    if (errorEl) {
      errorEl.textContent = error.message || 'Nama pengguna atau kata laluan tidak sah.';
      errorEl.classList.add('show');
      errorEl.style.display = 'block';
    }
  } finally {
    setActionButtonLoading(submitButton, false, 'Log Masuk', 'Sedang log masuk');
  }
}

async function doUserLogin() {
  const email = document.getElementById('user-email')?.value.trim() || '';
  const password = document.getElementById('user-pass')?.value || '';
  if (!isValidEmail(email)) {
    showToast('Sila masukkan alamat e-mel yang sah.', 'error');
    return;
  }
  if (!password) {
    showToast('Sila masukkan kata laluan pelanggan.', 'error');
    return;
  }

  try {
    await userLogin(email);
    localStorage.setItem('ps_user_email', email);
    window.location.href = ROUTES.dashboard;
  } catch (error) {
    showToast(error.message || 'Log masuk pengguna gagal.', 'error');
    return;
  }
}

async function doLogout() {
  try {
    await authRequest('logout', {});
  } catch (error) {
    // Local cleanup still matters if the API is unreachable.
  }
  localStorage.removeItem('ps_admin_logged_in');
  localStorage.removeItem('ps_user_email');
  window.location.href = ROUTES.home;
}

async function logoutUser() {
  try {
    await authRequest('logout', {});
  } catch (error) {
    // Local cleanup still matters if the API is unreachable.
  }
  localStorage.removeItem('ps_user_email');
  localStorage.removeItem('ps_admin_logged_in');
  window.location.href = ROUTES.login;
}
