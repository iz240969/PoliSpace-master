// ==================== HELPERS ====================
function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle-fill text-danger"></i>'}</span><span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
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
