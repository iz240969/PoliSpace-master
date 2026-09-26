// ==================== API HELPERS ====================
const API_TIMEOUT_DEFAULT = 20000;
const API_TIMEOUT_BOOKING = 60000;
const API_TIMEOUT_UPLOAD = 120000;
const pendingMutationRequests = new Map();

function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function createNetworkError(message, details = {}) {
  const error = new Error(message);
  error.networkFailure = true;
  Object.assign(error, details);
  return error;
}

function sanitizeApiErrorMessage(message, fallbackMessage) {
  const value = typeof message === 'string' ? message.trim() : '';
  if (!value) return fallbackMessage;

  const technicalDetails = /SQLSTATE|PDOException|mysqli(?:_sql)?_exception|Fatal error|PHP (?:Warning|Notice|Fatal)|stack\s*trace|\.php(?::\d+)?|SQL syntax|unknown column|uncaught exception|\bException\b|undefined (?:index|array key)|call to undefined|traceback/i;
  if (technicalDetails.test(value)) return 'Permintaan gagal. Sila cuba lagi.';
  const translations = new Map([
    ['invalid credentials', 'E-mel atau kata laluan tidak sah.'],
    ['email and password required', 'Sila masukkan e-mel dan kata laluan.'],
    ['valid email required', 'Sila masukkan alamat e-mel yang sah.'],
    ['login required', 'Sila log masuk untuk meneruskan.'],
    ['user login required', 'Sila log masuk untuk meneruskan.'],
    ['admin login required', 'Sila log masuk sebagai pentadbir untuk meneruskan.'],
    ['booking not found', 'Tempahan tidak dijumpai.'],
    ['facility not found', 'Fasiliti tidak dijumpai.'],
    ['client not found', 'Pelanggan tidak dijumpai.'],
    ['message not found', 'Mesej tidak dijumpai.'],
    ['invalid booking request', 'Permohonan tempahan tidak sah.'],
    ['receipt upload failed', 'Muat naik gagal. Sila cuba lagi.'],
    ['receipt upload is required', 'Sila pilih fail resit dahulu.'],
    ['invalid receipt file', 'Fail resit tidak sah. Sila pilih fail yang disokong.'],
    ['unsupported receipt type', 'Jenis fail resit tidak disokong.'],
    ['validation failed', 'Sila semak semula maklumat yang diisi.'],
    ['method not allowed', 'Permintaan tidak dapat diproses.'],
  ]);
  if (translations.has(value.toLowerCase())) return translations.get(value.toLowerCase());
  return value;
}

function serverFailureMessage(url, fallbackMessage) {
  const target = String(url || '').toLowerCase();
  if (/test-email|email/.test(target)) return 'E-mel tidak dapat dihantar. Sila cuba lagi.';
  if (/action=receipt|receipts\.php/.test(target)) return 'Muat naik gagal. Sila cuba lagi.';
  return sanitizeApiErrorMessage(fallbackMessage, 'Permintaan gagal. Sila cuba lagi.');
}

function handleApiSessionExpiry(response, url, error) {
  if (![401, 419].includes(response.status) || /auth\.php\?action=(?:me|login|user|auto|signup|logout)/i.test(url)) return;
  if (typeof psAuthState === 'undefined' || !psAuthState?.role) return;

  const expiredRole = psAuthState.role;
  if (error) {
    error.sessionRedirectPending = true;
    error.message = 'Sesi anda telah tamat. Sila log masuk semula.';
  }
  showToast('Sesi anda telah tamat. Sila log masuk semula.', 'error');
  clearStoredAuthState();
  psAuthState = { checked: true, role: null, user: null };
  setupNavigationAccess();
  window.setTimeout(() => {
    window.location.replace(expiredRole === 'admin' ? ROUTES.adminLogin : ROUTES.login);
  }, 700);
}

function requestButtonLabel(url, method = 'POST') {
  const target = String(url || '').toLowerCase();
  if (['GET', 'HEAD'].includes(method)) return 'Memuatkan...';
  if (target.includes('receipt') || target.includes('payment_file')) return 'Muat naik sedang diproses...';
  if (target.includes('action=logout')) return 'Sedang log keluar...';
  if (target.includes('action=login') || target.includes('action=user') || target.includes('action=auto')) return 'Sedang log masuk...';
  if (target.includes('action=signup')) return 'Mencipta akaun...';
  if (target.includes('action=profile')) return 'Menyimpan profil...';
  if (target.includes('email') || target.includes('test-email') || target.includes('reply')) return 'Menghantar e-mel...';
  if (/action=status/.test(target)) return 'Memproses...';
  if (method === 'DELETE' || /delete|remove/.test(target)) return 'Memadam...';
  if (target.includes('bookings.php')) return 'Sedang menghantar permohonan...';
  return 'Menyimpan...';
}

function mutationRequestKey(url, options) {
  const method = String(options.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return '';
  let body = options.body;
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    body = [...body.entries()].map(([key, value]) => [
      key,
      typeof File !== 'undefined' && value instanceof File ? `${value.name}:${value.size}:${value.lastModified}:${value.type}` : String(value),
    ]);
  }
  return `${method}:${url}:${typeof body === 'string' ? body : JSON.stringify(body || null)}`;
}

async function readApiResponse(response, fallbackMessage, requestUrl = '') {
  let result;
  try {
    result = await response.json();
  } catch (error) {
    // A proxy or PHP error page can return HTML with a successful HTTP status.
  }
  if (!result || typeof result !== 'object' || typeof result.success !== 'boolean') {
    const error = new Error(response.ok ? 'Respons pelayan tidak sah. Sila cuba semula.' : 'Sambungan ke pelayan gagal. Sila cuba lagi.');
    error.responseReceived = true;
    if (!response.ok) error.status = response.status;
    if (!response.ok) handleApiSessionExpiry(response, requestUrl, error);
    throw error;
  }
  if (!response.ok || result.success === false) {
    const message = response.status >= 500
      ? serverFailureMessage(requestUrl, fallbackMessage)
      : sanitizeApiErrorMessage(result.error, fallbackMessage);
    const error = new Error(message);
    error.status = response.status;
    handleApiSessionExpiry(response, requestUrl, error);
    throw error;
  }
  if (typeof result.warning === 'string') {
    result.warning = sanitizeApiErrorMessage(result.warning, 'Tindakan berjaya, tetapi notifikasi tidak dapat dihantar.');
  }
  return result;
}

async function requestApiJson(url, options = {}, fallbackMessage = 'Permintaan gagal. Sila cuba lagi.', timeoutMs) {
  const method = String(options.method || 'GET').toUpperCase();
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const requestKey = isMutation ? mutationRequestKey(url, options) : '';
  if (requestKey && pendingMutationRequests.has(requestKey)) return pendingMutationRequests.get(requestKey);

  const request = (async () => {
    if (isBrowserOffline()) {
      throw createNetworkError('Tindakan ini memerlukan sambungan internet.', { offline: true });
    }

    const actionButton = typeof setButtonLoading === 'function' && typeof document !== 'undefined'
      ? document.activeElement?.closest?.('button:not([data-no-auto-loading])')
      : null;
    const shouldManageButton = actionButton && !actionButton.disabled && !actionButton.dataset.loadingManaged;
    if (shouldManageButton) {
      actionButton.dataset.loadingManaged = 'true';
      setButtonLoading(actionButton, true, requestButtonLabel(url, method));
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const requestOptions = {
      ...options,
      credentials: options.credentials || 'include',
      ...(controller ? { signal: controller.signal } : {}),
    };
    const timeout = Number(timeoutMs || options.timeoutMs || API_TIMEOUT_DEFAULT);
    const setTimer = typeof window !== 'undefined' && window.setTimeout
      ? window.setTimeout.bind(window)
      : typeof setTimeout === 'function' ? setTimeout : null;
    const clearTimer = typeof window !== 'undefined' && window.clearTimeout
      ? window.clearTimeout.bind(window)
      : typeof clearTimeout === 'function' ? clearTimeout : null;
    const timeoutId = controller && setTimer ? setTimer(() => controller.abort(), timeout) : null;
    try {
      const response = await fetch(url, requestOptions);
      return await readApiResponse(response, fallbackMessage, url);
    } catch (error) {
      if (error?.status || error?.responseReceived) throw error;
      if (isBrowserOffline()) throw createNetworkError('Tindakan ini memerlukan sambungan internet.', { offline: true });
      if (error?.name === 'AbortError') {
        throw createNetworkError('Permintaan mengambil masa terlalu lama. Sila cuba lagi.', { timeout: true });
      }
      throw createNetworkError('Sambungan ke pelayan gagal. Sila cuba lagi.', { cause: error });
    } finally {
      if (timeoutId !== null) clearTimer?.(timeoutId);
      if (shouldManageButton) {
        setButtonLoading(actionButton, false);
        delete actionButton.dataset.loadingManaged;
      }
    }
  })();

  if (requestKey) {
    pendingMutationRequests.set(requestKey, request);
    try {
      return await request;
    } finally {
      if (pendingMutationRequests.get(requestKey) === request) pendingMutationRequests.delete(requestKey);
    }
  }
  return request;
}

async function apiRequest(endpoint, method = 'GET', data = null) {
  const options = { method, credentials: 'include', headers: {} };
  if (data !== null) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }
  const timeout = String(endpoint).includes('action=receipt') ? API_TIMEOUT_UPLOAD : API_TIMEOUT_DEFAULT;
  return requestApiJson(`${API_BASE}/${endpoint}`, options, 'Permintaan gagal. Sila cuba lagi.', timeout);
}

async function tryApi(endpoint, method = 'GET', data = null) {
  try {
    const result = await apiRequest(endpoint, method, data);
    apiOnline = true;
    return result;
  } catch (error) {
    apiOnline = Boolean(error.status);
    throw error;
  }
}

function canUseLocalFallback(error) {
  return !error.status || !apiOnline;
}

let facilitiesLoadError = null;
async function loadFacilities() {
  try {
    const result = await tryApi('facilities.php');
    facilitiesCache = normalizeFacilities(result.data || []);
    facilitiesLoadError = null;
  } catch (error) {
    facilitiesLoadError = error;
    if (!facilitiesCache.length) facilitiesCache = normalizeFacilities(FALLBACK_FACILITIES);
  }
  return facilitiesCache;
}

async function createBookingApi(data) {
  const formData = new FormData();
  Object.keys(data).forEach((key) => {
    if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
      formData.append(key, data[key]);
    }
  });
  return requestApiJson(`${API_BASE}/bookings.php`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  }, 'Permohonan tempahan gagal dihantar. Sila cuba lagi.', data.payment_file ? API_TIMEOUT_UPLOAD : API_TIMEOUT_BOOKING);
}

async function uploadBookingReceiptApi(id, file) {
  const formData = new FormData();
  formData.append('payment_file', file);
  return requestApiJson(`${API_BASE}/bookings.php?action=receipt&id=${encodeURIComponent(id)}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  }, 'Muat naik gagal. Sila cuba lagi.', API_TIMEOUT_UPLOAD);
}

async function adminLogin(email, password) {
  return await authRequest('login', { email, password });
}

async function userLogin(email, password) {
  return await authRequest('user', { email, password });
}

async function authRequest(action, data) {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => formData.append(key, value));
  return requestApiJson(`${API_BASE}/auth.php?action=${encodeURIComponent(action)}&t=${Date.now()}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    cache: 'no-store',
  }, 'Permintaan gagal. Sila cuba lagi.', API_TIMEOUT_DEFAULT);
}

async function autoLogin(email, password) {
  return await authRequest('auto', { email, password });
}

async function signupClient(data) {
  return await authRequest('signup', data);
}

async function getCurrentUser() {
  return await apiRequest('auth.php?action=me');
}
