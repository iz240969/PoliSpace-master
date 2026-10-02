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
    ['invalid action', 'Tindakan tidak sah.'],
    ['email and password required', 'Sila masukkan alamat e-mel dan kata laluan.'],
    ['password required', 'Sila masukkan kata laluan.'],
    ['valid email required', 'Sila masukkan alamat e-mel yang sah.'],
    ['login required', 'Sila log masuk untuk meneruskan.'],
    ['user login required', 'Sila log masuk untuk meneruskan.'],
    ['admin login required', 'Sila log masuk sebagai pentadbir untuk meneruskan.'],
    ['booking not found', 'Tempahan tidak dijumpai.'],
    ['facility not found', 'Fasiliti tidak dijumpai.'],
    ['client not found', 'Pelanggan tidak dijumpai.'],
    ['user account not found', 'Akaun pengguna tidak dijumpai.'],
    ['message not found', 'Mesej tidak dijumpai.'],
    ['invalid booking request', 'Permohonan tempahan tidak sah.'],
    ['receipt upload failed', 'Bukti bayaran tidak dapat dimuat naik. Sila cuba lagi.'],
    ['receipt upload is required', 'Sila pilih fail bukti bayaran.'],
    ['invalid receipt file', 'Fail bukti bayaran tidak sah. Sila pilih fail yang disokong.'],
    ['unsupported receipt type', 'Jenis fail bukti bayaran tidak disokong.'],
    ['validation failed', 'Sila semak semula maklumat yang diisi.'],
    ['method not allowed', 'Permintaan tidak dapat diproses.'],
    ['account already exists. please login.', 'Akaun ini sudah berdaftar. Sila log masuk.'],
    ['invalid account role', 'Jenis akaun tidak sah.'],
    ['invalid account type', 'Jenis akaun tidak sah.'],
    ['booking records are preserved for history. use rejected or cancelled status instead.', 'Rekod tempahan disimpan untuk rujukan. Tukar status kepada Ditolak atau Dibatalkan.'],
    ['staff number is required for staff registration', 'Sila masukkan nombor kakitangan.'],
    ['full name must contain between 2 and 100 characters', 'Nama penuh mesti mengandungi antara 2 hingga 100 aksara.'],
    ['valid phone number required', 'Sila masukkan nombor telefon yang sah.'],
    ['password must be between 6 and 128 characters', 'Kata laluan mesti mengandungi antara 6 hingga 128 aksara.'],
    ['password confirmation does not match', 'Pengesahan kata laluan tidak sepadan.'],
    ['session role conflict. please login again.', 'Sesi akaun berubah. Sila log masuk semula.'],
    ['client password has not been set by admin', 'Kata laluan akaun pelanggan ini belum ditetapkan. Sila hubungi pentadbir.'],
    ['only staff accounts can be verified', 'Pengesahan hanya tersedia untuk akaun kakitangan.'],
    ['invalid staff verification status', 'Status pengesahan kakitangan tidak sah.'],
    ['invalid account block status', 'Status sekatan akaun tidak sah.'],
    ['account blocked. please contact an administrator.', 'Akaun anda disekat. Sila hubungi pentadbir.'],
    ['valid user account required', 'Sila log masuk dengan akaun pengguna yang sah.'],
    ['you can only view your own bookings', 'Anda hanya boleh melihat tempahan sendiri.'],
    ['you can only view your own booking', 'Anda hanya boleh melihat tempahan sendiri.'],
    ['you can only cancel your own booking', 'Anda hanya boleh membatalkan tempahan sendiri.'],
    ['you can only edit your own booking', 'Anda hanya boleh mengubah tempahan sendiri.'],
    ['you can only update your own booking', 'Anda hanya boleh mengubah tempahan sendiri.'],
    ['only unpaid or pending bookings can be cancelled', 'Tempahan hanya boleh dibatalkan sebelum diluluskan.'],
    ['only unpaid or pending bookings can be edited', 'Tempahan hanya boleh diubah sebelum diluluskan.'],
    ['receipt can only be uploaded for unpaid bookings', 'Bukti bayaran hanya boleh dimuat naik untuk tempahan yang belum dibayar.'],
    ['payment is not required for this staff booking', 'Permohonan kakitangan ini tidak memerlukan bayaran.'],
    ['invalid report period', 'Tempoh laporan tidak sah.'],
    ['invalid status', 'Status tempahan tidak sah.'],
    ['rejection reason required', 'Sila masukkan sebab penolakan.'],
    ['purpose is required', 'Sila nyatakan tujuan penggunaan.'],
    ['invalid equipment option', 'Pilihan peralatan tidak sah.'],
    ['receipt file unavailable', 'Fail bukti bayaran tidak dapat dibuka.'],
    ['payment evidence is not accepted for verified staff bookings', 'Bukti bayaran tidak diperlukan untuk tempahan kakitangan yang telah disahkan.'],
    ['booking created successfully', 'Tempahan berjaya dihantar.'],
    ['booking updated', 'Tempahan berjaya dikemas kini.'],
    ['booking cancelled', 'Tempahan berjaya dibatalkan.'],
    ['receipt uploaded', 'Bukti bayaran berjaya dimuat naik.'],
    ['message sent successfully', 'Mesej berjaya dihantar.'],
    ['reply sent successfully', 'Balasan berjaya dihantar.'],
    ['login successful', 'Log masuk berjaya.'],
    ['logged out', 'Log keluar berjaya.'],
    ['invalid calendar month', 'Bulan kalendar tidak sah.'],
    ['invalid facility', 'Fasiliti tidak sah.'],
    ['facility id required', 'ID fasiliti diperlukan.'],
    ['pic id required', 'ID PIC diperlukan.'],
    ['facility request failed', 'Permintaan fasiliti gagal. Sila cuba lagi.'],
    ['client request failed', 'Maklumat pelanggan tidak dapat dimuatkan. Sila cuba lagi.'],
    ['client id required', 'ID pelanggan diperlukan.'],
    ['receipt not found', 'Fail bukti bayaran tidak ditemui.'],
    ['failed to upload file.', 'Fail tidak dapat dimuat naik. Sila cuba lagi.'],
    ['file size exceeds 5mb limit.', 'Saiz fail tidak boleh melebihi 5 MB.'],
    ['invalid upload.', 'Fail tidak sah. Sila cuba muat naik semula.'],
    ['upload directory could not be created.', 'Fail tidak dapat dimuat naik buat masa ini. Sila cuba lagi.'],
    ['message request failed', 'Mesej tidak dapat diproses. Sila cuba lagi.'],
    ['reply must be between 2 and 5000 characters', 'Balasan mestilah antara 2 hingga 5,000 aksara.'],
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
  if (target.includes('receipt') || target.includes('payment_file')) return 'Sedang memuat naik bukti bayaran...';
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
    const error = new Error(response.ok ? 'Respons pelayan tidak sah. Sila cuba lagi.' : 'Pelayan tidak dapat memproses permintaan. Sila cuba lagi.');
    error.responseReceived = true;
    if (!response.ok) error.status = response.status;
    if (!response.ok) handleApiSessionExpiry(response, requestUrl, error);
    throw error;
  }
  const legacyApiStatusMismatch = response.status === 404
    && result.success === true
    && /(?:^|\/)backend\/api\/[A-Za-z0-9_-]+\.php(?:[?#]|$)/i.test(String(requestUrl));
  if ((!response.ok && !legacyApiStatusMismatch) || result.success === false) {
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

    const actionButton = isMutation && typeof setButtonLoading === 'function' && typeof document !== 'undefined'
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
      ...(isMutation ? { headers: { ...options.headers, 'X-HTTP-Method-Override': method } } : {}),
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
        throw createNetworkError('Tidak dapat menghubungi pelayan. Sila cuba lagi.', { cause: error });
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

function paymentFileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(new Error('Bukti bayaran tidak dapat dibaca. Sila cuba lagi.'));
    reader.readAsDataURL(file);
  });
}

async function createBookingApi(data) {
  const payload = { ...data };
  if (payload.payment_file) {
    payload.payment_file_base64 = await paymentFileBase64(payload.payment_file);
    delete payload.payment_file;
  }
  return requestApiJson(`${API_BASE}/bookings.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  }, 'Permohonan tempahan gagal dihantar. Sila cuba lagi.', data.payment_file ? API_TIMEOUT_UPLOAD : API_TIMEOUT_BOOKING);
}

async function uploadBookingReceiptApi(id, file) {
  const paymentFile = await paymentFileBase64(file);
  return requestApiJson(`${API_BASE}/bookings.php?action=receipt&id=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_file_base64: paymentFile }),
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
  return requestApiJson(`${API_BASE}/auth.php?action=${encodeURIComponent(action)}&t=${Date.now()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-HTTP-Method-Override': 'POST',
    },
    body: JSON.stringify(data),
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
