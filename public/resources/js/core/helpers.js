// ==================== HELPERS ====================
const buttonLoadingStates = new WeakMap();
const recentToasts = new Map();

function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toastKey = `${type}:${String(msg)}`;
  const now = Date.now();
  if (now - (recentToasts.get(toastKey) || 0) < 1400) return;
  recentToasts.set(toastKey, now);
  window.setTimeout(() => recentToasts.delete(toastKey), 1600);
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle-fill text-danger"></i>'}</span><span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function setButtonLoading(button, loading, label = 'Memproses...') {
  if (!button) return;
  if (loading) {
    if (!buttonLoadingStates.has(button)) {
      buttonLoadingStates.set(button, {
        html: button.innerHTML,
        disabled: Boolean(button.disabled),
        ariaBusy: button.getAttribute('aria-busy'),
      });
    }
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.classList.add('button-loading');
    button.innerHTML = `<span class="loading-spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span>`;
    return;
  }

  const previous = buttonLoadingStates.get(button);
  if (!previous) return;
  button.innerHTML = previous.html;
  button.disabled = previous.disabled;
  if (previous.ariaBusy === null) button.removeAttribute('aria-busy');
  else button.setAttribute('aria-busy', previous.ariaBusy);
  button.classList.remove('button-loading');
  buttonLoadingStates.delete(button);
}

function showLoadingState(container, label = 'Memuatkan data...', count = 3) {
  if (!container) return;
  const skeletons = Array.from({ length: Math.max(1, Math.min(8, count)) }, () => '<span class="skeleton" aria-hidden="true"></span>').join('');
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = `<div class="loading-state" role="status" aria-live="polite"><span class="loading-spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span><div class="loading-skeletons">${skeletons}</div></div>`;
}

function showErrorState(container, message = 'Data tidak dapat dimuatkan.', onRetry = null) {
  if (!container) return;
  container.removeAttribute('aria-busy');
  container.innerHTML = `<div class="feedback-state feedback-state-error"><span class="feedback-state-icon" aria-hidden="true"><i class="bi bi-cloud-slash"></i></span><strong>Data tidak dapat dimuatkan</strong><span>${escapeHtml(message)}</span>${typeof onRetry === 'function' ? '<button class="btn btn-secondary btn-sm feedback-retry" type="button"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Cuba Lagi</button>' : ''}</div>`;
  if (typeof onRetry === 'function') container.querySelector('.feedback-retry')?.addEventListener('click', onRetry);
}

function setupNetworkStatus() {
  if (document.getElementById('networkStatusBanner')) return;
  const banner = document.createElement('div');
  banner.className = 'network-status-banner';
  banner.id = 'networkStatusBanner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.hidden = true;
  document.body.prepend(banner);

  let hideTimer = null;
  const renderOffline = () => {
    window.clearTimeout(hideTimer);
    banner.innerHTML = '<i class="bi bi-wifi-off" aria-hidden="true"></i><span>Anda sedang luar talian. Maklumat yang dipaparkan mungkin belum dikemas kini.</span>';
    banner.classList.add('is-offline');
    banner.hidden = false;
  };
  const renderOnline = () => {
    window.clearTimeout(hideTimer);
    banner.innerHTML = '<i class="bi bi-wifi" aria-hidden="true"></i><span>Sambungan internet telah dipulihkan.</span>';
    banner.classList.remove('is-offline');
    banner.hidden = false;
    hideTimer = window.setTimeout(() => { banner.hidden = true; }, 2800);
  };

  window.addEventListener('offline', renderOffline);
  window.addEventListener('online', renderOnline);
  if (isBrowserOffline()) renderOffline();
}

function statusBadgeHtml(status) {
  const labels = {
    unpaid: '<div class="status-badge status-unpaid"><i class="bi bi-credit-card" aria-hidden="true"></i>Belum Bayar</div>',
    pending: '<div class="status-badge status-pending"><i class="bi bi-clock" aria-hidden="true"></i>Menunggu</div>',
    approved: '<div class="status-badge status-approved"><i class="bi bi-check-circle" aria-hidden="true"></i>Diluluskan</div>',
    rejected: '<div class="status-badge status-rejected"><i class="bi bi-x-circle" aria-hidden="true"></i>Ditolak</div>',
    cancelled: '<div class="status-badge status-cancelled"><i class="bi bi-slash-circle" aria-hidden="true"></i>Dibatalkan</div>',
    available: '<div class="status-badge status-available"><i class="bi bi-check-circle" aria-hidden="true"></i>Tersedia</div>',
    unavailable: '<div class="status-badge status-booked"><i class="bi bi-x-circle" aria-hidden="true"></i>Tidak Tersedia</div>',
    booked: '<div class="status-badge status-booked"><i class="bi bi-calendar-x" aria-hidden="true"></i>Ditempah</div>',
  };
  return labels[status] || '';
}

function bookingStatusBadgeHtml(booking, element = 'div') {
  if (booking?.status !== 'pending') return statusBadgeHtml(booking?.status);
  const paymentRequired = booking.paymentRequired !== false && booking.payment_required !== false;
  const label = paymentRequired ? 'Menunggu' : 'Menunggu';
  return `<${element} class="status-badge status-pending"><i class="bi bi-clock" aria-hidden="true"></i>${label}</${element}>`;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
}

function formatDateTime(iso) {
  if (!iso) return '-';
  const date = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(iso);
  return `${formatDate(formatLocalDateValue(date))} ${date.toTimeString().slice(0, 5)}`;
}

function formatLocalDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateSortTimestamp(value) {
  const normalized = String(value || '').trim().replace(' ', 'T');
  if (!normalized) return null;
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function createDateSortComparator(mode, getRecentValue, getDateValue = getRecentValue) {
  const useRecentValue = mode === 'recent';
  const getPrimaryValue = useRecentValue ? getRecentValue : getDateValue;
  const direction = mode === 'date-asc' ? 1 : -1;

  return (a, b) => {
    const timeA = dateSortTimestamp(getPrimaryValue(a));
    const timeB = dateSortTimestamp(getPrimaryValue(b));
    if (timeA === null && timeB !== null) return 1;
    if (timeA !== null && timeB === null) return -1;
    if (timeA !== null && timeB !== null && timeA !== timeB) return (timeA - timeB) * direction;

    const recentA = dateSortTimestamp(getRecentValue(a));
    const recentB = dateSortTimestamp(getRecentValue(b));
    if (recentA === null && recentB !== null) return 1;
    if (recentA !== null && recentB === null) return -1;
    return recentA !== null && recentB !== null ? recentB - recentA : 0;
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setText(id, value) {
  document.querySelectorAll(`[id="${id}"]`).forEach((el) => {
    el.textContent = value;
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
