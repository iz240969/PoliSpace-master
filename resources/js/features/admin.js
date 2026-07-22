// ==================== ADMIN ====================
async function renderAdminDashboard() {
  const dashDate = document.getElementById('dashDate');
  if (!dashDate) return;

  let bookings = [];
  let stats = null;
  const facilities = await loadFacilities();

  try {
    const statsResult = await tryApi('bookings.php?action=stats');
    const bookingsResult = await tryApi('bookings.php');
    stats = statsResult.data;
    bookings = bookingsResult.data || [];
  } catch (error) {
    bookings = getBookings();
    const today = new Date().toISOString().split('T')[0];
    stats = {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === 'pending').length,
      approved: bookings.filter((b) => b.status === 'approved').length,
      today: bookings.filter((b) => b.date === today).length,
    };
  }

  setText('pendingBadge', stats.pending);
  dashDate.textContent = new Date().toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('adminStats').innerHTML = buildStatsHTML(stats);
  renderBookingsTable('recentBookingsTbody', bookings.slice(0, 5), true);
  renderBookingsTable('allBookingsTbody', bookings, false);
  renderFacilityManagement(facilities);
  renderCalendar(bookings, bookingCalendarDate);
  loadClients();
}

function buildStatsHTML(stats) {
  return `
    <div class="stat-card"><div class="stat-card-label">Jumlah Tempahan</div><div class="stat-card-value">${stats.total}</div></div>
    <div class="stat-card"><div class="stat-card-label">Menunggu Semakan</div><div class="stat-card-value" style="color:var(--amber)">${stats.pending}</div></div>
    <div class="stat-card"><div class="stat-card-label">Diluluskan</div><div class="stat-card-value" style="color:var(--green)">${stats.approved}</div></div>
    <div class="stat-card"><div class="stat-card-label">Hari Ini</div><div class="stat-card-value">${stats.today}</div></div>
  `;
}

function renderBookingsTable(tbodyId, bookings, isRecent = false) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (!bookings.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-inbox"></i></div><div class="empty-state-title">Tiada Tempahan</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = bookings.map((b) => `
    <tr>
      <td><div class="booking-id">${escapeHtml(b.id)}</div></td>
      <td><div class="tenant-name">${escapeHtml(b.name)}</div><div class="tenant-org">${escapeHtml(b.org || '')}</div></td>
      <td><span style="display:flex;align-items:center;gap:6px">${b.facilityIcon || ''} ${escapeHtml(b.facilityName)}</span></td>
      <td>${formatDate(b.date)}</td>
      ${!isRecent ? `<td>${escapeHtml(b.start)} - ${escapeHtml(b.end || '?')}</td>` : ''}
      <td>${statusBadgeHtml(b.status)}</td>
      <td><div class="table-actions"><button class="btn btn-secondary btn-sm" onclick="viewBookingDetail('${escapeAttr(b.id)}')">Lihat</button>${b.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="approveBooking('${escapeAttr(b.id)}')"><i class="bi bi-check-lg"></i></button><button class="btn btn-danger btn-sm" onclick="rejectBookingPrompt('${escapeAttr(b.id)}')"><i class="bi bi-x-lg"></i></button>` : ''}</div></td>
    </tr>
  `).join('');
}

async function filterBookings(filter, btn) {
  document.querySelectorAll('#bookingFilterTabs .filter-tab').forEach((b) => b.classList.remove('active'));
  btn?.classList.add('active');
  let bookings = [];
  try {
    const suffix = filter === 'all' ? '' : `?status=${encodeURIComponent(filter)}`;
    const result = await tryApi(`bookings.php${suffix}`);
    bookings = result.data || [];
  } catch (error) {
    bookings = getBookings();
    if (filter !== 'all') bookings = bookings.filter((b) => b.status === filter);
  }
  renderBookingsTable('allBookingsTbody', bookings, false);
}

function renderFacilityManagement(facilities) {
  const grid = document.getElementById('facilityManageGrid');
  if (!grid) return;
  grid.innerHTML = facilities.map((f) => `
    <div class="facility-manage-card">
      <div class="fmc-header"><div class="fmc-icon">${facilityIconHtml(f)}</div>${statusBadgeHtml(f.is_available ? 'available' : 'booked')}</div>
      <div class="fmc-name">${escapeHtml(f.name)}</div>
      <div class="fmc-cap">Kapasiti: ${f.capacity} orang - RM${f.price_per_hour}</div>
      <div class="fmc-footer"><span style="font-size:12px;color:var(--grey-4)">${f.is_available ? 'Aktif' : 'Tidak Tersedia'}</span><div class="toggle-switch ${f.is_available ? 'on' : ''}" onclick="toggleFacility('${escapeAttr(f.id)}')"></div></div>
    </div>
  `).join('');
}

async function toggleFacility(fid) {
  const facility = facilitiesCache.find((f) => f.id === fid);
  if (!facility) return;
  facility.is_available = !facility.is_available;
  try {
    await tryApi(`facilities.php?id=${encodeURIComponent(fid)}`, 'PUT', { is_available: facility.is_available });
  } catch (error) {
    apiOnline = false;
  }
  renderFacilityManagement(facilitiesCache);
  showToast(`${facility.name} dikemas kini.`, 'success');
}

async function loadClients() {
  const tbody = document.getElementById('clientsTbody');
  if (!tbody) return;

  try {
    const result = await tryApi('users.php');
    renderClientsTable(result.data || []);
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-people"></i></div><div class="empty-state-title">Senarai pelanggan tidak dapat dimuatkan</div></div></td></tr>`;
  }
}

function renderClientsTable(clients) {
  const tbody = document.getElementById('clientsTbody');
  if (!tbody) return;

  if (!clients.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-person-x"></i></div><div class="empty-state-title">Tiada Pelanggan</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = clients.map((client) => `
    <tr>
      <td><div class="tenant-name">${escapeHtml(client.full_name || '-')}</div></td>
      <td>${escapeHtml(client.email)}</td>
      <td>${escapeHtml(client.phone || '-')}</td>
      <td><span class="status-badge status-pending">${Number(client.booking_count || 0)} tempahan</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" onclick="viewClientDetail(${Number(client.id)})"><i class="bi bi-eye"></i> Lihat</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function viewClientDetail(id) {
  try {
    const result = await tryApi(`users.php?action=detail&id=${encodeURIComponent(id)}`);
    const user = result.data.user;
    const bookings = result.data.bookings || [];
    setText('modalTitle', `Butiran Pelanggan - ${user.full_name || user.email}`);
    document.getElementById('modalBody').innerHTML = `
      <div class="detail-row"><span class="detail-label">Nama</span><span class="detail-value">${escapeHtml(user.full_name || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">E-mel</span><span class="detail-value">${escapeHtml(user.email)}</span></div>
      <div class="detail-row"><span class="detail-label">No Telefon</span><span class="detail-value">${escapeHtml(user.phone || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Akaun</span><span class="detail-value">${user.has_password ? 'Sudah daftar' : 'Belum daftar'}</span></div>
      <div class="detail-row"><span class="detail-label">Tarikh Daftar</span><span class="detail-value">${escapeHtml(user.created_at || '-')}</span></div>
      <div style="margin-top:24px">
        <div class="admin-card-title" style="margin-bottom:12px">Tempahan Pelanggan</div>
        ${bookings.length ? `
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead><tr><th>Rujukan</th><th>Fasiliti</th><th>Tarikh</th><th>Masa</th><th>Status</th></tr></thead>
              <tbody>${bookings.map((booking) => `
                <tr>
                  <td><div class="booking-id">${escapeHtml(booking.booking_ref)}</div></td>
                  <td>${escapeHtml(booking.facility_name || '-')}</td>
                  <td>${formatDate(booking.booking_date)}</td>
                  <td>${escapeHtml(String(booking.start_time || '').slice(0, 5))} - ${escapeHtml(String(booking.end_time || '').slice(0, 5) || '-')}</td>
                  <td>${statusBadgeHtml(booking.status)}</td>
                </tr>
              `).join('')}</tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><div class="empty-state-title">Tiada Tempahan</div></div>'}
      </div>
    `;
    document.getElementById('modalFooter').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('bookingModal')">Tutup</button>`;
    document.getElementById('bookingModal')?.classList.add('active');
  } catch (error) {
    showToast(error.message || 'Butiran pelanggan gagal dimuatkan.', 'error');
  }
}

function renderCalendar(bookings = [], viewDate = bookingCalendarDate) {
  const calendar = document.getElementById('calendarView');
  if (!calendar) return;
  const now = new Date();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthNames = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  const bookedDates = {};
  bookings.forEach((b) => {
    if (!bookedDates[b.date]) bookedDates[b.date] = [];
    bookedDates[b.date].push(b);
  });

  let html = `
    <div class="booking-calendar-header">
      <h3>${monthNames[month]} ${year}</h3>
      <div class="booking-calendar-actions">
        <button type="button" class="calendar-nav-btn" onclick="changeBookingCalendarMonth(-1)" aria-label="Bulan sebelum"><i class="bi bi-chevron-left"></i></button>
        <button type="button" class="calendar-today-btn" onclick="resetBookingCalendarMonth()">Bulan Ini</button>
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
    pending: { label: 'Pending', color: 'var(--amber)', bg: '#FDF3E3' },
    approved: { label: 'Booked', color: 'var(--green)', bg: '#EAF5EE' },
    rejected: { label: 'Rejected', color: 'var(--red)', bg: '#FDECEC' },
    cancelled: { label: 'Cancelled', color: 'var(--red)', bg: '#FDECEC' },
  };
  const counts = bookings.reduce((acc, booking) => {
    if (statusConfig[booking.status]) acc[booking.status] = (acc[booking.status] || 0) + 1;
    return acc;
  }, {});

  const order = ['pending', 'approved', 'rejected', 'cancelled'];
  const labels = order
    .filter((status) => counts[status])
    .map((status) => {
      const config = statusConfig[status];
      const count = counts[status] > 1 ? ` ${counts[status]}` : '';
      return `<span style="display:inline-flex;align-items:center;max-width:100%;padding:2px 6px;border-radius:999px;background:${config.bg};color:${config.color};font-size:9px;font-weight:800;line-height:1.2;white-space:nowrap;">${config.label}${count}</span>`;
    })
    .join('');

  return `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:6px;overflow:hidden;">${labels}</div>`;
}

function showAdminPanel(name, btn) {
  document.querySelectorAll('.admin-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.admin-menu-item').forEach((b) => b.classList.remove('active'));
  document.getElementById(`panel-${name}`)?.classList.add('active');
  btn?.classList.add('active');
  if (name === 'bookings') filterBookings('all', document.querySelector('#bookingFilterTabs .filter-tab'));
  if (name === 'clients') loadClients();
  if (name === 'calendar') renderAdminDashboard();
}

function findBooking(id) {
  return getBookings().find((b) => b.id === id || b.booking_ref === id);
}

async function viewBookingDetail(id) {
  let booking = findBooking(id);
  if (apiOnline) {
    try {
      const result = await tryApi(`bookings.php?action=ref&ref=${encodeURIComponent(id)}`);
      booking = result.data;
    } catch (error) {
      apiOnline = false;
    }
  }
  if (!booking) return;

  setText('modalTitle', `Butiran Tempahan - ${booking.id}`);
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;padding:16px;background:var(--surface-3);border-radius:8px">
      <div style="font-size:32px;color:var(--gold)">${booking.facilityIcon || ''}</div>
      <div><div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700">${escapeHtml(booking.facilityName)}</div><div style="font-size:12px;color:var(--grey-4);margin-top:2px">${formatDate(booking.date)}</div></div>
      <div style="margin-left:auto">${statusBadgeHtml(booking.status)}</div>
    </div>
    <div class="detail-row"><span class="detail-label">Nama Penyewa</span><span class="detail-value">${escapeHtml(booking.name)}</span></div>
    <div class="detail-row"><span class="detail-label">Telefon</span><span class="detail-value">${escapeHtml(booking.phone)}</span></div>
    <div class="detail-row"><span class="detail-label">Resit Bayaran</span><span class="detail-value">${receiptLinkHtml(booking.paymentFile)}</span></div>
    ${booking.status === 'pending' ? '<div style="margin-top:20px"><label>Nota (pilihan)</label><textarea id="modalNote" style="min-height:80px"></textarea></div>' : ''}
  `;
  document.getElementById('modalFooter').innerHTML = booking.status === 'pending'
    ? `<button class="btn btn-secondary" onclick="closeModal('bookingModal')">Batal</button><button class="btn btn-danger" onclick="rejectBookingFromModal('${escapeAttr(booking.id)}')"><i class="bi bi-x-lg"></i> Tolak</button><button class="btn btn-success" onclick="approveBookingFromModal('${escapeAttr(booking.id)}')"><i class="bi bi-check-lg"></i> Luluskan</button>`
    : `<button class="btn btn-secondary" onclick="closeModal('bookingModal')">Tutup</button>`;
  document.getElementById('bookingModal')?.classList.add('active');
}

async function updateStatus(id, status, note = '') {
  try {
    await tryApi(`bookings.php?action=status&id=${encodeURIComponent(id)}`, 'PUT', { status, admin_note: note });
  } catch (error) {
    if (!canUseLocalFallback(error)) {
      showToast(error.message || 'Status tempahan gagal dikemas kini.', 'error');
      return;
    }
    const bookings = getBookings();
    const booking = bookings.find((b) => b.id === id);
    if (booking) {
      booking.status = status;
      booking.adminNote = note;
      saveBookings(bookings);
    }
  }
  await renderAdminDashboard();
}

async function approveBooking(id) {
  await updateStatus(id, 'approved');
  showToast('Diluluskan', 'success');
}

async function approveBookingFromModal(id) {
  await updateStatus(id, 'approved', document.getElementById('modalNote')?.value || '');
  closeModal('bookingModal');
  showToast('Diluluskan', 'success');
}

function rejectBookingPrompt(id) {
  viewBookingDetail(id);
}

async function rejectBookingFromModal(id) {
  await updateStatus(id, 'rejected', document.getElementById('modalNote')?.value || 'Ditolak.');
  closeModal('bookingModal');
  showToast('Ditolak', 'error');
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
  return `<a href="/uploads/payments/${escapeAttr(filename)}" target="_blank" rel="noopener">${escapeHtml(filename)}</a>`;
}


