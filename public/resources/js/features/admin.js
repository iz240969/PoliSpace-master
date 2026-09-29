// ==================== ADMIN ====================
let adminMessagesCache = [];
let adminRecentBookingsCache = [];
let adminBookingsCache = [];
let adminClientsCache = [];
let adminClientDetailBookings = [];
let adminCreatePaymentMode = '';
let adminCreateReceiptFile = null;
let adminReportBookings = [];
let adminReportSummary = {};
let adminReportMeta = {};
let adminReportRequest = 0;
let adminPicsCache = [];
let adminPicsLoaded = false;
let adminPicsLoadError = null;
let adminClientsLoaded = false;
let adminMessagesLoaded = false;
let adminDashboardLoaded = false;
let adminClientFilter = 'all';
let adminBookingFilterRequest = 0;
let adminBookingActiveFilter = 'all';
const adminExpandedBookingGroups = new Set();

function tableSortMode(selectId) {
  return document.getElementById(selectId)?.value || 'recent';
}

function sortAdminRecords(records, selectId, getRecentValue, getDateValue = getRecentValue) {
  return [...records].sort(createDateSortComparator(
    tableSortMode(selectId),
    getRecentValue,
    getDateValue
  ));
}

function adminBookingCreatedValue(booking) {
  return booking.createdAt || booking.created_at || '';
}

function adminBookingDateValue(booking) {
  const date = booking.date || booking.booking_date || '';
  const start = booking.start || String(booking.start_time || '').slice(0, 5) || '00:00';
  return date ? `${date}T${start}` : '';
}

function adminBookingTimeLabel(booking) {
  const isDayBooking = booking.durationUnit === 'day' || booking.duration_unit === 'day';
  return isDayBooking ? 'Sepanjang hari' : `${booking.start || '-'} - ${booking.end || '-'}`;
}

function adminBookingsForActiveFilter(bookings) {
  return adminBookingActiveFilter === 'all'
    ? bookings
    : bookings.filter((booking) => booking.status === adminBookingActiveFilter);
}

function sortedAdminBookings(bookings, selectId) {
  return sortAdminRecords(bookings, selectId, adminBookingCreatedValue, adminBookingDateValue);
}

function renderAdminRecentBookings() {
  renderBookingsTable('recentBookingsTbody', sortedAdminBookings(adminRecentBookingsCache, 'recentBookingsSortSelect'), true, 5);
}

function renderAdminBookings() {
  const query = document.getElementById('adminBookingSearch')?.value || '';
  const bookings = adminBookingsCache.filter((booking) => matchesAdminSearch(query, [booking.id, booking.cartGroupRef, booking.cart_group_ref, booking.name, booking.email, booking.facilityName, booking.org, booking.phone]));
  setText('bookingResultCount', `${bookings.length} daripada ${adminBookingsCache.length} tempahan`);
  renderBookingsTable('allBookingsTbody', sortedAdminBookings(bookings, 'adminBookingsSortSelect'), false);
}

function renderAdminClients() {
  const query = document.getElementById('adminClientSearch')?.value || '';
  const clients = adminClientsCache.filter((client) =>
    (adminClientFilter === 'all' || (adminClientFilter === 'staff' ? client.account_type === 'staff' : client.account_type !== 'staff'))
    && matchesAdminSearch(query, [client.full_name, client.name, client.email, client.phone])
  );
  setText('clientResultCount', `${clients.length} daripada ${adminClientsCache.length} pelanggan`);
  renderClientsTable(clients);
}

function matchesAdminSearch(query, values) {
  const words = String(query).trim().toLocaleLowerCase('ms-MY').split(/\s+/).filter(Boolean);
  const text = values.filter((value) => value != null).join(' ').toLocaleLowerCase('ms-MY');
  return words.every((word) => text.includes(word));
}

function setAdminFilterState(containerId, button) {
  document.querySelectorAll(`#${containerId} .filter-tab`).forEach((item) => {
    item.classList.toggle('active', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
}

function filterAdminClients(type, button) {
  adminClientFilter = type;
  setAdminFilterState('clientFilterTabs', button);
  renderAdminClients();
}

function toggleFacilityCreateForm(open) {
  const form = document.getElementById('adminFacilityForm');
  if (!form) return;
  const expanded = typeof open === 'boolean' ? open : form.hidden;
  form.hidden = !expanded;
  document.getElementById('facilityCreateToggle')?.setAttribute('aria-expanded', String(expanded));
  if (expanded) document.getElementById('facilityName')?.focus();
  else document.getElementById('facilityCreateToggle')?.focus();
}

function adminAccountTypeLabel(value) {
  return value === 'staff' ? 'Kakitangan' : 'Orang Awam';
}

function renderAdminMessages() {
  renderMessagesTable(adminMessagesCache);
}

function renderSortedAdminReports() {
  renderAdminReports(adminReportBookings);
}

function handleAdminAuthorizationError(error) {
  if (![401, 403, 419].includes(error?.status)) return false;
  if (error.sessionRedirectPending) return true;
  clearStoredAuthState();
  showToast('Sesi anda telah tamat. Sila log masuk semula.', 'error');
  window.setTimeout(() => window.location.replace(ROUTES.adminLogin), 700);
  return true;
}

function showAdminTableLoading(tbody, colspan, rows = 3) {
  if (!tbody) return;
  tbody.setAttribute('aria-busy', 'true');
  tbody.innerHTML = Array.from({ length: rows }, () => `<tr><td colspan="${colspan}"><div class="table-loading"><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span></div></td></tr>`).join('');
}

function showAdminTableError(tbody, colspan, message, retry) {
  if (!tbody) return;
  tbody.removeAttribute('aria-busy');
  tbody.innerHTML = `<tr><td colspan="${colspan}"><div class="feedback-state feedback-state-error" role="status"><span class="feedback-state-icon" aria-hidden="true"><i class="bi bi-cloud-slash"></i></span><strong>Data tidak dapat dimuatkan</strong><span>${escapeHtml(message)}</span><button class="btn btn-secondary btn-sm feedback-retry" type="button"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Cuba Lagi</button></div></td></tr>`;
  tbody.querySelector('.feedback-retry')?.addEventListener('click', retry);
}

async function renderAdminDashboard() {
  const dashDate = document.getElementById('dashDate');
  if (!dashDate) return;

  const statsContainer = document.getElementById('adminStats');
  const recentBody = document.getElementById('recentBookingsTbody');
  const allBody = document.getElementById('allBookingsTbody');
  if (!adminDashboardLoaded) {
    if (statsContainer) {
      statsContainer.setAttribute('aria-busy', 'true');
      statsContainer.innerHTML = Array.from({ length: 4 }, () => '<div class="stat-card stat-loading"><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span><span class="skeleton" aria-hidden="true"></span></div>').join('');
    }
    showAdminTableLoading(recentBody, 6);
    showAdminTableLoading(allBody, 7);
  } else {
    statsContainer?.setAttribute('aria-busy', 'true');
    recentBody?.setAttribute('aria-busy', 'true');
    allBody?.setAttribute('aria-busy', 'true');
  }

  loadClients();
  loadMessages();
  const facilities = await loadFacilities();
  await loadPics();

  try {
    const statsResult = await tryApi('bookings.php?action=stats');
    const bookingsResult = await tryApi('bookings.php');
    const stats = statsResult.data;
    const bookings = bookingsResult.data || [];
    statsContainer?.removeAttribute('aria-busy');
    recentBody?.removeAttribute('aria-busy');
    allBody?.removeAttribute('aria-busy');

    updatePendingBookingBadge(stats.pending);
    dashDate.textContent = new Date().toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (statsContainer) statsContainer.innerHTML = buildStatsHTML(stats);
    const bookingStats = document.getElementById('bookingStats');
    if (bookingStats) bookingStats.innerHTML = buildStatsHTML(stats);
    adminRecentBookingsCache = bookings;
    adminBookingsCache = adminBookingsForActiveFilter(bookings);
    renderAdminRecentBookings();
    renderAdminBookings();
    renderFacilityManagement(facilities);
    renderPicManagement(adminPicsCache);
    renderCalendar(bookings, bookingCalendarDate);
    adminDashboardLoaded = true;
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    statsContainer?.removeAttribute('aria-busy');
    recentBody?.removeAttribute('aria-busy');
    allBody?.removeAttribute('aria-busy');
    if (!adminDashboardLoaded) {
      showErrorState(statsContainer, error.message || 'Tidak dapat menghubungi pelayan. Sila cuba lagi.', () => renderAdminDashboard());
      showAdminTableError(recentBody, 6, error.message || 'Tidak dapat menghubungi pelayan. Sila cuba lagi.', () => renderAdminDashboard());
      showAdminTableError(allBody, 7, error.message || 'Tidak dapat menghubungi pelayan. Sila cuba lagi.', () => renderAdminDashboard());
    } else {
      showToast(error.message || 'Data tidak dapat dikemas kini. Data sebelumnya masih dipaparkan.', 'error');
    }
  }
}

function updatePendingBookingBadge(value) {
  const badge = document.getElementById('pendingBadge');
  if (!badge) return;
  const count = Math.max(0, Number.parseInt(value, 10) || 0);
  badge.textContent = String(count);
  badge.hidden = count === 0;
  badge.setAttribute('aria-label', `${count} tempahan menunggu semakan`);
  badge.title = count > 0 ? `${count} tempahan menunggu semakan` : '';
}

function buildStatsHTML(stats) {
  return [
    ['Jumlah Tempahan', stats.total, 'bi-journal-text', 'neutral', 'Tidak termasuk belum bayar'],
    ['Menunggu Semakan', stats.pending, 'bi-clock-history', 'warning', 'Perlu tindakan pentadbir'],
    ['Diluluskan', stats.approved, 'bi-check2-circle', 'success', 'Permohonan diluluskan'],
    ['Hari Ini', stats.today, 'bi-calendar3', 'gold', 'Tempahan pada hari ini'],
  ].map(([label, value, icon, tone, caption]) => `<div class="stat-card stat-${tone}"><div class="stat-card-top"><span class="stat-card-icon"><i class="bi ${icon}" aria-hidden="true"></i></span><div><div class="stat-card-label">${label}</div><div class="stat-card-value">${Number(value || 0).toLocaleString('ms-MY')}</div></div></div><div class="stat-card-caption">${caption}</div></div>`).join('');
}

async function loadAdminReports() {
  const content = document.getElementById('adminReportContent');
  if (!content) return;
  const request = ++adminReportRequest;
  const hasReport = Boolean(adminReportMeta.generatedAt);
  const printButton = document.getElementById('printAdminReportButton');
  const sortSelect = document.getElementById('reportEvidenceSortSelect');
  content.setAttribute('aria-busy', 'true');
  if (printButton) printButton.disabled = true;
  if (sortSelect) sortSelect.disabled = true;
  setText('reportUpdateStatus', hasReport ? 'Mengemas kini laporan...' : 'Menyediakan laporan...');
  try {
    const period = document.getElementById('reportPeriodSelect')?.value || 'all';
    const result = await tryApi(`bookings.php?action=report&period=${encodeURIComponent(period)}`);
    if (request !== adminReportRequest) return;
    adminReportBookings = result.data?.bookings || [];
    adminReportSummary = result.data?.summary || {};
    adminReportMeta = {
      period: result.data?.period || period,
      periodStart: result.data?.period_start || '',
      periodEnd: result.data?.period_end || '',
      generatedAt: result.data?.generated_at || '',
    };
    renderAdminReports(adminReportBookings);
    setText('reportUpdateStatus', 'Laporan dikemas kini.');
  } catch (error) {
    if (request !== adminReportRequest) return;
    if (handleAdminAuthorizationError(error)) return;
    if (hasReport) {
      const periodSelect = document.getElementById('reportPeriodSelect');
      if (periodSelect) periodSelect.value = adminReportMeta.period;
      setText('reportUpdateStatus', 'Kemas kini gagal. Laporan sebelumnya masih dipaparkan. Sila cuba lagi.');
      if (printButton) printButton.disabled = false;
    } else {
      content.innerHTML = `<div class="report-empty"><i class="bi bi-exclamation-circle"></i><strong>Laporan tidak dapat dimuatkan</strong><span>${escapeHtml(error.message || 'Sila cuba lagi.')}</span><button class="btn btn-secondary btn-sm" id="retryAdminReportButton" type="button"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Cuba Lagi</button></div>`;
      document.getElementById('retryAdminReportButton')?.addEventListener('click', () => loadAdminReports());
      setText('reportUpdateStatus', 'Laporan tidak dapat dimuatkan. Sila cuba lagi.');
    }
  } finally {
    if (request === adminReportRequest) {
      content.setAttribute('aria-busy', 'false');
      if (sortSelect) sortSelect.disabled = false;
    }
  }
}

function adminPaymentEvidenceRecords(bookings = adminReportBookings) {
  return bookings.filter((booking) => booking.paymentRequired !== false && Boolean(booking.paymentFile));
}

function reportCurrency(value) {
  return `RM${Number(value || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function reportPeriodLabel() {
  if (adminReportMeta.period === 'month') return 'Bulan Ini';
  if (adminReportMeta.period === 'year') return 'Tahun Ini';
  return 'Semua Masa';
}

function reportActivitySeries(bookings) {
  const parsedDates = bookings
    .map((booking) => new Date(booking.createdAt || booking.created_at || ''))
    .filter((date) => !Number.isNaN(date.getTime()));
  const now = new Date();

  if (adminReportMeta.period === 'month') {
    const series = Array.from({ length: 5 }, (_, index) => ({ key: index, label: `M${index + 1}`, value: 0 }));
    parsedDates.forEach((date) => {
      series[Math.min(4, Math.floor((date.getDate() - 1) / 7))].value += 1;
    });
    return { label: 'Aktiviti Mingguan', caption: 'Permohonan baharu mengikut minggu', series };
  }

  if (adminReportMeta.period === 'year') {
    const formatter = new Intl.DateTimeFormat('ms-MY', { month: 'short' });
    const series = Array.from({ length: 12 }, (_, month) => ({
      key: month,
      label: formatter.format(new Date(now.getFullYear(), month, 1)).replace('.', ''),
      value: 0,
    }));
    parsedDates.forEach((date) => { series[date.getMonth()].value += 1; });
    return { label: 'Aktiviti Bulanan', caption: 'Permohonan baharu sepanjang tahun', series };
  }

  const end = parsedDates.length
    ? new Date(Math.max(...parsedDates.map((date) => date.getTime())))
    : now;
  const formatter = new Intl.DateTimeFormat('ms-MY', { month: 'short', year: '2-digit' });
  const series = Array.from({ length: 8 }, (_, offset) => {
    const date = new Date(end.getFullYear(), end.getMonth() - (7 - offset), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      date,
      label: formatter.format(date).replace('.', ''),
      value: 0,
    };
  });
  const byKey = new Map(series.map((item) => [item.key, item]));
  parsedDates.forEach((date) => {
    const item = byKey.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (item) item.value += 1;
  });
  return { label: 'Trend Permohonan', caption: '8 bulan terkini dalam rekod', series };
}

function reportStatusGradient(statusOrder, statusMeta, counts, total) {
  if (!total) return 'var(--surface-3) 0deg 360deg';
  let cursor = 0;
  return statusOrder.map((status) => {
    const start = cursor;
    cursor += (counts[status] / total) * 360;
    return `${statusMeta[status].color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`;
  }).join(', ');
}

function renderAdminReports(bookings) {
  const content = document.getElementById('adminReportContent');
  const printButton = document.getElementById('printAdminReportButton');
  if (!content) return;
  const summary = adminReportSummary;
  const statusOrder = ['unpaid', 'pending', 'approved', 'rejected', 'cancelled'];
  const statusMeta = {
    unpaid: { label: 'Belum Bayar', color: 'var(--grey-4)', icon: 'bi-wallet2' },
    pending: { label: 'Menunggu', color: 'var(--amber)', icon: 'bi-hourglass-split' },
    approved: { label: 'Diluluskan', color: 'var(--green)', icon: 'bi-check2-circle' },
    rejected: { label: 'Ditolak', color: 'var(--red)', icon: 'bi-x-circle' },
    cancelled: { label: 'Dibatalkan', color: 'var(--grey-3)', icon: 'bi-slash-circle' },
  };
  const counts = Object.fromEntries(statusOrder.map((status) => [status, Number(summary[status] || 0)]));
  const total = Number(summary.total || 0);
  const decisionTotal = counts.approved + counts.rejected;
  const approvalRate = decisionTotal ? Math.round((counts.approved / decisionTotal) * 100) : 0;
  const evidenceRecords = sortedAdminBookings(adminPaymentEvidenceRecords(bookings), 'reportEvidenceSortSelect');
  const facilities = Object.values(bookings.reduce((items, booking) => {
    const key = String(booking.facilityId || booking.facilityName || 'unknown');
    const name = booking.facilityName || 'Fasiliti';
    items[key] ||= { name, count: 0, approved: 0, approvedValue: 0 };
    items[key].count += 1;
    if (booking.status === 'approved') {
      items[key].approved += 1;
      if (booking.paymentRequired !== false) items[key].approvedValue += Number(booking.estimatedCost || 0);
    }
    return items;
  }, {})).sort((a, b) => b.count - a.count);
  const maxFacilityCount = Math.max(1, ...facilities.map((item) => item.count));
  const generatedLabel = adminReportMeta.generatedAt ? formatDateTime(adminReportMeta.generatedAt) : '-';
  const activity = reportActivitySeries(bookings);
  const maxActivity = Math.max(1, ...activity.series.map((item) => item.value));
  const statusGradient = reportStatusGradient(statusOrder, statusMeta, counts, total);
  const paymentRequiredCount = Number(summary.payment_required_count || 0);
  const evidenceRate = paymentRequiredCount ? Math.round((Number(summary.evidence_count || 0) / paymentRequiredCount) * 100) : 0;
  if (printButton) printButton.disabled = false;

  content.innerHTML = `
    <section class="report-v3-hero">
      <div class="report-v3-hero-copy">
        <span class="report-v3-eyebrow"><i class="bi bi-graph-up-arrow"></i> ANALITIK TEMPAHAN</span>
        <h3>${reportPeriodLabel()}</h3>
        <p>Gambaran menyeluruh prestasi tempahan, status dan penggunaan fasiliti.</p>
      </div>
      <div class="report-v3-hero-summary">
        <small>Nilai anggaran diluluskan</small>
        <strong>${reportCurrency(summary.approved_estimated_value)}</strong>
        <span><i class="bi bi-clock"></i> Dikemas kini ${escapeHtml(generatedLabel)}</span>
      </div>
    </section>

    <div class="report-v3-kpi-grid">
      <article class="report-v3-kpi"><span><i class="bi bi-collection"></i></span><div><small>Jumlah Tempahan</small><strong>${total}</strong><p>${Number(summary.active || 0)} masih aktif</p></div></article>
      <article class="report-v3-kpi is-attention"><span><i class="bi bi-hourglass-split"></i></span><div><small>Perlu Tindakan</small><strong>${counts.pending}</strong><p>Menunggu semakan pentadbir</p></div></article>
      <article class="report-v3-kpi is-success"><span><i class="bi bi-check2-circle"></i></span><div><small>Kadar Kelulusan</small><strong>${approvalRate}%</strong><p>${counts.approved} daripada ${decisionTotal} keputusan</p></div></article>
      <article class="report-v3-kpi"><span><i class="bi bi-file-earmark-check"></i></span><div><small>Liputan Bukti</small><strong>${evidenceRate}%</strong><p>${Number(summary.evidence_count || 0)} daripada ${paymentRequiredCount} tempahan berbayar</p></div></article>
    </div>

    <div class="report-v3-visual-grid">
      <section class="report-v3-panel report-v3-status-panel">
        <div class="report-v3-section-heading"><div><span>STATUS</span><h3>Agihan Tempahan</h3><p>Peratusan mengikut status semasa.</p></div></div>
        <div class="report-v3-status-visual">
          <div class="report-v3-donut" style="--report-status-gradient:${statusGradient}" role="img" aria-label="Agihan ${total} tempahan mengikut status"><div><strong>${total}</strong><span>rekod</span></div></div>
          <div class="report-v3-status-legend">${statusOrder.map((status) => {
          const percentage = total ? Math.round((counts[status] / total) * 100) : 0;
          return `<div><i class="bi ${statusMeta[status].icon}" style="color:${statusMeta[status].color}"></i><span>${statusMeta[status].label}</span><strong>${counts[status]}</strong><small>${percentage}%</small></div>`;
        }).join('')}</div>
        </div>
      </section>
      <section class="report-v3-panel report-v3-activity-panel">
        <div class="report-v3-section-heading"><div><span>AKTIVITI</span><h3>${activity.label}</h3><p>${activity.caption}.</p></div><strong>${total}</strong></div>
        <div class="report-v3-activity-chart" role="img" aria-label="${escapeAttr(activity.label)}">${activity.series.map((item) => {
          const height = item.value ? Math.max(10, (item.value / maxActivity) * 88) : 3;
          return `<div class="report-v3-activity-column" style="--report-activity-height:${height}%" aria-label="${escapeAttr(item.label)}: ${item.value} permohonan"><div><span>${item.value || ''}</span><i></i></div><small>${escapeHtml(item.label)}</small></div>`;
        }).join('')}</div>
      </section>
    </div>

    <div class="report-v3-detail-grid">
      <section class="report-v3-panel">
        <div class="report-v3-section-heading"><div><span>FASILITI</span><h3>Fasiliti Paling Aktif</h3><p>Disusun mengikut jumlah permohonan.</p></div><i class="bi bi-buildings"></i></div>
        <div class="report-v3-facility-list">${facilities.length ? facilities.slice(0, 7).map((item, index) => `<div class="report-v3-facility-row"><span>${String(index + 1).padStart(2, '0')}</span><div><div><strong>${escapeHtml(item.name)}</strong><b>${item.count}</b></div><div class="report-v3-track"><i style="width:${Math.max(4, (item.count / maxFacilityCount) * 100)}%"></i></div><small>${item.approved} diluluskan &middot; ${reportCurrency(item.approvedValue)}</small></div></div>`).join('') : '<div class="report-no-data">Tiada data fasiliti untuk tempoh ini.</div>'}</div>
      </section>
      <section class="report-v3-panel report-v3-finance-panel">
        <div class="report-v3-section-heading"><div><span>NILAI & BUKTI</span><h3>Ringkasan Kewangan</h3><p>Nilai anggaran, bukan bayaran diterima.</p></div><i class="bi bi-wallet2"></i></div>
        <div class="report-v3-finance-list">
          <div><span>Anggaran diluluskan</span><strong>${reportCurrency(summary.approved_estimated_value)}</strong><small>Tempahan berbayar sahaja</small></div>
          <div><span>Anggaran menunggu</span><strong>${reportCurrency(summary.pending_estimated_value)}</strong><small>${counts.pending} tempahan</small></div>
          <div><span>Fail bukti diterima</span><strong>${Number(summary.evidence_count || 0)}</strong><small>${evidenceRate}% tempahan yang memerlukan bayaran</small></div>
          <div><span>Jenis pemohon</span><strong>${Number(summary.public_count || 0)} / ${Number(summary.staff_count || 0)}</strong><small>Orang Awam / Kakitangan</small></div>
        </div>
      </section>
    </div>

    <div class="report-v3-note"><i class="bi bi-info-circle"></i><span>Nilai wang ialah anggaran caj tempahan. Fail dimuat naik ialah bukti bayaran dan bukan resit rasmi.</span></div>

    <section class="report-v3-panel report-v2-evidence">
      <div class="report-v3-section-heading"><div><span>BUKTI BAYARAN</span><h3>Rekod & Fail Sokongan</h3><p>Semak fail bayaran dan butiran setiap tempahan.</p></div><span class="report-count-badge">${evidenceRecords.length} rekod</span></div>
      <div class="data-table-wrap"><table class="data-table report-evidence-table"><thead><tr><th>Rujukan & Status</th><th>Pelanggan</th><th>Fasiliti & Tarikh</th><th>Nilai Anggaran</th><th>Fail Bukti</th><th aria-label="Tindakan"></th></tr></thead><tbody>${evidenceRecords.length ? evidenceRecords.map(adminPaymentEvidenceRowHtml).join('') : '<tr><td colspan="6"><div class="report-no-data">Tiada fail bukti bayaran untuk tempoh ini.</div></td></tr>'}</tbody></table></div>
    </section>`;
}

function adminPaymentEvidenceRowHtml(booking) {
  const id = escapeAttr(booking.id);
  const durationUnit = booking.durationUnit === 'day' || booking.duration_unit === 'day' ? 'hari' : 'jam';
  const duration = `${booking.duration || 1} ${durationUnit}`;
  const paymentProof = `<a class="report-proof-link" href="${receiptFileUrl(booking.paymentFile)}" target="_blank" rel="noopener" title="${escapeAttr(booking.paymentFile)}"><i class="bi bi-file-earmark-check"></i><span><strong>Lihat fail bukti</strong><small>${escapeHtml(booking.paymentFile)}</small></span><i class="bi bi-box-arrow-up-right"></i></a>`;

  return `
    <tr class="report-evidence-summary">
      <td class="table-status"><div class="booking-id">${escapeHtml(booking.id)}</div><div class="report-cell-sub">${bookingStatusBadgeHtml(booking)}</div></td>
      <td><strong>${escapeHtml(booking.name)}</strong><div class="report-cell-sub">${escapeHtml(booking.email || '-')} &middot; ${escapeHtml(booking.accountTypeLabel || adminAccountTypeLabel(booking.accountType))}</div></td>
      <td><strong>${escapeHtml(booking.facilityName)}</strong><div class="report-cell-sub"><i class="bi bi-calendar3"></i> ${formatDate(booking.date)} &middot; ${escapeHtml(booking.start || '-')} - ${escapeHtml(booking.end || '-')}</div></td>
      <td><strong class="report-amount">${reportCurrency(booking.estimatedCost)}</strong><div class="report-cell-sub">Anggaran tempahan</div></td>
      <td>${paymentProof}</td>
      <td><button class="btn btn-secondary btn-sm report-detail-toggle" type="button" aria-expanded="false" onclick="toggleAdminEvidenceDetails('${id}', this)"><i class="bi bi-chevron-down"></i> Butiran</button></td>
    </tr>
    <tr class="report-evidence-detail" data-evidence-detail="${id}" hidden>
      <td colspan="6">
        <div class="report-detail-panel">
          <div class="report-detail-grid">
            <div><span>No. Telefon</span><strong>${escapeHtml(booking.phone || '-')}</strong></div>
            <div><span>Tempoh</span><strong>${escapeHtml(duration)}</strong></div>
            <div><span>Jumlah Pengguna</span><strong>${escapeHtml(booking.pax || '-')}</strong></div>
            <div><span>Jenis Pemohon</span><strong>${escapeHtml(booking.accountTypeLabel || adminAccountTypeLabel(booking.accountType))}</strong></div>
            <div><span>Permohonan Dicipta</span><strong>${escapeHtml(formatDateTime(booking.createdAt))}</strong></div>
            <div class="report-detail-purpose"><span>Tujuan Penggunaan</span><strong>${escapeHtml(booking.purpose || '-')}</strong></div>
            <div class="report-detail-wide"><span>Peralatan</span><strong>${escapeHtml(booking.equipment || 'Tiada peralatan')}</strong></div>
            <div class="report-detail-wide"><span>Fail Bukti Bayaran</span><strong>${receiptLinkHtml(booking.paymentFile)}</strong></div>
          </div>
          <div class="report-detail-actions">
            <button class="btn btn-secondary btn-sm" type="button" onclick="printAdminEvidenceBooking('${id}')"><i class="bi bi-printer"></i> Cetak</button>
            <button class="btn btn-secondary btn-sm" type="button" onclick="viewBookingDetail('${id}')"><i class="bi bi-eye"></i> Lihat Tempahan Penuh</button>
          </div>
        </div>
      </td>
    </tr>`;
}

function toggleAdminEvidenceDetails(id, button) {
  const detailRow = [...document.querySelectorAll('[data-evidence-detail]')]
    .find((row) => row.dataset.evidenceDetail === String(id));
  if (!detailRow) return;
  const willOpen = detailRow.hidden;
  detailRow.hidden = !willOpen;
  button?.setAttribute('aria-expanded', String(willOpen));
  if (button) button.innerHTML = `<i class="bi bi-chevron-${willOpen ? 'up' : 'down'}"></i> ${willOpen ? 'Tutup' : 'Butiran'}`;
}

function printAdminEvidenceBooking(id) {
  const booking = adminReportBookings.find((item) => String(item.id) === String(id));
  if (!booking) {
    showToast('Butiran tempahan tidak ditemui untuk dicetak.', 'error');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    showToast('Tetingkap cetakan disekat oleh pelayar. Benarkan pop-up untuk mencetak tempahan.', 'error');
    return;
  }

  const statusLabels = {
    unpaid: 'Belum Bayar', pending: 'Menunggu', approved: 'Diluluskan',
    rejected: 'Ditolak', cancelled: 'Dibatalkan',
  };
  const duration = `${booking.duration || 1} ${booking.durationUnit === 'day' || booking.duration_unit === 'day' ? 'hari' : 'jam'}`;
  const applicantType = booking.accountTypeLabel || adminAccountTypeLabel(booking.accountType);
  const payment = booking.paymentRequired === false
    ? 'Tidak diperlukan'
    : `Diperlukan (${reportCurrency(booking.estimatedCost)})`;
  const fields = [
    ['Nama Pelanggan', booking.name],
    ['Jenis Pemohon', applicantType],
    ['Alamat E-mel', booking.email],
    ['No. Telefon', booking.phone],
    ['Tarikh Tempahan', formatDate(booking.date)],
    ['Masa', adminBookingTimeLabel(booking)],
    ['Tempoh', duration],
    ['Jumlah Pengguna', booking.pax],
    ...(booking.asrama_type ? [['Asrama', `${asramaTypeLabel(booking.asrama_type)} - ${booking.room_count || 1} bilik`]] : []),
    ['Bayaran', payment],
    ...(booking.paymentFile ? [['Fail Bukti Bayaran', booking.paymentFile]] : []),
    ['Nama PIC', booking.picFullName],
    ['No. Telefon PIC', booking.picPhone],
    ['Permohonan Dicipta', formatDateTime(booking.createdAt || booking.created_at)],
    ['Peralatan', booking.equipment || 'Tiada peralatan', true],
    ['Tujuan Penggunaan', booking.purpose, true],
    ...(booking.adminNote ? [['Nota Pentadbir', booking.adminNote, true]] : []),
    ...(booking.cancellationReason ? [['Sebab Pembatalan', booking.cancellationReason, true]] : []),
  ];
  const detailRows = fields.map(([label, value, wide]) => `
    <div class="field${wide ? ' field-wide' : ''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value || '-'))}</strong></div>
  `).join('');
  const status = booking.status === 'pending'
    ? (booking.paymentRequired === false ? 'Menunggu' : 'Menunggu Semakan Bayaran')
    : statusLabels[booking.status] || booking.status || '-';
  const html = `<!doctype html>
    <html lang="ms"><head><meta charset="utf-8"><title>Butiran Tempahan ${escapeHtml(booking.id)}</title>
      <style>
        *{box-sizing:border-box}body{margin:0;background:#f3f4f2;color:#18211c;font-family:Arial,sans-serif}
        .sheet{max-width:900px;margin:28px auto;padding:32px;background:#fff;border:1px solid #e0e4df;border-radius:14px}
        header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:20px;border-bottom:2px solid #a27616}
        h1{margin:0;font-size:23px}.subtitle{margin-top:5px;color:#606a63;font-size:13px}.reference{text-align:right;font-size:12px;color:#606a63}.reference strong{display:block;margin-top:5px;color:#18211c;font-size:16px}
        .booking-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:22px 0}.booking-heading h2{margin:0;font-size:18px}.badge{padding:7px 11px;border:1px solid #d7dfd8;border-radius:999px;background:#f2f6f2;font-size:12px;font-weight:700}
        .facility{margin-bottom:18px;color:#49544d;font-size:13px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .field{min-width:0;padding:12px 14px;border:1px solid #e2e6e2;border-radius:9px;background:#fafbf9}.field span{display:block;margin-bottom:6px;color:#68736b;font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}.field strong{display:block;font-size:13px;line-height:1.45;overflow-wrap:anywhere;white-space:pre-wrap}.field-wide{grid-column:1/-1}
        .footer{margin-top:22px;padding-top:12px;border-top:1px solid #e2e6e2;color:#68736b;font-size:10px}
        @page{size:A4 portrait;margin:14mm}@media print{body{background:#fff}.sheet{max-width:none;margin:0;padding:0;border:0;border-radius:0}.field{break-inside:avoid}}
        @media(max-width:600px){.sheet{margin:0;padding:18px;border:0;border-radius:0}header{flex-direction:column}.reference{text-align:left}.grid{grid-template-columns:1fr}.field-wide{grid-column:auto}}
      </style>
    </head><body><main class="sheet">
      <header><div><h1>PoliSpace</h1><div class="subtitle">Butiran Tempahan Fasiliti</div></div><div class="reference">No. Rujukan Tempahan<strong>${escapeHtml(booking.id)}</strong></div></header>
      <div class="booking-heading"><h2>${escapeHtml(booking.name || 'Tempahan')}</h2><span class="badge">${escapeHtml(status)}</span></div>
      <div class="facility"><strong>Fasiliti:</strong> ${escapeHtml(booking.facilityName || '-')}</div>
      <section class="grid">${detailRows}</section>
      <div class="footer">Dokumen butiran tempahan yang dijana daripada PoliSpace.</div>
    </main></body></html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 350);
}

function printAdminReport() {
  window.print();
}

function adminBookingGroups(bookings) {
  const groupedBookings = new Map();
  const rows = [];

  bookings.forEach((booking) => {
    const groupRef = String(booking.cartGroupRef || booking.cart_group_ref || '').trim();
    if (!groupRef) {
      rows.push({ type: 'single', booking });
      return;
    }

    if (!groupedBookings.has(groupRef)) {
      const group = { type: 'group', groupRef, bookings: [], representative: booking };
      groupedBookings.set(groupRef, group);
      rows.push(group);
    }
    groupedBookings.get(groupRef).bookings.push(booking);
  });

  return rows.flatMap((row) => {
    if (row.type === 'group' && row.bookings.length === 1) {
      return [{ type: 'single', booking: row.bookings[0] }];
    }
    return [row];
  });
}

function adminBookingRowHtml(booking, isRecent, childGroupRef = '') {
  const canApprove = booking.status === 'pending';
  const canReject = ['pending', 'approved'].includes(booking.status);
  const canCancelApproved = booking.status === 'approved';
  const isChild = Boolean(childGroupRef);
  const expanded = isChild && adminExpandedBookingGroups.has(childGroupRef);
  const rowClass = isChild ? `dashboard-booking-child-row${expanded ? ' is-visible' : ''}` : '';
  const rowAttributes = isChild
    ? `data-admin-booking-group="${escapeAttr(childGroupRef)}" aria-hidden="${expanded ? 'false' : 'true'}"${expanded ? '' : ' inert'}`
    : '';
  const cell = (content) => isChild ? `<div class="dashboard-booking-cell-content">${content}</div>` : content;

  return `
    <tr class="${rowClass}" ${rowAttributes}>
      <td>${cell(`<div class="booking-id" title="${escapeAttr(booking.id)}">${escapeHtml(booking.id)}</div>`)}</td>
      <td>${cell(`<span class="table-facility">${booking.facilityIcon || ''}<span>${escapeHtml(booking.facilityName)}</span></span>`)}</td>
      <td class="table-date">${cell(formatDate(booking.date))}</td>
      ${!isRecent ? `<td class="table-time">${cell(`${escapeHtml(booking.start)} - ${escapeHtml(booking.end || '?')}`)}</td>` : ''}
      <td class="table-status">${cell(bookingStatusBadgeHtml(booking))}</td>
      <td>${cell(`<div class="table-actions admin-booking-actions">${canApprove ? `<button class="btn btn-success btn-sm admin-decision-btn" onclick="approveBooking('${escapeAttr(booking.id)}')" title="${booking.paymentRequired === false ? 'Sahkan permohonan' : 'Sahkan bayaran dan tempahan'}" aria-label="Sahkan tempahan ${escapeAttr(booking.id)}"><i class="bi bi-check-lg"></i> Sahkan</button>` : ''}${canReject && !canCancelApproved ? `<button class="btn btn-danger btn-sm admin-decision-btn" onclick="rejectBookingPrompt('${escapeAttr(booking.id)}')" title="Tolak tempahan"><i class="bi bi-x-lg"></i> Tolak</button>` : ''}${canCancelApproved ? `<button class="btn btn-danger btn-sm admin-decision-btn" onclick="cancelApprovedBookingPrompt('${escapeAttr(booking.id)}')" title="Batalkan tempahan yang diluluskan"><i class="bi bi-x-circle"></i> Batalkan</button>` : ''}<button class="btn btn-secondary btn-sm table-icon-btn" onclick="viewBookingDetail('${escapeAttr(booking.id)}')" title="Lihat tempahan" aria-label="Lihat tempahan ${escapeAttr(booking.id)}"><i class="bi bi-eye"></i></button></div>`)}</td>
    </tr>`;
}

function adminBookingGroupRowHtml(group, isRecent) {
  const expanded = adminExpandedBookingGroups.has(group.groupRef);
  const dates = [...new Set(group.bookings.map((booking) => booking.date).filter(Boolean))];
  const dateSummary = dates.length === 1 ? formatDate(dates[0]) : `${dates.length} tarikh`;
  const timeSummary = dashboardBookingGroupTimeLabel(group.bookings);
  const paymentBookings = group.bookings.filter((booking) => booking.paymentRequired !== false);
  const total = paymentBookings.reduce((sum, booking) => sum + Number(booking.estimatedCost || 0), 0);
  const paymentSummary = paymentBookings.length ? `RM${escapeHtml(String(total))}` : 'Tiada Bayaran';

  return `
    <tr class="dashboard-booking-group-row${expanded ? ' is-expanded' : ''}" data-admin-booking-group="${escapeAttr(group.groupRef)}" onclick="toggleAdminBookingGroup('${escapeAttr(group.groupRef)}', event)" style="cursor:pointer">
      <td>
        <div class="dashboard-booking-group-id">
          <span class="dashboard-booking-group-label">Kumpulan</span>
          <span class="booking-id">${escapeHtml(group.groupRef)}</span>
        </div>
      </td>
      <td>
        <div class="dashboard-booking-group-summary">
          <div class="dashboard-booking-group-summary-main">
            <strong>${group.bookings.length} tempahan</strong>
            <span class="dashboard-booking-group-price">${paymentSummary}</span>
          </div>
        </div>
      </td>
      <td><div class="dashboard-booking-group-meta"><i class="bi bi-calendar3"></i> ${dateSummary}</div></td>
      ${!isRecent ? `<td><div class="dashboard-booking-group-meta"><i class="bi bi-clock"></i> ${escapeHtml(timeSummary)}</div></td>` : ''}
      <td class="table-status">${groupStatusBadgeHtml(group.bookings)}</td>
      <td>
        <div class="table-actions admin-booking-actions">
          <button class="btn btn-secondary btn-sm dashboard-booking-group-action" type="button" onclick="toggleAdminBookingGroup('${escapeAttr(group.groupRef)}', event)" aria-expanded="${expanded ? 'true' : 'false'}" title="${expanded ? 'Sembunyikan tempahan' : 'Lihat tempahan'}" aria-label="${expanded ? 'Sembunyikan tempahan dalam kumpulan' : 'Lihat tempahan dalam kumpulan'}"><i class="bi bi-chevron-down"></i></button>
        </div>
      </td>
    </tr>
    ${group.bookings.map((booking) => adminBookingRowHtml(booking, isRecent, group.groupRef)).join('')}`;
}

function toggleAdminBookingGroup(groupRef, event = null) {
  if (event) {
    event.stopPropagation();
  }

  const expanded = !adminExpandedBookingGroups.has(groupRef);
  if (expanded) adminExpandedBookingGroups.add(groupRef);
  else adminExpandedBookingGroups.delete(groupRef);

  document.querySelectorAll('.admin-bookings-table .dashboard-booking-group-row[data-admin-booking-group]').forEach((row) => {
    if (row.dataset.adminBookingGroup !== groupRef) return;
    row.classList.toggle('is-expanded', expanded);
    const action = row.querySelector('.dashboard-booking-group-action');
    if (!action) return;
    const label = expanded ? 'Sembunyikan tempahan dalam kumpulan' : 'Lihat tempahan dalam kumpulan';
    action.setAttribute('aria-expanded', String(expanded));
    action.setAttribute('aria-label', label);
    action.title = expanded ? 'Sembunyikan tempahan' : 'Lihat tempahan';
  });

  const rows = [...document.querySelectorAll('.admin-bookings-table .dashboard-booking-child-row[data-admin-booking-group]')]
    .filter((row) => row.dataset.adminBookingGroup === groupRef);
  setBookingGroupExpanded(rows, expanded);
}

function renderBookingsTable(tbodyId, bookings, isRecent = false, rowLimit = 0) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (!bookings.length) {
    const columnCount = isRecent ? 6 : 7;
    tbody.innerHTML = `<tr><td colspan="${columnCount}"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-inbox"></i></div><div class="empty-state-title">Tiada Tempahan</div></div></td></tr>`;
    return;
  }

  const rows = adminBookingGroups(bookings);
  const visibleRows = rowLimit > 0 ? rows.slice(0, rowLimit) : rows;
  tbody.innerHTML = visibleRows.map((row) => row.type === 'group'
    ? adminBookingGroupRowHtml(row, isRecent)
    : adminBookingRowHtml(row.booking, isRecent)).join('');
}

async function filterBookings(filter, btn) {
  const request = ++adminBookingFilterRequest;
  const tbody = document.getElementById('allBookingsTbody');
  tbody?.setAttribute('aria-busy', 'true');
  let bookings = [];
  try {
    const suffix = filter === 'all' ? '' : `?status=${encodeURIComponent(filter)}`;
    const result = await tryApi(`bookings.php${suffix}`);
    bookings = result.data || [];
  } catch (error) {
    if (request !== adminBookingFilterRequest) return;
    tbody?.removeAttribute('aria-busy');
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Senarai tempahan tidak dapat dimuatkan.', 'error');
    return;
  }
  if (request !== adminBookingFilterRequest) return;
  tbody?.removeAttribute('aria-busy');
  adminBookingActiveFilter = filter;
  setAdminFilterState('bookingFilterTabs', btn);
  adminBookingsCache = bookings;
  renderAdminBookings();
}

function openAdminCreateBookingModal() {
  const standalonePage = Boolean(document.getElementById('adminCreateBookingPage'));
  adminCreatePaymentMode = '';
  adminCreateReceiptFile = null;
  setText('modalTitle', 'Tambah Tempahan');
  const minDate = typeof getMinimumBookingDateValue === 'function' ? getMinimumBookingDateValue() : '';
  document.getElementById('modalBody').innerHTML = `
    <form class="admin-create-booking-form" id="adminCreateBookingForm" onsubmit="submitAdminCreateBooking(event)">
      <div class="form-group">
        <label for="adminBookingName">Nama Pelanggan *</label>
        <input type="text" id="adminBookingName" maxlength="100" required placeholder="cth: Ahmad bin Ali">
      </div>
      <div class="form-group">
        <label for="adminBookingPhone">No. Telefon *</label>
        <input type="tel" id="adminBookingPhone" maxlength="20" required placeholder="012-345 6789">
      </div>
      <div class="form-group span-2">
        <label for="adminBookingEmail">Alamat E-mel *</label>
        <input type="email" id="adminBookingEmail" required placeholder="contoh@email.com">
      </div>
      <div class="form-group span-2">
        <label for="adminBookingFacility">Nama Fasiliti *</label>
        <select id="adminBookingFacility" required onchange="syncAdminCreateBookingFields()">${adminCreateBookingFacilityOptions()}</select>
      </div>
      <div class="form-group">
        <label for="adminBookingDate">Tarikh Tempahan *</label>
        <input type="date" id="adminBookingDate" ${minDate ? `min="${escapeAttr(minDate)}"` : ''} required onchange="normalizeAdminCreateRooms()">
      </div>
      <div class="form-group" data-admin-create-time>
        <label for="adminBookingStart">Masa Mula *</label>
        <input type="time" id="adminBookingStart" value="08:00" required oninput="syncAdminCreateBookingEndTime()" onchange="syncAdminCreateBookingEndTime()">
      </div>
      <div class="form-group">
        <label for="adminBookingDuration">Tempoh *</label>
        <input type="number" id="adminBookingDuration" min="1" max="24" step="1" value="1" required oninput="syncAdminCreateBookingEndTime();normalizeAdminCreateRooms()" onchange="syncAdminCreateBookingEndTime();normalizeAdminCreateRooms()">
      </div>
      <div class="form-group">
        <label for="adminBookingDurationUnit">Unit Tempoh *</label>
        <select id="adminBookingDurationUnit" onchange="syncAdminCreateBookingFields()">
          <option value="hour">Jam</option>
          <option value="day">Hari</option>
        </select>
      </div>
      <div class="form-group span-2 admin-create-asrama is-hidden">
        <label>Bilangan Bilik *</label>
        <div class="admin-create-room-grid">
          <div class="admin-create-room-summary"><span>Jumlah</span><strong id="adminCreateRoomTotal">1</strong><small id="adminCreateRoomLimit">Had mengikut tarikh</small></div>
          <div class="admin-create-room-card">
            <div><span>Asrama Lelaki</span><small id="adminCreateLelakiHint">1 bilik</small></div>
            <div class="quantity-control compact"><button type="button" onclick="adjustAdminCreateAsramaRoom('lelaki', -1)" aria-label="Kurangkan bilik asrama lelaki"><i class="bi bi-dash-lg"></i></button><input type="number" id="adminBookingLelakiRooms" min="0" max="30" step="1" value="1" oninput="normalizeAdminCreateRooms()"><button type="button" onclick="adjustAdminCreateAsramaRoom('lelaki', 1)" aria-label="Tambah bilik asrama lelaki"><i class="bi bi-plus-lg"></i></button></div>
          </div>
          <div class="admin-create-room-card">
            <div><span>Asrama Perempuan</span><small id="adminCreatePerempuanHint">0 bilik</small></div>
            <div class="quantity-control compact"><button type="button" onclick="adjustAdminCreateAsramaRoom('perempuan', -1)" aria-label="Kurangkan bilik asrama perempuan"><i class="bi bi-dash-lg"></i></button><input type="number" id="adminBookingPerempuanRooms" min="0" max="30" step="1" value="0" oninput="normalizeAdminCreateRooms()"><button type="button" onclick="adjustAdminCreateAsramaRoom('perempuan', 1)" aria-label="Tambah bilik asrama perempuan"><i class="bi bi-plus-lg"></i></button></div>
          </div>
        </div>
      </div>
      <div class="form-group" data-admin-create-participants>
        <label for="adminBookingParticipants">Jumlah Pengguna *</label>
        <input type="number" id="adminBookingParticipants" min="1" max="5000" step="1" value="1" required>
      </div>
      <div class="form-group span-2" data-admin-create-equipment>
        <label>Peralatan Diperlukan</label>
        <input type="hidden" id="adminBookingEquipment">
        <div class="admin-create-equipment-grid" id="adminCreateEquipmentGrid"></div>
      </div>
      <div class="form-group span-2">
        <label for="adminBookingPurpose">Tujuan Penggunaan *</label>
        <textarea id="adminBookingPurpose" maxlength="1000" required></textarea>
      </div>
      <div class="admin-create-payment-options span-2 is-hidden" id="adminCreatePaymentOptions">
        <div class="admin-create-payment-heading">
          <strong>Pilih Kaedah Bayaran</strong>
          <span>Muat naik bukti bayaran atau sediakan dokumen untuk bayaran fizikal.</span>
        </div>
        <div class="admin-create-payment-grid">
          <button class="admin-create-payment-option" type="button" onclick="selectAdminCreatePaymentMode('receipt')">
            <i class="bi bi-receipt"></i>
            <span><strong>Muat Naik Bukti Bayaran</strong><small>JPG, PNG, GIF atau PDF (maks. 5 MB)</small></span>
          </button>
          <button class="admin-create-payment-option" type="button" onclick="selectAdminCreatePaymentMode('physical')">
            <i class="bi bi-printer"></i>
            <span><strong>Bayaran Fizikal</strong><small>Cetak dokumen selepas tempahan dicipta</small></span>
          </button>
        </div>
        <input id="adminBookingReceipt" type="file" accept=".jpg,.jpeg,.png,.gif,.pdf" class="is-hidden" onchange="handleAdminCreateReceiptChange()">
        <div class="admin-create-payment-status" id="adminCreatePaymentStatus"></div>
      </div>
      <input type="hidden" id="adminBookingEnd">
    </form>
  `;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" type="button" onclick="${standalonePage ? 'window.location.href=ROUTES.adminDashboard' : "closeModal('bookingModal')"}"><i class="bi bi-arrow-left"></i> Kembali</button>
    <button class="btn btn-secondary" id="adminCreatePaymentButton" type="button" onclick="toggleAdminCreatePaymentOptions()" aria-expanded="false"><i class="bi bi-wallet2"></i> Bayaran</button>
    <button class="btn btn-primary" id="adminCreateBookingButton" type="submit" form="adminCreateBookingForm"><i class="bi bi-plus-lg"></i> Cipta Tempahan</button>
  `;
  if (!standalonePage) document.getElementById('bookingModal')?.classList.add('active');
  syncAdminCreateBookingFields();
}

async function renderAdminCreateBookingPage() {
  if (!document.getElementById('adminCreateBookingPage')) return;
  await loadFacilities();
  openAdminCreateBookingModal();
}

function toggleAdminCreatePaymentOptions() {
  const options = document.getElementById('adminCreatePaymentOptions');
  const button = document.getElementById('adminCreatePaymentButton');
  if (!options || !button) return;
  const willOpen = options.classList.contains('is-hidden');
  options.classList.toggle('is-hidden', !willOpen);
  button.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) options.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function selectAdminCreatePaymentMode(mode) {
  if (mode === 'receipt') {
    const input = document.getElementById('adminBookingReceipt');
    if (!input) return;
    input.value = '';
    input.click();
    return;
  }
  adminCreatePaymentMode = 'physical';
  adminCreateReceiptFile = null;
  const input = document.getElementById('adminBookingReceipt');
  if (input) input.value = '';
  updateAdminCreatePaymentSelection();
}

function handleAdminCreateReceiptChange() {
  const input = document.getElementById('adminBookingReceipt');
  const file = input?.files?.[0] || null;
  if (!file) return;
  if (!isValidReceiptFile(file)) {
    input.value = '';
    adminCreatePaymentMode = '';
    adminCreateReceiptFile = null;
    updateAdminCreatePaymentSelection();
    showToast('Fail bukti bayaran mestilah dalam format JPG, PNG, GIF atau PDF dan tidak melebihi 5 MB.', 'error');
    return;
  }
  adminCreatePaymentMode = 'receipt';
  adminCreateReceiptFile = file;
  updateAdminCreatePaymentSelection();
}

function updateAdminCreatePaymentSelection() {
  const options = document.getElementById('adminCreatePaymentOptions');
  const button = document.getElementById('adminCreatePaymentButton');
  const status = document.getElementById('adminCreatePaymentStatus');
  document.querySelectorAll('.admin-create-payment-option').forEach((option, index) => {
    const active = (index === 0 && adminCreatePaymentMode === 'receipt') || (index === 1 && adminCreatePaymentMode === 'physical');
    option.classList.toggle('is-active', active);
  });
  if (button) {
    button.innerHTML = adminCreatePaymentMode === 'receipt'
      ? '<i class="bi bi-receipt-check"></i> Bukti Bayaran Dipilih'
      : adminCreatePaymentMode === 'physical'
        ? '<i class="bi bi-printer"></i> Bayaran Fizikal'
        : '<i class="bi bi-wallet2"></i> Bayaran';
    button.setAttribute('aria-expanded', 'false');
  }
  if (status) {
    status.innerHTML = adminCreatePaymentMode === 'receipt'
      ? `<i class="bi bi-check-circle"></i> ${escapeHtml(adminCreateReceiptFile?.name || 'Bukti bayaran dipilih')}`
      : adminCreatePaymentMode === 'physical'
        ? '<i class="bi bi-check-circle"></i> Dokumen bayaran fizikal akan dibuka untuk cetakan selepas tempahan berjaya dicipta.'
        : '';
  }
  options?.classList.add('is-hidden');
}

function adminCreateBookingFacilityOptions() {
  const options = facilitiesCache.filter((facility) => facility.is_available);
  if (!options.length) return '<option value="">Tiada fasiliti tersedia</option>';
  return options.map((facility) => `<option value="${escapeAttr(facility.id)}">${escapeHtml(facility.name)} - RM${escapeHtml(String(facility.price_per_hour))}</option>`).join('');
}

function getAdminCreateSelectedFacility() {
  const id = document.getElementById('adminBookingFacility')?.value || '';
  return facilitiesCache.find((facility) => String(facility.id) === String(id));
}

function syncAdminCreateBookingFields() {
  const facility = getAdminCreateSelectedFacility();
  const asrama = isAsramaRoomFacility(facility);
  document.querySelectorAll('[data-admin-create-time], [data-admin-create-equipment], [data-admin-create-participants]').forEach((field) => {
    field.classList.toggle('is-hidden', asrama);
    field.querySelectorAll('input, textarea, select, button').forEach((control) => { control.disabled = asrama; });
  });
  document.querySelector('.admin-create-asrama')?.classList.toggle('is-hidden', !asrama);
  document.querySelectorAll('.admin-create-asrama input, .admin-create-asrama button').forEach((control) => { control.disabled = !asrama; });

  const unitEl = document.getElementById('adminBookingDurationUnit');
  const durationEl = document.getElementById('adminBookingDuration');
  if (asrama) {
    if (unitEl) unitEl.value = 'day';
    if (durationEl) durationEl.max = '30';
    const startEl = document.getElementById('adminBookingStart');
    const endEl = document.getElementById('adminBookingEnd');
    if (startEl) startEl.value = '00:00';
    if (endEl) endEl.value = '';
    normalizeAdminCreateRooms();
  } else if (durationEl) {
    durationEl.max = unitEl?.value === 'day' ? '30' : '24';
  }
  renderAdminCreateEquipmentOptions();
  syncAdminCreateBookingEndTime();
}

function renderAdminCreateEquipmentOptions() {
  const grid = document.getElementById('adminCreateEquipmentGrid');
  const input = document.getElementById('adminBookingEquipment');
  const facility = getAdminCreateSelectedFacility();
  if (!grid || !input) return;

  const options = facility?.equipment_options || [];
  const optionNames = options.map((option) => String(option?.name || option || '').trim()).filter(Boolean);
  const selected = new Set(String(input.value || '').split(',').map((item) => item.trim()).filter((item) => optionNames.includes(item)));
  input.value = Array.from(selected).join(', ');
  if (!options.length) {
    input.value = '';
    grid.innerHTML = '<div class="admin-create-equipment-empty">Tiada peralatan ditetapkan untuk fasiliti ini.</div>';
    return;
  }

  grid.innerHTML = optionNames.map((name) => {
    const active = selected.has(name);
    return `<button type="button" class="admin-create-equipment-option ${active ? 'is-active' : ''}" onclick="toggleAdminCreateEquipment(${escapeAttr(JSON.stringify(name))})" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(name)}</button>`;
  }).join('');
}

function toggleAdminCreateEquipment(name) {
  const input = document.getElementById('adminBookingEquipment');
  if (!input) return;
  const selected = new Set(String(input.value || '').split(',').map((item) => item.trim()).filter(Boolean));
  if (selected.has(name)) selected.delete(name);
  else selected.add(name);
  input.value = Array.from(selected).join(', ');
  renderAdminCreateEquipmentOptions();
}

function syncAdminCreateBookingEndTime() {
  const facility = getAdminCreateSelectedFacility();
  const unit = document.getElementById('adminBookingDurationUnit')?.value || 'hour';
  const duration = Number(document.getElementById('adminBookingDuration')?.value || 1);
  const start = document.getElementById('adminBookingStart')?.value || '';
  const endEl = document.getElementById('adminBookingEnd');
  if (!endEl || unit !== 'hour' || isAsramaRoomFacility(facility)) {
    if (endEl) endEl.value = '';
    return;
  }
  const startMinutes = bookingTimeToMinutes(start);
  if (startMinutes === null || !Number.isFinite(duration)) {
    endEl.value = '';
    return;
  }
  const endMinutes = startMinutes + (Math.max(1, Math.floor(duration)) * 60);
  endEl.value = endMinutes < 1440
    ? `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
    : '';
}

function normalizeAdminCreateRooms() {
  const facility = getAdminCreateSelectedFacility();
  if (!isAsramaRoomFacility(facility)) return 1;
  const limits = asramaConfiguredLimitsForDates(
    facility,
    document.getElementById('adminBookingDate')?.value || '',
    document.getElementById('adminBookingDuration')?.value || '1'
  );
  const maxRooms = limits.male + limits.female;
  const lelakiEl = document.getElementById('adminBookingLelakiRooms');
  const perempuanEl = document.getElementById('adminBookingPerempuanRooms');
  if (!lelakiEl || !perempuanEl) return 1;
  let lelaki = Math.max(0, Math.floor(Number(lelakiEl.value || 0)));
  let perempuan = Math.max(0, Math.floor(Number(perempuanEl.value || 0)));
  lelaki = Math.min(lelaki, limits.male);
  perempuan = Math.min(perempuan, limits.female);
  if (lelaki + perempuan < 1 && maxRooms > 0) {
    if (limits.male > 0) lelaki = 1;
    else perempuan = 1;
  }
  lelakiEl.max = String(limits.male);
  perempuanEl.max = String(limits.female);
  lelakiEl.value = String(lelaki);
  perempuanEl.value = String(perempuan);
  setText('adminCreateRoomTotal', lelaki + perempuan);
  setText('adminCreateRoomLimit', `Had tarikh: ${limits.male} lelaki + ${limits.female} perempuan`);
  setText('adminCreateLelakiHint', `${lelaki} / ${limits.male} bilik`);
  setText('adminCreatePerempuanHint', `${perempuan} / ${limits.female} bilik`);
  return lelaki + perempuan;
}

function adjustAdminCreateAsramaRoom(side, delta) {
  const input = document.getElementById(side === 'perempuan' ? 'adminBookingPerempuanRooms' : 'adminBookingLelakiRooms');
  if (!input) return;
  input.value = String(Number(input.value || 0) + delta);
  normalizeAdminCreateRooms();
}

async function createAdminBookingRequest(data, receiptFile = null) {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') formData.append(key, value);
  });
  if (receiptFile) formData.append('payment_file', receiptFile);

  return requestApiJson(`${API_BASE}/bookings.php?action=admin-create`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  }, 'Tempahan gagal dicipta. Sila cuba lagi.', receiptFile ? API_TIMEOUT_UPLOAD : API_TIMEOUT_BOOKING);
}

function openAdminPhysicalPaymentWindow() {
  const printWindow = window.open('', 'polspace-physical-payment', 'width=860,height=720');
  if (!printWindow) return null;
  printWindow.document.open();
  printWindow.document.write('<!doctype html><html lang="ms"><head><title>Menyediakan dokumen...</title></head><body style="font-family:Arial,sans-serif;padding:40px">Menyediakan dokumen bayaran fizikal...</body></html>');
  printWindow.document.close();
  return printWindow;
}

function printAdminPhysicalPayment(printWindow, bookingRef, data, facility) {
  if (!printWindow || printWindow.closed) return;
  const durationLabel = `${escapeHtml(data.duration)} ${data.duration_unit === 'day' ? 'hari' : 'jam'}`;
  const timeLabel = data.duration_unit === 'day'
    ? 'Sepanjang hari'
    : `${escapeHtml(data.start_time)} - ${escapeHtml(data.end_time || '-')}`;
  const roomMultiplier = isAsramaRoomFacility(facility) ? Math.max(1, Number(data.room_count || 1)) : 1;
  const amount = Number(facility?.price_per_hour || 0) * Math.max(1, Number(data.duration || 1)) * roomMultiplier;
  const createdAt = new Date().toLocaleString('ms-MY', { dateStyle: 'long', timeStyle: 'short' });
  const html = `<!doctype html>
    <html lang="ms">
    <head>
      <meta charset="utf-8">
      <title>Bayaran Fizikal ${escapeHtml(bookingRef)}</title>
      <style>
        *{box-sizing:border-box} body{margin:0;background:#f2f2f2;color:#171717;font-family:Arial,sans-serif}
        .sheet{width:190mm;min-height:260mm;margin:12mm auto;padding:18mm;background:#fff;border:1px solid #ddd}
        .header{display:flex;justify-content:space-between;gap:24px;padding-bottom:20px;border-bottom:3px solid #171717}
        h1{margin:0;font-size:28px} .subtitle{margin-top:7px;color:#555;font-size:14px}.ref{text-align:right}.ref strong{display:block;font-size:20px;margin-top:5px}
        .badge{display:inline-block;margin:22px 0;padding:8px 12px;border:1px solid #171717;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:0 32px}.row{display:flex;justify-content:space-between;gap:18px;padding:12px 0;border-bottom:1px solid #ddd;font-size:14px}.row span{color:#666}.row strong{text-align:right}
        .amount{display:flex;justify-content:space-between;align-items:center;margin:28px 0;padding:18px;background:#f4f1e8;border:1px solid #d8c992}.amount strong{font-size:25px}
        .method{padding:16px;border:1px solid #bbb}.method-title{font-weight:700;margin-bottom:14px}.checks{display:flex;gap:28px;font-size:14px}.box{display:inline-block;width:17px;height:17px;margin-right:7px;border:1px solid #333;vertical-align:middle}
        .signatures{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:70px}.signature{padding-top:9px;border-top:1px solid #333;font-size:13px}.signature small{display:block;margin-top:7px;color:#666}
        .footer{margin-top:40px;color:#777;font-size:11px;text-align:center}
        @page{size:A4;margin:0}@media print{body{background:#fff}.sheet{margin:0;border:0;width:auto;min-height:auto}}
      </style>
    </head>
    <body>
      <main class="sheet">
        <div class="header"><div><h1>PoliSpace</h1><div class="subtitle">Dokumen Bayaran Fizikal Tempahan Fasiliti</div></div><div class="ref"><span>No. Rujukan Tempahan</span><strong>${escapeHtml(bookingRef)}</strong></div></div>
        <div class="badge">Untuk Bayaran Fizikal</div>
        <div class="grid">
          <div class="row"><span>Nama Pelanggan</span><strong>${escapeHtml(data.full_name)}</strong></div>
          <div class="row"><span>No. Telefon</span><strong>${escapeHtml(data.phone)}</strong></div>
          <div class="row"><span>Alamat E-mel</span><strong>${escapeHtml(data.email)}</strong></div>
          <div class="row"><span>Fasiliti</span><strong>${escapeHtml(facility?.name || '-')}</strong></div>
          <div class="row"><span>Tarikh Tempahan</span><strong>${escapeHtml(formatDate(data.booking_date))}</strong></div>
          <div class="row"><span>Masa</span><strong>${timeLabel}</strong></div>
          <div class="row"><span>Tempoh</span><strong>${durationLabel}</strong></div>
          <div class="row"><span>Permohonan Dicipta</span><strong>${escapeHtml(createdAt)}</strong></div>
        </div>
        <div class="row"><span>Tujuan</span><strong>${escapeHtml(data.purpose)}</strong></div>
        <div class="amount"><span>Jumlah Perlu Dibayar</span><strong>RM${amount.toFixed(2)}</strong></div>
        <div class="method"><div class="method-title">Kaedah bayaran diterima</div><div class="checks"><span><i class="box"></i>Tunai</span><span><i class="box"></i>Kad</span><span><i class="box"></i>Lain-lain: __________________</span></div></div>
        <div class="signatures"><div class="signature">Tandatangan Pelanggan<small>Nama / Tarikh</small></div><div class="signature">Diterima Oleh<small>Nama Pentadbir / Tarikh</small></div></div>
        <div class="footer">Simpan dokumen ini sebagai rekod bayaran fizikal bagi tempahan ${escapeHtml(bookingRef)}.</div>
      </main>
    </body>
    </html>`;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 300);
}

async function submitAdminCreateBooking(event) {
  event.preventDefault();
  const button = document.getElementById('adminCreateBookingButton');
  const facility = getAdminCreateSelectedFacility();
  const asrama = isAsramaRoomFacility(facility);
  const roomCount = asrama ? normalizeAdminCreateRooms() : 1;
  const data = {
    full_name: document.getElementById('adminBookingName')?.value.trim() || '',
    email: document.getElementById('adminBookingEmail')?.value.trim() || '',
    phone: document.getElementById('adminBookingPhone')?.value.trim() || '',
    facility_id: document.getElementById('adminBookingFacility')?.value || '',
    booking_date: document.getElementById('adminBookingDate')?.value || '',
    start_time: asrama ? '00:00' : (document.getElementById('adminBookingStart')?.value || ''),
    end_time: asrama ? '' : (document.getElementById('adminBookingEnd')?.value || ''),
    duration: String(Math.max(1, Math.floor(Number(document.getElementById('adminBookingDuration')?.value || 1)))),
    duration_unit: asrama ? 'day' : (document.getElementById('adminBookingDurationUnit')?.value || 'hour'),
    purpose: document.getElementById('adminBookingPurpose')?.value.trim() || '',
    equipment_required: asrama ? '' : (document.getElementById('adminBookingEquipment')?.value.trim() || ''),
    participant_count: asrama ? roomCount * Number(facility?.capacity || 1) : Number(document.getElementById('adminBookingParticipants')?.value || 0),
    asrama_lelaki_rooms: asrama ? Number(document.getElementById('adminBookingLelakiRooms')?.value || 0) : 0,
    asrama_perempuan_rooms: asrama ? Number(document.getElementById('adminBookingPerempuanRooms')?.value || 0) : 0,
    room_count: roomCount,
    setup_required: 'full',
    status: 'approved',
  };

  if (!data.full_name || !data.email || !data.phone || !data.facility_id || !data.booking_date || !data.purpose) {
    showToast('Sila lengkapkan maklumat tempahan.', 'error');
    return;
  }
  if (!asrama && data.duration_unit === 'hour' && !data.end_time) {
    showToast('Tempahan jam mesti tamat pada hari yang sama.', 'error');
    return;
  }
  if (!adminCreatePaymentMode) {
    showToast('Pilih sama ada untuk memuat naik bukti bayaran atau membuat bayaran secara fizikal.', 'error');
    toggleAdminCreatePaymentOptions();
    return;
  }
  if (adminCreatePaymentMode === 'receipt' && !adminCreateReceiptFile) {
    showToast('Sila pilih fail bukti bayaran.', 'error');
    toggleAdminCreatePaymentOptions();
    return;
  }

  const printWindow = adminCreatePaymentMode === 'physical' ? openAdminPhysicalPaymentWindow() : null;
  if (adminCreatePaymentMode === 'physical' && !printWindow) {
    showToast('Pelayar menyekat tetingkap cetakan. Benarkan pop-up dan cuba lagi.', 'error');
    return;
  }

  if (button) setButtonLoading(button, true, adminCreatePaymentMode === 'receipt' ? 'Sedang memuat naik bukti bayaran...' : 'Menyimpan tempahan...');
  try {
    const result = await createAdminBookingRequest(data, adminCreatePaymentMode === 'receipt' ? adminCreateReceiptFile : null);
    if (printWindow) printAdminPhysicalPayment(printWindow, result.booking_ref || '-', data, facility);
    if (document.getElementById('adminCreateBookingPage')) {
      showToast(`Tempahan ${result.booking_ref || ''} berjaya dicipta.`, 'success');
      window.setTimeout(() => { window.location.href = ROUTES.adminDashboard; }, 700);
    } else {
      closeModal('bookingModal');
      showToast(`Tempahan ${result.booking_ref || ''} berjaya dicipta.`, 'success');
      await renderAdminDashboard();
    }
  } catch (error) {
    if (printWindow && !printWindow.closed) printWindow.close();
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Tempahan gagal dicipta.', 'error');
  } finally {
    if (button) setButtonLoading(button, false);
  }
}

function renderFacilityManagement(facilities) {
  const grid = document.getElementById('facilityManageGrid');
  if (!grid) return;
  if (document.getElementById('facilityEquipment') && !document.getElementById('facilityEquipment').value) {
    setAdminEquipmentOptions('facilityEquipment', defaultAdminEquipmentOptions());
  }
  if (!facilities.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="bi bi-building-slash"></i></div><div class="empty-state-title">Tiada Fasiliti</div></div>';
  } else grid.innerHTML = facilities.map((f) => `
    <div class="facility-manage-card">
      <div class="fmc-header"><div class="fmc-icon">${facilityIconHtml(f)}</div>${statusBadgeHtml(f.is_available ? 'available' : 'unavailable')}</div>
      <div class="fmc-name">${escapeHtml(f.name)}</div>
      <div class="fmc-cap">${isAsramaRoomFacility(f) ? `Kapasiti: ${escapeHtml(f.capacity)} orang setiap bilik - had mengikut tarikh` : `Kapasiti: ${escapeHtml(f.capacity)} orang`} - RM${escapeHtml(f.price_per_hour)}</div>
      <div class="fmc-pic"><i class="bi bi-person-badge"></i> <strong>${escapeHtml(f.pic_full_name || 'Tiada PIC')}</strong><span>${escapeHtml(f.pic_phone || '-')}</span></div>
      ${f.pic_email ? `<div class="fmc-pic-email"><i class="bi bi-envelope"></i> ${escapeHtml(f.pic_email)}</div>` : ''}
      <div class="fmc-equipment">${facilityEquipmentSummaryHtml(f)}</div>
      <div class="fmc-footer">
        <div class="fmc-actions">${isAsramaRoomFacility(f) ? `<button class="btn btn-primary btn-sm" type="button" onclick="window.location.href=ROUTES.adminAsrama"><i class="bi bi-sliders"></i> Urus Bilik</button>` : ''}<button class="btn btn-secondary btn-sm" type="button" onclick="openFacilityEditModal('${escapeAttr(f.id)}')"><i class="bi bi-pencil-square"></i> Edit</button></div>
        <div class="fmc-availability"><span>${f.is_available ? 'Aktif' : 'Tidak Tersedia'}</span><button class="toggle-switch ${f.is_available ? 'on' : ''}" type="button" role="switch" aria-checked="${Boolean(f.is_available)}" aria-label="Ketersediaan ${escapeAttr(f.name)}" onclick="toggleFacility('${escapeAttr(f.id)}')"></button></div>
      </div>
    </div>
  `).join('');
  if (facilitiesLoadError) {
    grid.insertAdjacentHTML('afterbegin', '<div class="facilities-load-warning" role="status"><i class="bi bi-exclamation-circle" aria-hidden="true"></i><span>Senarai fasiliti mungkin belum dikemas kini.</span><button class="btn btn-secondary btn-sm" id="retryAdminFacilitiesButton" type="button"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Cuba Lagi</button></div>');
    grid.querySelector('#retryAdminFacilitiesButton')?.addEventListener('click', () => refreshPicAndFacilityManagement());
  }
}

function normalizePics(pics = []) {
  return pics.map((pic) => ({
    id: String(pic.id),
    full_name: pic.full_name || '',
    phone: pic.phone || '',
    email: pic.email || '',
    facility_ids: (pic.facility_ids || []).map(String),
    facility_names: pic.facility_names || [],
  }));
}

async function loadPics() {
  try {
    const result = await tryApi('pics.php');
    adminPicsCache = normalizePics(result.data || []);
    adminPicsLoaded = true;
    adminPicsLoadError = null;
    const facilityPicSelect = document.getElementById('facilityPicId');
    if (facilityPicSelect) {
      const selected = facilityPicSelect.value;
      facilityPicSelect.innerHTML = picSelectOptionsHtml(selected);
    }
    if (document.getElementById('picManageGrid')) renderPicManagement(adminPicsCache);
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return [];
    adminPicsLoadError = error;
    if (adminPicsLoaded) showToast(error.message || 'Senarai PIC tidak dapat dikemas kini. Data sebelumnya masih dipaparkan.', 'error');
    else if (document.getElementById('picManageGrid')) {
      showErrorState(document.getElementById('picManageGrid'), error.message || 'Tidak dapat menghubungi pelayan. Sila cuba lagi.', () => loadPics());
    } else showToast(error.message || 'Senarai PIC tidak dapat dimuatkan.', 'error');
  }
  return adminPicsCache;
}

function picSelectOptionsHtml(selectedId = '') {
  const selected = String(selectedId || '');
  return `<option value="">Pilih PIC</option>${adminPicsCache.map((pic) => `
    <option value="${escapeAttr(pic.id)}" ${pic.id === selected ? 'selected' : ''}>${escapeHtml(pic.full_name)}</option>
  `).join('')}`;
}

function renderPicManagement(pics = adminPicsCache) {
  const container = document.getElementById('picManageGrid');
  if (!container) return;
  if (!adminPicsLoaded && adminPicsLoadError) {
    showErrorState(container, adminPicsLoadError.message || 'Tidak dapat menghubungi pelayan. Sila cuba lagi.', () => loadPics());
    return;
  }
  const total = pics.length;
  const query = document.getElementById('adminPicSearch')?.value || '';
  pics = pics.filter((pic) => matchesAdminSearch(query, [pic.full_name, pic.phone, pic.email, ...pic.facility_names]));
  setText('picResultCount', `${pics.length} daripada ${total} PIC`);
  if (!pics.length) {
    container.innerHTML = `<div class="admin-card empty-state"><div class="empty-state-icon"><i class="bi bi-person-x"></i></div><div class="empty-state-title">${query.trim() ? 'Tiada padanan PIC' : 'Belum ada PIC'}</div><p>${query.trim() ? 'Cuba cari menggunakan nama, alamat e-mel atau fasiliti.' : 'Tambah PIC untuk mengurus fasiliti.'}</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="admin-card pic-table-card">
      <div class="data-table-wrap">
        <table class="data-table pic-management-table">
          <thead><tr><th>Nama</th><th>No. Telefon</th><th>Alamat E-mel</th><th>Fasiliti Ditugaskan</th><th>Tindakan</th></tr></thead>
          <tbody>${pics.map((pic) => `
            <tr>
              <td><div class="tenant-name">${escapeHtml(pic.full_name)}</div></td>
              <td class="table-phone">${escapeHtml(pic.phone || '-')}</td>
              <td><span class="table-email" title="${escapeAttr(pic.email || '')}">${escapeHtml(pic.email || '-')}</span></td>
              <td><div class="pic-facility-tags">${pic.facility_names.length
                ? pic.facility_names.map((name) => `<span>${escapeHtml(name)}</span>`).join('')
                : '<em>Tiada PIC</em>'}</div></td>
              <td><div class="table-actions pic-table-actions">
                <button class="btn btn-secondary btn-sm table-icon-btn" type="button" onclick="openPicEditModal('${escapeAttr(pic.id)}')" title="Edit PIC" aria-label="Edit maklumat ${escapeAttr(pic.full_name)}"><i class="bi bi-pencil-square"></i></button>
                <button class="btn btn-secondary btn-sm table-icon-btn" type="button" onclick="sendPicTestEmailRequest('${escapeAttr(pic.id)}')" title="Hantar E-mel" aria-label="Hantar E-mel kepada ${escapeAttr(pic.full_name)}"><i class="bi bi-envelope"></i></button>
                <button class="btn btn-danger btn-sm table-icon-btn" type="button" onclick="deletePic('${escapeAttr(pic.id)}')" title="Padam PIC" aria-label="Padam ${escapeAttr(pic.full_name)}"><i class="bi bi-trash3"></i></button>
              </div></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

function facilityEquipmentSummaryHtml(facility) {
  const options = facility.equipment_options || [];
  if (!options.length) return '<div class="fmc-equipment-empty">Tiada peralatan ditetapkan</div>';
  return `
    <div class="fmc-equipment-list">
      ${options.slice(0, 4).map((item) => `<span>${escapeHtml(item.name)}</span>`).join('')}
      ${options.length > 4 ? `<span>+${options.length - 4}</span>` : ''}
    </div>
  `;
}

function adminEquipmentTextareaValue(facility) {
  return (facility.equipment_options || []).map((item) => item.name).join('\n');
}

function defaultAdminEquipmentOptions() {
  return ['Mikrofon', 'Projektor', 'PA System', 'Kerusi Tambahan', 'Meja Tambahan'];
}

function parseAdminEquipmentValue(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item?.name || item || '').trim()).filter(Boolean);
  } catch (error) {
    return raw.split(/\r\n|\r|\n|,/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function uniqueAdminEquipmentItems(items = []) {
  const seen = new Set();
  return items.reduce((next, item) => {
    const name = String(item || '').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return next;
    seen.add(key);
    next.push(name);
    return next;
  }, []);
}

function setAdminEquipmentOptions(inputId, items = []) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.value = uniqueAdminEquipmentItems(items).join('\n');
  renderAdminEquipmentOptions(inputId);
}

function renderAdminEquipmentOptions(inputId) {
  const input = document.getElementById(inputId);
  const grid = document.getElementById(`${inputId}Grid`);
  if (!input || !grid) return;

  const items = parseAdminEquipmentValue(input.value);
  if (!items.length) {
    grid.innerHTML = '<div class="admin-equipment-empty">Tiada peralatan ditetapkan</div>';
    return;
  }

  grid.innerHTML = items.map((name) => `
    <div class="admin-equipment-option">
      <span>${escapeHtml(name)}</span>
      <button type="button" onclick="removeAdminEquipmentOption('${escapeAttr(inputId)}', ${escapeAttr(JSON.stringify(name))})" aria-label="Buang ${escapeAttr(name)}"><i class="bi bi-x-lg"></i></button>
    </div>
  `).join('');
}

function addAdminEquipmentOption(inputId) {
  const addInput = document.getElementById(`${inputId}New`);
  const name = addInput?.value.trim() || '';
  if (!name) return;
  setAdminEquipmentOptions(inputId, [...parseAdminEquipmentValue(document.getElementById(inputId)?.value || ''), name]);
  if (addInput) addInput.value = '';
}

function removeAdminEquipmentOption(inputId, name) {
  setAdminEquipmentOptions(
    inputId,
    parseAdminEquipmentValue(document.getElementById(inputId)?.value || '').filter((item) => item !== name)
  );
}

const ADMIN_FACILITY_ICONS = [
  ['bi-building', 'Bangunan'],
  ['bi-bank', 'Dewan / Auditorium'],
  ['bi-door-open', 'Bilik'],
  ['bi-easel', 'Bilik Mesyuarat'],
  ['bi-pc-display', 'Makmal Komputer'],
  ['bi-mortarboard', 'Bilik Kuliah'],
  ['bi-people', 'Ruang Berkumpulan'],
  ['bi-camera-video', 'Studio'],
  ['bi-house-door', 'Asrama'],
  ['bi-book', 'Perpustakaan'],
];

function adminFacilityIconOptionsHtml(selectedIcon = 'bi-building') {
  const selected = String(selectedIcon || 'bi-building');
  const options = [...ADMIN_FACILITY_ICONS];
  if (!options.some(([value]) => value === selected)) options.unshift([selected, 'Ikon semasa']);
  return options.map(([value, label]) => `<option value="${escapeAttr(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}

function updateFacilityIconPreview(selectId, previewId) {
  const select = document.getElementById(selectId);
  const preview = document.getElementById(previewId);
  if (!select || !preview) return;
  const icon = String(select.value || 'bi-building').replace(/[^a-z0-9-]/gi, '') || 'bi-building';
  preview.innerHTML = `<i class="bi ${escapeAttr(icon)}"></i>`;
}

async function addFacility(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById('addFacilityButton');
  const formData = new FormData(form);
  const data = {
    name: String(formData.get('name') || '').trim(),
    icon: String(formData.get('icon') || 'bi-building').trim() || 'bi-building',
    capacity: Number(formData.get('capacity') || 0),
    price_per_hour: Number(formData.get('price_per_hour') || 0),
    max_rooms: formData.get('max_rooms') === '' ? null : Number(formData.get('max_rooms') || 0),
    description: String(formData.get('description') || '').trim(),
    pic_id: String(formData.get('pic_id') || '').trim() || null,
    equipment_options: parseAdminEquipmentValue(formData.get('equipment_options') || ''),
    is_available: formData.has('is_available'),
  };

  if (!data.name || data.capacity < 1 || data.price_per_hour < 0 || (data.max_rooms !== null && data.max_rooms < 1)) {
    showToast('Sila lengkapkan maklumat fasiliti.', 'error');
    return;
  }

  if (button) setButtonLoading(button, true, 'Menyimpan fasiliti...');
  try {
    const result = await tryApi('facilities.php', 'POST', data);
    const created = normalizeFacilities([result.data])[0];
    facilitiesCache.push(created);
    await loadPics();
    renderFacilityManagement(facilitiesCache);
    renderPicManagement(adminPicsCache);
    form.reset();
    const iconInput = document.getElementById('facilityIcon');
    if (iconInput) iconInput.value = 'bi-building';
    updateFacilityIconPreview('facilityIcon', 'facilityIconPreview');
    const availableInput = document.getElementById('facilityAvailable');
    if (availableInput) availableInput.checked = true;
    setAdminEquipmentOptions('facilityEquipment', defaultAdminEquipmentOptions());
    showToast('Fasiliti berjaya ditambah.', 'success');
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Fasiliti gagal ditambah.', 'error');
  } finally {
    if (button) setButtonLoading(button, false);
  }
}

function openFacilityEditModal(id) {
  const facility = facilitiesCache.find((item) => String(item.id) === String(id));
  if (!facility) return;

  setText('modalTitle', `Edit Fasiliti - ${facility.name}`);
  document.getElementById('modalBody').innerHTML = `
    <div class="edit-facility-form">
      <section class="edit-facility-section span-2">
        <div class="admin-facility-section-title">Maklumat Fasiliti</div>
        <div class="edit-facility-section-grid">
          <div class="form-group">
            <label for="editFacilityName">Nama Fasiliti *</label>
            <input type="text" id="editFacilityName" maxlength="100" value="${escapeAttr(facility.name)}">
          </div>
          <div class="form-group">
            <label for="editFacilityIcon">Ikon Fasiliti</label>
            <div class="admin-icon-select">
              <span class="admin-icon-preview" id="editFacilityIconPreview"><i class="bi ${escapeAttr(facility.icon || 'bi-building')}"></i></span>
              <select id="editFacilityIcon" onchange="updateFacilityIconPreview('editFacilityIcon', 'editFacilityIconPreview')">${adminFacilityIconOptionsHtml(facility.icon)}</select>
            </div>
          </div>
          <div class="form-group">
            <label for="editFacilityCapacity">Kapasiti *</label>
            <input type="number" id="editFacilityCapacity" min="1" max="5000" value="${escapeAttr(String(facility.capacity || 1))}">
          </div>
          <div class="form-group">
            <label for="editFacilityPrice">Harga (RM) *</label>
            <input type="number" id="editFacilityPrice" min="0" max="999999.99" step="0.01" value="${escapeAttr(String(facility.price_per_hour || 0))}">
          </div>
          ${isAsramaRoomFacility(facility) ? '<div class="form-group"><label>Had Bilik</label><div class="admin-field-note"><i class="bi bi-sliders"></i> Diurus melalui halaman Urus Bilik.</div><input type="hidden" id="editFacilityMaxRooms" value="' + escapeAttr(String(facility.max_rooms || '')) + '"></div>' : `<div class="form-group"><label for="editFacilityMaxRooms">Had Bilik</label><input type="number" id="editFacilityMaxRooms" min="1" max="500" value="${escapeAttr(String(facility.max_rooms || ''))}" placeholder="10"></div>`}
          <label class="admin-facility-check">
            <input type="checkbox" id="editFacilityAvailable" ${facility.is_available ? 'checked' : ''}>
            <span>Tersedia untuk tempahan</span>
          </label>
          <div class="form-group span-2">
            <label for="editFacilityDescription">Keterangan</label>
            <textarea id="editFacilityDescription" maxlength="2000" rows="3">${escapeHtml(facility.description || '')}</textarea>
          </div>
          <div class="form-group span-2">
            <label for="editFacilityEquipment">Peralatan</label>
            <input type="hidden" id="editFacilityEquipment" value="${escapeAttr(adminEquipmentTextareaValue(facility))}">
            <div class="admin-equipment-builder" data-equipment-builder="editFacilityEquipment">
              <div class="admin-equipment-add-row">
                <input type="text" id="editFacilityEquipmentNew" placeholder="cth: Mikrofon" onkeydown="if(event.key==='Enter'){event.preventDefault();addAdminEquipmentOption('editFacilityEquipment')}">
                <button class="btn btn-secondary btn-sm" type="button" onclick="addAdminEquipmentOption('editFacilityEquipment')"><i class="bi bi-plus-lg"></i> Tambah</button>
              </div>
              <div class="admin-equipment-grid" id="editFacilityEquipmentGrid"></div>
            </div>
          </div>
        </div>
      </section>
      <section class="edit-facility-section span-2">
        <div class="admin-facility-section-title">Tugasan PIC</div>
        <div class="form-group">
          <label for="editFacilityPicId">PIC Fasiliti</label>
          <select id="editFacilityPicId">${picSelectOptionsHtml(facility.pic_id)}</select>
          <div class="admin-note-help">Pilih “Pilih PIC” untuk mengosongkan tugasan. Rekod PIC tidak akan dipadam.</div>
        </div>
      </section>
    </div>
  `;
  renderAdminEquipmentOptions('editFacilityEquipment');
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('bookingModal')">Kembali</button>
    <button class="btn btn-primary" id="updateFacilityButton" onclick="updateFacility('${escapeAttr(facility.id)}')"><i class="bi bi-check-lg"></i> Simpan</button>
  `;
  document.getElementById('bookingModal')?.classList.add('active');
}

async function updateFacility(id) {
  const button = document.getElementById('updateFacilityButton');
  const data = {
    name: document.getElementById('editFacilityName')?.value.trim() || '',
    icon: document.getElementById('editFacilityIcon')?.value.trim() || 'bi-building',
    capacity: Number(document.getElementById('editFacilityCapacity')?.value || 0),
    price_per_hour: Number(document.getElementById('editFacilityPrice')?.value || 0),
    max_rooms: document.getElementById('editFacilityMaxRooms')?.value === '' ? null : Number(document.getElementById('editFacilityMaxRooms')?.value || 0),
    description: document.getElementById('editFacilityDescription')?.value.trim() || '',
    pic_id: document.getElementById('editFacilityPicId')?.value || null,
    equipment_options: parseAdminEquipmentValue(document.getElementById('editFacilityEquipment')?.value || ''),
    is_available: Boolean(document.getElementById('editFacilityAvailable')?.checked),
  };

  if (!data.name || data.capacity < 1 || data.price_per_hour < 0 || (data.max_rooms !== null && data.max_rooms < 1)) {
    showToast('Sila lengkapkan maklumat fasiliti.', 'error');
    return;
  }

  if (button) setButtonLoading(button, true, 'Menyimpan perubahan...');
  try {
    const result = await tryApi(`facilities.php?id=${encodeURIComponent(id)}`, 'PUT', data);
    const updated = normalizeFacilities([result.data])[0];
    const index = facilitiesCache.findIndex((item) => String(item.id) === String(id));
    if (index >= 0) facilitiesCache[index] = updated;
    await loadPics();
    renderFacilityManagement(facilitiesCache);
    renderPicManagement(adminPicsCache);
    closeModal('bookingModal');
    showToast('Fasiliti berjaya dikemas kini.', 'success');
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Fasiliti gagal dikemas kini.', 'error');
  } finally {
    if (button) setButtonLoading(button, false);
  }
}

async function toggleFacility(fid) {
  const facility = facilitiesCache.find((f) => f.id === fid);
  if (!facility) return;
  const nextAvailability = !facility.is_available;
  try {
    const result = await tryApi(`facilities.php?id=${encodeURIComponent(fid)}`, 'PUT', { is_available: nextAvailability });
    const updated = normalizeFacilities([result.data])[0];
    Object.assign(facility, updated);
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Sambungan internet diperlukan untuk mengubah ketersediaan fasiliti.', 'error');
    return;
  }
  renderFacilityManagement(facilitiesCache);
  renderPicManagement(adminPicsCache);
  showToast(`${facility.name} dikemas kini.`, 'success');
}

function picFacilityChecklistHtml(selectedIds = []) {
  const selected = new Set(selectedIds.map(String));
  if (!facilitiesCache.length) return '<div class="admin-note-help">Tiada fasiliti tersedia.</div>';
  return facilitiesCache.map((facility) => `
      <label class="pic-facility-option">
        <input type="checkbox" name="pic_facility" value="${escapeAttr(facility.id)}" ${selected.has(String(facility.id)) ? 'checked' : ''}>
        <span>${escapeHtml(facility.name)}</span>
      </label>`).join('');
}

function openPicFormModal(pic = null) {
  const isEdit = Boolean(pic);
  setText('modalTitle', isEdit ? `Edit PIC - ${pic.full_name}` : 'Tambah PIC');
  document.getElementById('modalBody').innerHTML = `
    <div class="edit-facility-section-grid">
      <div class="form-group">
        <label for="editPicFullName">Nama Penuh PIC *</label>
        <input type="text" id="editPicFullName" maxlength="100" value="${escapeAttr(pic?.full_name || '')}" placeholder="cth: Ahmad Bin Ali">
      </div>
      <div class="form-group">
        <label for="editPicPhone">No. Telefon PIC *</label>
        <input type="tel" id="editPicPhone" maxlength="20" value="${escapeAttr(pic?.phone || '')}" placeholder="0123456789">
      </div>
      <div class="form-group span-2">
        <label for="editPicEmail">Alamat E-mel PIC</label>
        <input type="email" id="editPicEmail" maxlength="100" value="${escapeAttr(pic?.email || '')}" placeholder="ahmad@example.com">
        <div class="admin-note-help">Notifikasi automatik hanya dihantar apabila alamat e-mel yang sah tersedia.</div>
      </div>
      <div class="form-group span-2">
        <label>Fasiliti yang ditugaskan</label>
        <div class="pic-facility-checklist">${picFacilityChecklistHtml(pic?.facility_ids || [])}</div>
      </div>
    </div>`;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" type="button" onclick="closeModal('bookingModal')">Kembali</button>
    <button class="btn btn-primary" id="savePicButton" type="button" onclick="savePic('${escapeAttr(pic?.id || '')}')"><i class="bi bi-check-lg"></i> ${isEdit ? 'Simpan Perubahan' : 'Tambah PIC'}</button>`;
  document.getElementById('bookingModal')?.classList.add('active');
  document.getElementById('editPicFullName')?.focus();
}

function openPicAddModal() {
  openPicFormModal();
}

function openPicEditModal(id) {
  const pic = adminPicsCache.find((item) => item.id === String(id));
  if (pic) openPicFormModal(pic);
}

async function refreshPicAndFacilityManagement() {
  await loadFacilities();
  await loadPics();
  renderFacilityManagement(facilitiesCache);
  renderPicManagement(adminPicsCache);
}

async function savePic(id = '') {
  const button = document.getElementById('savePicButton');
  const email = document.getElementById('editPicEmail')?.value.trim() || '';
  const data = {
    full_name: document.getElementById('editPicFullName')?.value.trim() || '',
    phone: document.getElementById('editPicPhone')?.value.trim() || '',
    email,
    facility_ids: [...document.querySelectorAll('input[name="pic_facility"]:checked')].map((input) => input.value),
  };
  if (!data.full_name || !/^[0-9+()\-\s]{7,20}$/.test(data.phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    showToast('Sila lengkapkan maklumat PIC dengan betul.', 'error');
    return;
  }

  if (button) setButtonLoading(button, true, 'Menyimpan maklumat PIC...');
  try {
    await tryApi(id ? `pics.php?id=${encodeURIComponent(id)}` : 'pics.php', id ? 'PUT' : 'POST', data);
    await refreshPicAndFacilityManagement();
    closeModal('bookingModal');
    showToast(id ? 'Maklumat PIC berjaya dikemas kini.' : 'PIC berjaya ditambah.', 'success');
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Maklumat PIC gagal disimpan.', 'error');
  } finally {
    if (button) setButtonLoading(button, false);
  }
}

async function deletePic(id) {
  const pic = adminPicsCache.find((item) => item.id === String(id));
  if (!pic) return;
  const assignmentText = pic.facility_names.length
    ? ` Tugasan PIC akan dikosongkan untuk fasiliti berikut: ${pic.facility_names.join(', ')}.`
    : '';
  if (!window.confirm(`Padam rekod PIC ${pic.full_name}?${assignmentText} Rekod fasiliti tidak akan dipadam.`)) return;

  try {
    await tryApi(`pics.php?id=${encodeURIComponent(id)}`, 'DELETE');
    await refreshPicAndFacilityManagement();
    showToast('Rekod PIC berjaya dipadam.', 'success');
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'PIC gagal dipadam.', 'error');
  }
}

async function sendPicTestEmailRequest(id) {
  try {
    const result = await tryApi(`pics.php?action=test-email&id=${encodeURIComponent(id)}`, 'POST', {});
    showToast(result.message || 'E-mel telah dihantar.', 'success');
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'E-mel gagal dihantar.', 'error');
  }
}

async function loadClients() {
  const tbody = document.getElementById('clientsTbody');
  if (!tbody) return;

  if (!adminClientsLoaded) showAdminTableLoading(tbody, 6);
  else tbody.setAttribute('aria-busy', 'true');
  try {
    const result = await tryApi('users.php');
    adminClientsCache = result.data || [];
    adminClientsLoaded = true;
    tbody.removeAttribute('aria-busy');
    renderAdminClients();
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    tbody.removeAttribute('aria-busy');
    if (adminClientsLoaded) showToast(error.message || 'Senarai pelanggan tidak dapat dikemas kini. Data sebelumnya masih dipaparkan.', 'error');
    else showAdminTableError(tbody, 6, error.message || 'Tidak dapat menghubungi pelayan. Sila cuba lagi.', () => loadClients());
  }
}

function renderClientsTable(clients) {
  const tbody = document.getElementById('clientsTbody');
  if (!tbody) return;

  if (!clients.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-person-x"></i></div><div class="empty-state-title">Tiada Pelanggan</div></div></td></tr>`;
    return;
  }

  const sortedClients = sortAdminRecords(
    clients,
    'clientsSortSelect',
    (client) => client.created_at || '',
    (client) => client.created_at || ''
  );
  tbody.innerHTML = sortedClients.map((client) => {
    const clientId = Number(client.id);
    const isStaff = client.account_type === 'staff';
    const isBlocked = client.is_blocked === true || Number(client.is_blocked) === 1;
    const verificationStatus = client.staff_verification_status || 'pending';
    const verificationLabel = verificationStatus === 'verified'
      ? 'Disahkan'
      : verificationStatus === 'rejected' ? 'Belum Disahkan' : 'Menunggu Pengesahan';
    const verificationClass = verificationStatus === 'verified'
      ? 'status-approved'
      : verificationStatus === 'rejected' ? 'status-rejected' : 'status-pending';
    return `
      <tr>
        <td><span class="tenant-name">${escapeHtml(client.full_name || client.name || '')}</span><span class="table-email" title="${escapeAttr(client.email)}">${escapeHtml(client.email)}</span></td>
        <td><div class="admin-client-status-stack">
          <span class="status-badge">${escapeHtml(adminAccountTypeLabel(client.account_type))}</span>
          ${isStaff ? `<span class="status-badge ${verificationClass}">${verificationLabel}</span>` : ''}
          <span class="status-badge ${isBlocked ? 'status-rejected' : 'status-available'}">${isBlocked ? 'Disekat' : 'Aktif'}</span>
        </div></td>
        <td class="table-phone">${escapeHtml(client.phone || '-')}</td>
        <td class="table-date">${formatDate(String(client.created_at || '').slice(0, 10))}</td>
        <td class="table-status"><span class="status-badge status-pending">${Number(client.booking_count || 0)} tempahan</span></td>
        <td>
          <div class="table-actions admin-client-actions">
            ${isStaff && verificationStatus !== 'verified' ? `<button class="btn btn-primary btn-sm" type="button" onclick="verifyAdminStaff(${clientId})" title="Sahkan akaun kakitangan" aria-label="Sahkan akaun kakitangan ${escapeAttr(client.email)}"><i class="bi bi-person-check"></i><span>Sahkan</span></button>` : ''}
            <button class="btn ${isBlocked ? 'btn-secondary' : 'btn-danger'} btn-sm" type="button" onclick="setAdminClientBlocked(${clientId}, ${isBlocked ? 'false' : 'true'})" title="${isBlocked ? 'Buka sekatan akaun' : 'Sekat akaun'}" aria-label="${isBlocked ? 'Buka sekatan' : 'Sekat'} akaun ${escapeAttr(client.email)}"><i class="bi ${isBlocked ? 'bi-unlock' : 'bi-person-lock'}"></i><span>${isBlocked ? 'Buka Sekatan' : 'Sekat'}</span></button>
            <button class="btn btn-secondary btn-sm table-icon-btn" type="button" onclick="viewClientDetail(${clientId})" title="Lihat pelanggan" aria-label="Lihat pelanggan ${escapeAttr(client.email)}"><i class="bi bi-eye"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function setAdminClientBlocked(id, blocked) {
  const client = adminClientsCache.find((item) => Number(item.id) === Number(id));
  if (!client) return;

  const name = client.full_name || client.name || client.email || 'akaun ini';
  const actionLabel = blocked ? 'Sekat' : 'Buka sekatan';
  const impact = blocked
    ? ' Pengguna akan dilog keluar pada permintaan seterusnya dan tidak dapat log masuk sehingga sekatan dibuka. Tempahan sedia ada tidak akan dibatalkan.'
    : ' Pengguna boleh log masuk dan menggunakan akaunnya semula.';
  if (!window.confirm(`${actionLabel} akaun ${name}?${impact}`)) return;

  try {
    const result = await tryApi(`users.php?action=block&id=${encodeURIComponent(id)}`, 'PUT', { blocked });
    client.is_blocked = blocked;
    renderAdminClients();
    showToast(result.message || (blocked ? 'Akaun pengguna telah disekat.' : 'Sekatan akaun pengguna telah dibuka.'), 'success');
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Status akaun pelanggan tidak dapat dikemas kini.', 'error');
  }
}

async function verifyAdminStaff(id) {
  const client = adminClientsCache.find((item) => Number(item.id) === Number(id));
  if (!client || client.account_type !== 'staff' || client.staff_verification_status === 'verified') return;

  const name = client.full_name || client.name || client.email || 'akaun kakitangan ini';
  if (!window.confirm(`Sahkan akaun kakitangan ${name}?`)) return;

  try {
    const result = await tryApi(`users.php?action=staff-verification&id=${encodeURIComponent(id)}`, 'PUT', { status: 'verified' });
    client.staff_verification_status = 'verified';
    renderAdminClients();
    showToast(result.message || 'Akaun kakitangan berjaya disahkan.', 'success');
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Akaun kakitangan tidak dapat disahkan.', 'error');
  }
}

async function viewClientDetail(id) {
  try {
    const result = await tryApi(`users.php?action=detail&id=${encodeURIComponent(id)}`);
    const user = result.data.user;
    const bookings = result.data.bookings || [];
    adminClientDetailBookings = bookings;
    setText('modalTitle', `Butiran Pelanggan - ${user.full_name || user.email}`);
    document.getElementById('modalBody').innerHTML = `
      <div class="detail-row"><span class="detail-label">Nama</span><span class="detail-value">${escapeHtml(user.full_name || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Alamat E-mel</span><span class="detail-value">${escapeHtml(user.email)}</span></div>
      <div class="detail-row"><span class="detail-label">No. Telefon</span><span class="detail-value">${escapeHtml(user.phone || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Jenis Akaun</span><span class="detail-value">${escapeHtml(adminAccountTypeLabel(user.account_type))}</span></div>
      <div class="detail-row"><span class="detail-label">Status Akaun</span><span class="detail-value">${user.is_blocked ? 'Disekat' : 'Aktif'}</span></div>
      ${user.account_type === 'staff' ? `<div class="detail-row"><span class="detail-label">No. Kakitangan</span><span class="detail-value">${escapeHtml(user.staff_number || '-')}</span></div>` : ''}
      ${user.account_type === 'staff' ? `<div class="detail-row"><span class="detail-label">Pengesahan Kakitangan</span><span class="detail-value">${user.staff_verification_status === 'verified' ? 'Disahkan' : user.staff_verification_status === 'rejected' ? 'Belum Disahkan' : 'Menunggu Pengesahan'}</span></div>` : ''}
      <div class="detail-row"><span class="detail-label">Akaun</span><span class="detail-value">${user.has_password ? 'Sudah daftar' : 'Belum daftar'}</span></div>
      <div class="detail-row"><span class="detail-label">Tarikh Daftar</span><span class="detail-value">${escapeHtml(user.created_at || '-')}</span></div>
      <div class="admin-password-reset">
        <label for="clientPasswordReset">Tetapkan Kata Laluan Baharu</label>
        <div class="admin-password-reset-row">
          <input type="password" id="clientPasswordReset" minlength="6" autocomplete="new-password" placeholder="Minimum 6 aksara">
          <button class="btn btn-primary btn-sm" id="clientPasswordResetButton" type="button" onclick="updateClientPassword(${Number(user.id)})"><i class="bi bi-key"></i> Simpan</button>
        </div>
      </div>
      <div style="margin-top:24px">
        <div class="admin-client-bookings-header">
          <div class="admin-card-title">Tempahan Pelanggan</div>
          ${bookings.length ? `<div class="table-sort"><i class="bi bi-sort-down"></i><select id="clientBookingsSortSelect" aria-label="Susun tempahan pelanggan" onchange="renderClientBookingsTable()"><option value="recent">Terkini</option><option value="date-asc">Tarikh: Awal ke Akhir</option><option value="date-desc">Tarikh: Akhir ke Awal</option></select></div>` : ''}
        </div>
        ${bookings.length ? `
          <div style="overflow-x:auto">
            <table class="data-table admin-client-bookings-table">
              <thead><tr><th>Rujukan</th><th>Fasiliti</th><th>Tarikh</th><th>Masa</th><th>Status</th></tr></thead>
              <tbody id="clientBookingsTbody"></tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><div class="empty-state-title">Tiada Tempahan</div></div>'}
      </div>
    `;
    renderClientBookingsTable();
    document.getElementById('modalFooter').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('bookingModal')">Tutup</button>`;
    document.getElementById('bookingModal')?.classList.add('active');
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Butiran pelanggan gagal dimuatkan.', 'error');
  }
}

function renderClientBookingsTable() {
  const tbody = document.getElementById('clientBookingsTbody');
  if (!tbody) return;
  const bookings = sortedAdminBookings(adminClientDetailBookings, 'clientBookingsSortSelect');
  tbody.innerHTML = bookings.map((booking) => `
    <tr>
      <td><div class="booking-id">${escapeHtml(booking.booking_ref)}</div></td>
      <td>${escapeHtml(booking.facility_name || '-')}</td>
      <td>${formatDate(booking.booking_date)}</td>
      <td>${escapeHtml(String(booking.start_time || '').slice(0, 5))} - ${escapeHtml(String(booking.end_time || '').slice(0, 5) || '-')}</td>
      <td class="table-status">${bookingStatusBadgeHtml(booking)}</td>
    </tr>
  `).join('');
}

async function updateClientPassword(id) {
  const input = document.getElementById('clientPasswordReset');
  const button = document.getElementById('clientPasswordResetButton');
  const password = input?.value || '';
  if (password.length < 6) {
    showToast('Kata laluan mesti mengandungi sekurang-kurangnya 6 aksara.', 'error');
    input?.focus();
    return;
  }

  if (button) setButtonLoading(button, true, 'Mengemas kini kata laluan...');
  try {
    await tryApi(`users.php?id=${encodeURIComponent(id)}`, 'PUT', { password });
    if (input) input.value = '';
    showToast('Kata laluan pelanggan berjaya dikemas kini.', 'success');
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Kata laluan pelanggan gagal dikemas kini.', 'error');
  } finally {
    if (button) setButtonLoading(button, false);
  }
}

async function loadMessages() {
  const tbody = document.getElementById('messagesTbody');
  if (!tbody) return;

  if (!adminMessagesLoaded) showAdminTableLoading(tbody, 5);
  else tbody.setAttribute('aria-busy', 'true');
  try {
    const result = await tryApi('messages.php');
    adminMessagesCache = result.data || [];
    adminMessagesLoaded = true;
    tbody.removeAttribute('aria-busy');
    renderMessagesTable(adminMessagesCache);
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    tbody.removeAttribute('aria-busy');
    if (adminMessagesLoaded) showToast(error.message || 'Mesej tidak dapat dikemas kini. Data sebelumnya masih dipaparkan.', 'error');
    else showAdminTableError(tbody, 5, error.message || 'Tidak dapat menghubungi pelayan. Sila cuba lagi.', () => loadMessages());
  }
}

function renderMessagesTable(messages) {
  const tbody = document.getElementById('messagesTbody');
  if (!tbody) return;
  if (!messages.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-chat-dots"></i></div><div class="empty-state-title">Tiada Mesej</div></div></td></tr>';
    return;
  }

  const sortedMessages = sortAdminRecords(
    messages,
    'messagesSortSelect',
    (message) => message.created_at || '',
    (message) => message.created_at || ''
  );
  tbody.innerHTML = sortedMessages.map((message) => {
    const hasReply = Boolean(message.admin_reply);
    const replyStatus = hasReply
      ? `<div class="admin-message-reply"><span class="admin-message-reply-label">Dibalas</span>${escapeHtml(message.admin_reply)}</div>`
      : '<div class="admin-message-pending">Belum dibalas</div>';
    return `
      <tr>
        <td><span class="table-email" title="${escapeAttr(message.email)}">${escapeHtml(message.email)}</span></td>
        <td>${escapeHtml(message.subject || '-')}</td>
        <td class="admin-message-content"><div>${escapeHtml(message.message || '-')}</div>${replyStatus}</td>
        <td class="table-date">${escapeHtml(formatDateTime(message.created_at))}</td>
        <td><div class="table-actions"><button class="btn btn-secondary btn-sm table-icon-btn" type="button" onclick="openMessageReplyModal('${escapeAttr(message.id)}')" title="Balas mesej" aria-label="Balas mesej ${escapeAttr(message.email)}"><i class="bi bi-reply"></i></button></div></td>
      </tr>
    `;
  }).join('');
}

function findAdminMessage(id) {
  return (adminMessagesCache || []).find((message) => String(message.id) === String(id)) || null;
}

function openMessageReplyModal(id) {
  const message = findAdminMessage(id);
  if (!message) {
    showToast('Mesej tidak dijumpai.', 'error');
    return;
  }

  setText('modalTitle', `Balas Mesej - ${message.email}`);
  document.getElementById('modalBody').innerHTML = `
    <div class="admin-message-thread">
      <div class="admin-message-thread-item">
        <div class="admin-message-thread-meta">${escapeHtml(message.subject || '-')} &bull; ${escapeHtml(formatDateTime(message.created_at))}</div>
        <div class="admin-message-thread-text">${escapeHtml(message.message || '-')}</div>
      </div>
      <div class="form-group">
        <label for="adminReplyText">Balasan Pentadbir *</label>
        <textarea id="adminReplyText" maxlength="5000" rows="6" placeholder="Tulis balasan kepada pelanggan...">${escapeHtml(message.admin_reply || '')}</textarea>
      </div>
    </div>
  `;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" type="button" onclick="closeModal('bookingModal')">Kembali</button>
    <button class="btn btn-primary" id="adminReplyButton" type="button" onclick="sendMessageReply('${escapeAttr(message.id)}')"><i class="bi bi-send"></i> Hantar Balasan</button>
  `;
  document.getElementById('bookingModal')?.classList.add('active');
  document.getElementById('adminReplyText')?.focus();
}

async function sendMessageReply(id) {
  const replyEl = document.getElementById('adminReplyText');
  const reply = replyEl?.value.trim() || '';
  if (reply.length < 2) {
    showToast('Sila tulis balasan pentadbir.', 'error');
    replyEl?.focus();
    return;
  }

  const button = document.getElementById('adminReplyButton');
  if (button) setButtonLoading(button, true, 'Menghantar balasan...');

  try {
    await tryApi(`messages.php?action=reply&id=${encodeURIComponent(id)}`, 'PUT', { reply });
    closeModal('bookingModal');
    await loadMessages();
    showToast('Balasan telah dihantar kepada pelanggan.', 'success');
  } catch (error) {
    showToast(error.message || 'Balasan gagal dihantar.', 'error');
  } finally {
    if (button) setButtonLoading(button, false);
  }
}

function renderCalendar(bookings = [], viewDate = bookingCalendarDate) {
  const calendar = document.getElementById('calendarView');
  if (!calendar) return;
  const scheduleBookings = bookings.filter((booking) => ['pending', 'approved'].includes(booking.status));
  const now = new Date();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthNames = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  const currentMonthIndex = (now.getFullYear() * 12) + now.getMonth();
  const viewMonthIndex = (year * 12) + month;
  const relativeMonthLabel = viewMonthIndex === currentMonthIndex
    ? 'Bulan Ini'
    : viewMonthIndex === currentMonthIndex - 1
      ? 'Bulan Lepas'
      : viewMonthIndex === currentMonthIndex + 1
        ? 'Bulan Depan'
        : monthNames[month];
  const bookedDates = {};
  scheduleBookings.forEach((b) => {
    if (!bookedDates[b.date]) bookedDates[b.date] = [];
    bookedDates[b.date].push(b);
  });

  let html = `
    <div class="booking-calendar-header">
      <h3>${monthNames[month]} ${year}</h3>
      <div class="booking-calendar-actions">
        <button type="button" class="calendar-nav-btn" onclick="changeBookingCalendarMonth(-1)" aria-label="Bulan sebelum"><i class="bi bi-chevron-left"></i></button>
        <button type="button" class="calendar-today-btn" onclick="resetBookingCalendarMonth()">${relativeMonthLabel}</button>
        <button type="button" class="calendar-nav-btn" onclick="changeBookingCalendarMonth(1)" aria-label="Bulan seterusnya"><i class="bi bi-chevron-right"></i></button>
      </div>
    </div>
    <div class="booking-calendar-weekdays">
  `;
  ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'].forEach((day) => { html += `<div>${day}</div>`; });
  html += '</div><div class="booking-calendar-grid">';
  for (let i = 0; i < firstDay; i++) html += '<div></div>';
  for (let day = 1; day <= days; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayBookings = bookedDates[dateStr] || [];
    const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
    html += `<div class="booking-calendar-day ${isToday ? 'today' : ''}"><div class="booking-calendar-date">${day}</div>${calendarStatusLabels(dayBookings)}</div>`;
  }
  calendar.innerHTML = html + '</div>';
}

function calendarStatusLabels(bookings = []) {
  if (!bookings.length) return '';

  const statusConfig = {
    pending: { color: 'var(--amber)', bg: '#FDF3E3' },
    approved: { color: 'var(--green)', bg: '#EAF5EE' },
  };
  const labels = bookings
    .filter((booking) => statusConfig[booking.status])
    .slice(0, 4)
    .map((booking) => {
      const config = statusConfig[booking.status];
      const facilityName = booking.facilityName || 'Fasiliti';
      return `<span title="${escapeAttr(facilityName)}" style="display:inline-flex;align-items:center;max-width:100%;padding:2px 6px;border-radius:999px;background:${config.bg};color:${config.color};font-size:9px;font-weight:800;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(facilityName)}</span>`;
    })
    .join('');

  const hiddenCount = bookings.filter((booking) => statusConfig[booking.status]).length - 4;
  const moreLabel = hiddenCount > 0
    ? `<span style="display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;background:var(--surface-3);color:var(--grey-4);font-size:9px;font-weight:800;line-height:1.2;white-space:nowrap;">+${hiddenCount}</span>`
    : '';

  return `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:6px;overflow:hidden;">${labels}${moreLabel}</div>`;
}

function showAdminPanel(name, btn) {
  const target = document.getElementById(`panel-${name}`);
  if (!target) return;
  if (target.classList.contains('active')) {
    closeAdminNavigation(false);
    document.getElementById('adminWorkspace')?.focus({ preventScroll: true });
    return;
  }
  document.querySelectorAll('.admin-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.admin-menu-item').forEach((b) => b.classList.remove('active'));
  document.getElementById(`panel-${name}`)?.classList.add('active');
  btn?.classList.add('active');
  document.querySelectorAll('.admin-menu-item').forEach((item) => {
    if (item === btn) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  const panel = document.getElementById(`panel-${name}`);
  setText('adminCurrentPage', panel?.querySelector('h1, h2')?.textContent || 'Ringkasan');
  closeAdminNavigation(false);
  document.getElementById('adminWorkspace')?.focus({ preventScroll: true });
  if (name === 'bookings') filterBookings('all', document.querySelector('#bookingFilterTabs .filter-tab'));
  if (name === 'messages') loadMessages();
  if (name === 'clients') loadClients();
  if (name === 'pic') refreshPicAndFacilityManagement();
  if (name === 'calendar') renderAdminDashboard();
  if (name === 'reports') loadAdminReports();
}

async function viewBookingDetail(id) {
  let booking;
  try {
    const result = await apiRequest(`bookings.php?action=ref&ref=${encodeURIComponent(id)}`);
    booking = result.data;
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Butiran tempahan gagal dimuatkan.', 'error');
    return;
  }

  setText('modalTitle', `Butiran Tempahan - ${booking.id}`);
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;padding:16px;background:var(--surface-3);border-radius:8px">
      <div style="font-size:32px;color:var(--gold)">${booking.facilityIcon || ''}</div>
      <div><div style="font-family:var(--display-font);font-size:16px;font-weight:900">${escapeHtml(booking.facilityName)}</div><div style="font-size:12px;color:var(--grey-4);margin-top:2px">${formatDate(booking.date)}</div></div>
      <div style="margin-left:auto">${bookingStatusBadgeHtml(booking)}</div>
    </div>
    <div class="admin-detail-section">
      <div class="admin-facility-section-title">Maklumat Tempahan</div>
      <div class="detail-row"><span class="detail-label">Nama Pelanggan</span><span class="detail-value">${escapeHtml(booking.name)}</span></div>
      <div class="detail-row"><span class="detail-label">Jenis Pemohon</span><span class="detail-value">${escapeHtml(booking.accountTypeLabel || adminAccountTypeLabel(booking.accountType))}</span></div>
      <div class="detail-row"><span class="detail-label">Alamat E-mel</span><span class="detail-value">${escapeHtml(booking.email || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">No. Telefon</span><span class="detail-value">${escapeHtml(booking.phone)}</span></div>
      <div class="detail-row"><span class="detail-label">Tarikh & Masa</span><span class="detail-value">${formatDate(booking.date)}, ${escapeHtml(adminBookingTimeLabel(booking))}</span></div>
      <div class="detail-row"><span class="detail-label">Tempoh</span><span class="detail-value">${escapeHtml(String(booking.duration || 1))} ${booking.durationUnit === 'day' || booking.duration_unit === 'day' ? 'hari' : 'jam'}</span></div>
      <div class="detail-row"><span class="detail-label">Jumlah Pengguna</span><span class="detail-value">${escapeHtml(String(booking.pax || '-'))}</span></div>
      ${booking.asrama_type ? `<div class="detail-row"><span class="detail-label">Asrama</span><span class="detail-value">${escapeHtml(asramaTypeLabel(booking.asrama_type))} - ${escapeHtml(String(booking.room_count || 1))} bilik</span></div>` : ''}
      <div class="detail-row"><span class="detail-label">Peralatan</span><span class="detail-value">${escapeHtml(booking.equipment || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Tujuan</span><span class="detail-value">${escapeHtml(booking.purpose || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Bayaran</span><span class="detail-value">${booking.paymentRequired === false ? 'Tidak diperlukan' : `Diperlukan (RM${Number(booking.estimatedCost || 0).toFixed(2)})`}</span></div>
      ${booking.paymentRequired === false ? '' : `<div class="detail-row"><span class="detail-label">Bukti Bayaran</span><span class="detail-value">${receiptLinkHtml(booking.paymentFile)}</span></div>`}
      ${booking.adminNote ? `<div class="detail-row"><span class="detail-label">Nota Pentadbir</span><span class="detail-value">${escapeHtml(booking.adminNote)}</span></div>` : ''}
      ${booking.cancellationReason ? `<div class="detail-row"><span class="detail-label">Sebab Pembatalan</span><span class="detail-value">${escapeHtml(booking.cancellationReason)}</span></div>` : ''}
    </div>
    <div class="admin-detail-section">
      <div class="admin-facility-section-title">Maklumat PIC</div>
      <div class="detail-row"><span class="detail-label">Nama Penuh PIC</span><span class="detail-value">${escapeHtml(booking.picFullName || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">No. Telefon PIC</span><span class="detail-value">${escapeHtml(booking.picPhone || '-')}</span></div>
    </div>
    ${booking.status === 'pending' ? rejectNoteHtml(booking.status, booking.adminNote) : ''}
    ${booking.status === 'approved' ? cancellationNoteHtml() : ''}
  `;
  document.getElementById('modalFooter').innerHTML = booking.status === 'pending'
    ? `<button class="btn btn-secondary" onclick="closeModal('bookingModal')">Kembali</button><button class="btn btn-danger" onclick="rejectBookingFromModal('${escapeAttr(booking.id)}')"><i class="bi bi-x-lg"></i> Tolak</button><button class="btn btn-success" onclick="approveBookingFromModal('${escapeAttr(booking.id)}')"><i class="bi bi-check-lg"></i> Sahkan</button>`
    : booking.status === 'approved'
      ? `<button class="btn btn-secondary" onclick="closeModal('bookingModal')">Tutup</button><button class="btn btn-danger" onclick="cancelApprovedBookingFromModal('${escapeAttr(booking.id)}')"><i class="bi bi-x-circle"></i> Batalkan Tempahan</button>`
      : `<button class="btn btn-secondary" onclick="closeModal('bookingModal')">Tutup</button>`;
  document.getElementById('bookingModal')?.classList.add('active');
}

function rejectNoteHtml(status, currentNote = '') {
  const helper = status === 'approved'
    ? 'Tempahan ini telah diluluskan. Nyatakan sebab tempahan tidak dapat diteruskan.'
    : 'Nyatakan sebab permohonan ini ditolak.';
  return `
    <div class="admin-reject-note">
      <label>Sebab Penolakan *</label>
      <textarea id="modalNote" style="min-height:96px" placeholder="cth: Fasiliti perlu digunakan untuk program rasmi pada tarikh tersebut.">${escapeHtml(currentNote || '')}</textarea>
      <div class="admin-note-help">${helper}</div>
    </div>
  `;
}

function cancellationNoteHtml() {
  return `
    <div class="admin-reject-note admin-cancellation-note">
      <label for="modalCancellationReason">Sebab Pembatalan *</label>
      <textarea id="modalCancellationReason" style="min-height:96px" placeholder="cth: Fasiliti ditutup untuk penyelenggaraan kecemasan."></textarea>
      <div class="admin-note-help"><strong>Perhatian:</strong> Tempahan ini telah diluluskan. Jika diteruskan, tempahan akan dibatalkan dan slot fasiliti akan dibuka semula. Sistem akan cuba menghantar e-mel kepada PIC.</div>
    </div>`;
}

async function updateStatus(id, status, note = '', cancellationReason = '') {
  try {
    const result = await tryApi(`bookings.php?action=status&id=${encodeURIComponent(id)}`, 'PUT', {
      status,
      admin_note: note,
      cancellation_reason: cancellationReason,
    });
    await renderAdminDashboard();
    return result;
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return false;
    showToast(error.message || 'Status tempahan gagal dikemas kini.', 'error');
    return false;
  }
}

async function approveBooking(id) {
  const result = await updateStatus(id, 'approved');
  if (!result) return;
  showToast('Tempahan berjaya disahkan.', 'success');
  if (result.warning) showToast(result.warning, 'error');
}

async function approveBookingFromModal(id) {
  const result = await updateStatus(id, 'approved', document.getElementById('modalNote')?.value || '');
  if (result) {
    closeModal('bookingModal');
    showToast('Tempahan berjaya disahkan.', 'success');
    if (result.warning) showToast(result.warning, 'error');
  }
}

function rejectBookingPrompt(id) {
  viewBookingDetail(id);
}

async function rejectBookingFromModal(id) {
  const note = document.getElementById('modalNote')?.value.trim() || '';
  if (!note) {
    showToast('Sila masukkan sebab penolakan.', 'error');
    document.getElementById('modalNote')?.focus();
    return;
  }
  if (await updateStatus(id, 'rejected', note)) {
    closeModal('bookingModal');
    showToast('Permohonan ditolak.', 'error');
  }
}

function cancelApprovedBookingPrompt(id) {
  viewBookingDetail(id);
}

async function cancelApprovedBookingFromModal(id) {
  const reasonInput = document.getElementById('modalCancellationReason');
  const reason = reasonInput?.value.trim() || '';
  if (!reason) {
    showToast('Sila masukkan sebab pembatalan.', 'error');
    reasonInput?.focus();
    return;
  }
  if (!window.confirm('Batalkan tempahan yang telah diluluskan? Slot fasiliti akan dibuka semula selepas pembatalan.')) return;

  const result = await updateStatus(id, 'cancelled', '', reason);
  if (!result) return;
  closeModal('bookingModal');
  showToast('Tempahan yang diluluskan berjaya dibatalkan.', 'success');
  if (result.warning) showToast(result.warning, 'error');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

document.addEventListener('click', (event) => {
  if (event.target.classList.contains('modal-overlay')) event.target.classList.remove('active');
});

function receiptLinkHtml(paymentFile) {
  if (!paymentFile) return '-';
  const filename = String(paymentFile);
  return `<a href="${receiptFileUrl(filename)}" target="_blank" rel="noopener">${escapeHtml(filename)}</a>`;
}

function receiptFileUrl(filename) {
  return `${API_BASE}/receipts.php?file=${encodeURIComponent(String(filename || ''))}`;
}


