// ==================== API HELPERS ====================
async function readApiResponse(response, fallbackMessage) {
  let result;
  try {
    result = await response.json();
  } catch (error) {
    // A proxy or PHP error page can return HTML with a successful HTTP status.
  }
  if (!result || typeof result !== 'object' || typeof result.success !== 'boolean') {
    const error = new Error('Respons pelayan tidak sah. Sila cuba semula.');
    if (!response.ok) error.status = response.status;
    throw error;
  }
  if (!response.ok || result.success === false) {
    const error = new Error(typeof result.error === 'string' ? result.error : fallbackMessage);
    error.status = response.status;
    throw error;
  }
  return result;
}

async function apiRequest(endpoint, method = 'GET', data = null) {
  const options = { method, credentials: 'include', headers: {} };
  if (data !== null) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_BASE}/${endpoint}`, options);
  return readApiResponse(response, 'API request failed');
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

async function loadFacilities() {
  try {
    const result = await tryApi('facilities.php');
    facilitiesCache = normalizeFacilities(result.data || []);
  } catch (error) {
    facilitiesCache = normalizeFacilities(FALLBACK_FACILITIES);
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

  const response = await fetch(`${API_BASE}/bookings.php`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  return readApiResponse(response, 'Failed to create booking');
}

async function uploadBookingReceiptApi(id, file) {
  const formData = new FormData();
  formData.append('payment_file', file);

  const response = await fetch(`${API_BASE}/bookings.php?action=receipt&id=${encodeURIComponent(id)}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  return readApiResponse(response, 'Failed to upload receipt');
}

async function adminLogin(email, password) {
  return await authRequest('login', { email, password });
}

async function userLogin(email) {
  const password = document.getElementById('user-pass')?.value || '';
  return await authRequest('user', { email, password });
}

async function authRequest(action, data) {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => formData.append(key, value));

  const response = await fetch(`${API_BASE}/auth.php?action=${encodeURIComponent(action)}&t=${Date.now()}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    cache: 'no-store',
  });
  return readApiResponse(response, 'API request failed');
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
