// ==================== ADMIN ====================
function handleAdminAuthorizationError(error) {
  if (![401, 403].includes(error?.status)) return false;
  clearStoredAuthState();
  window.location.href = ROUTES.login;
  return true;
}

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
    if (handleAdminAuthorizationError(error)) return;
    bookings = [];
    stats = {
      total: 0,
      pending: 0,
      approved: 0,
      today: 0,
    };
    showToast(error.message || 'Data dashboard tidak dapat dimuatkan.', 'error');
  }

  setText('pendingBadge', Number(stats.pending || 0));
  dashDate.textContent = new Date().toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('adminStats').innerHTML = buildStatsHTML(stats);
  renderBookingsTable('recentBookingsTbody', bookings.slice(0, 5), true);
  renderBookingsTable('allBookingsTbody', bookings, false);
  renderFacilityManagement(facilities);
  renderCalendar(bookings, bookingCalendarDate);
  loadClients();
  loadMessages();
}

function buildStatsHTML(stats) {
  return `
    <div class="stat-card"><div class="stat-card-label">Jumlah Tempahan</div><div class="stat-card-value">${stats.total}</div></div>
    <div class="stat-card"><div class="stat-card-label">Menunggu Semakan</div><div class="stat-card-value" style="color:var(--amber)">${stats.pending}</div></div>
    <div class="stat-card"><div class="stat-card-label">Diluluskan</div><div class="stat-card-value" style="color:var(--green)">${stats.approved}</div></div>
    <div class="stat-card"><div class="stat-card-label">Hari Ini</div><div class="stat-card-value">${stats.today || 0}</div></div>
  `;
}

function renderBookingsTable(tbodyId, bookings, isRecent = false) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (!bookings.length) {
    const columnCount = isRecent ? 6 : 7;
    tbody.innerHTML = `<tr><td colspan="${columnCount}"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-inbox"></i></div><div class="empty-state-title">Tiada Tempahan</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = bookings.map((b) => {
    const canApprove = b.status === 'pending';
    const canReject = ['pending', 'approved'].includes(b.status);
    return `
    <tr>
      <td><div class="booking-id" title="${escapeAttr(b.id)}">${escapeHtml(b.id)}</div></td>
      <td><div class="tenant-name">${escapeHtml(b.name)}</div>${b.org ? `<div class="tenant-org">${escapeHtml(b.org)}</div>` : ''}</td>
      <td><span class="table-facility">${b.facilityIcon || ''}<span>${escapeHtml(b.facilityName)}</span></span></td>
      <td class="table-date">${formatDate(b.date)}</td>
      ${!isRecent ? `<td class="table-time">${escapeHtml(b.start)} - ${escapeHtml(b.end || '?')}</td>` : ''}
      <td class="table-status">${statusBadgeHtml(b.status)}</td>
      <td><div class="table-actions admin-booking-actions">${canApprove ? `<button class="btn btn-success btn-sm admin-decision-btn" onclick="approveBooking('${escapeAttr(b.id)}')" title="Terima tempahan" aria-label="Terima tempahan ${escapeAttr(b.id)}"><i class="bi bi-check-lg"></i> Terima</button>` : ''}${canReject ? `<button class="btn btn-danger btn-sm admin-decision-btn" onclick="rejectBookingPrompt('${escapeAttr(b.id)}')" title="Tolak tempahan"><i class="bi bi-x-lg"></i> Tolak</button>` : ''}<button class="btn btn-secondary btn-sm table-icon-btn" onclick="viewBookingDetail('${escapeAttr(b.id)}')" title="Lihat tempahan" aria-label="Lihat tempahan ${escapeAttr(b.id)}"><i class="bi bi-eye"></i></button></div></td>
    </tr>
  `;
  }).join('');
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
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Senarai tempahan tidak dapat dimuatkan.', 'error');
    return;
  }
  renderBookingsTable('allBookingsTbody', bookings, false);
}

function renderFacilityManagement(facilities) {
  const grid = document.getElementById('facilityManageGrid');
  if (!grid) return;
  if (document.getElementById('facilityEquipment') && !document.getElementById('facilityEquipment').value) {
    setAdminEquipmentOptions('facilityEquipment', defaultAdminEquipmentOptions());
  }
  if (!facilities.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="bi bi-building-slash"></i></div><div class="empty-state-title">Tiada Fasiliti</div></div>';
    return;
  }
  grid.innerHTML = facilities.map((f) => `
    <div class="facility-manage-card">
      <div class="fmc-header"><div class="fmc-icon">${facilityIconHtml(f)}</div>${statusBadgeHtml(f.is_available ? 'available' : 'unavailable')}</div>
      <div class="fmc-name">${escapeHtml(f.name)}</div>
      <div class="fmc-cap">Kapasiti: ${escapeHtml(f.capacity)} orang${isAsramaRoomFacility(f) && f.max_rooms ? ` - Had ${escapeHtml(f.max_rooms)} bilik` : ''} - RM${escapeHtml(f.price_per_hour)}</div>
      <div class="fmc-equipment">${facilityEquipmentSummaryHtml(f)}</div>
      <div class="fmc-footer">
        <button class="btn btn-secondary btn-sm" type="button" onclick="openFacilityEditModal('${escapeAttr(f.id)}')"><i class="bi bi-pencil-square"></i> Edit</button>
        <div class="fmc-availability"><span>${f.is_available ? 'Aktif' : 'Tidak Tersedia'}</span><div class="toggle-switch ${f.is_available ? 'on' : ''}" onclick="toggleFacility('${escapeAttr(f.id)}')"></div></div>
      </div>
    </div>
  `).join('');
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
      <button type="button" onclick="removeAdminEquipmentOption('${escapeAttr(inputId)}', '${escapeAttr(name)}')" aria-label="Buang ${escapeAttr(name)}"><i class="bi bi-x-lg"></i></button>
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
    equipment_options: parseAdminEquipmentValue(formData.get('equipment_options') || ''),
    is_available: formData.has('is_available'),
  };

  if (!data.name || data.capacity < 1 || data.price_per_hour < 0 || (data.max_rooms !== null && data.max_rooms < 1)) {
    showToast('Sila lengkapkan maklumat fasiliti.', 'error');
    return;
  }

  if (button) button.disabled = true;
  try {
    const result = await tryApi('facilities.php', 'POST', data);
    const created = normalizeFacilities([result.data])[0];
    facilitiesCache.push(created);
    renderFacilityManagement(facilitiesCache);
    form.reset();
    const iconInput = document.getElementById('facilityIcon');
    if (iconInput) iconInput.value = 'bi-building';
    const availableInput = document.getElementById('facilityAvailable');
    if (availableInput) availableInput.checked = true;
    setAdminEquipmentOptions('facilityEquipment', defaultAdminEquipmentOptions());
    showToast('Fasiliti berjaya ditambah.', 'success');
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Fasiliti gagal ditambah.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

function openFacilityEditModal(id) {
  const facility = facilitiesCache.find((item) => String(item.id) === String(id));
  if (!facility) return;

  setText('modalTitle', `Edit Fasiliti - ${facility.name}`);
  document.getElementById('modalBody').innerHTML = `
    <div class="edit-facility-form">
      <div class="form-group">
        <label for="editFacilityName">Nama Fasiliti *</label>
        <input type="text" id="editFacilityName" maxlength="100" value="${escapeAttr(facility.name)}">
      </div>
      <div class="form-group">
        <label for="editFacilityIcon">Ikon Bootstrap</label>
        <input type="text" id="editFacilityIcon" maxlength="50" value="${escapeAttr(facility.icon || 'bi-building')}">
      </div>
      <div class="form-group">
        <label for="editFacilityCapacity">Kapasiti *</label>
        <input type="number" id="editFacilityCapacity" min="1" max="5000" value="${escapeAttr(String(facility.capacity || 1))}">
      </div>
      <div class="form-group">
        <label for="editFacilityPrice">Harga (RM) *</label>
        <input type="number" id="editFacilityPrice" min="0" max="999999.99" step="0.01" value="${escapeAttr(String(facility.price_per_hour || 0))}">
      </div>
      <div class="form-group">
        <label for="editFacilityMaxRooms">Had Bilik</label>
        <input type="number" id="editFacilityMaxRooms" min="1" max="500" value="${escapeAttr(String(facility.max_rooms || ''))}" placeholder="10">
      </div>
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
      <label class="admin-facility-check span-2">
        <input type="checkbox" id="editFacilityAvailable" ${facility.is_available ? 'checked' : ''}>
        <span>Tersedia untuk tempahan</span>
      </label>
    </div>
  `;
  renderAdminEquipmentOptions('editFacilityEquipment');
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('bookingModal')">Batal</button>
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
    equipment_options: parseAdminEquipmentValue(document.getElementById('editFacilityEquipment')?.value || ''),
    is_available: Boolean(document.getElementById('editFacilityAvailable')?.checked),
  };

  if (!data.name || data.capacity < 1 || data.price_per_hour < 0 || (data.max_rooms !== null && data.max_rooms < 1)) {
    showToast('Sila lengkapkan maklumat fasiliti.', 'error');
    return;
  }

  if (button) button.disabled = true;
  try {
    const result = await tryApi(`facilities.php?id=${encodeURIComponent(id)}`, 'PUT', data);
    const updated = normalizeFacilities([result.data])[0];
    const index = facilitiesCache.findIndex((item) => String(item.id) === String(id));
    if (index >= 0) facilitiesCache[index] = updated;
    renderFacilityManagement(facilitiesCache);
    closeModal('bookingModal');
    showToast('Fasiliti berjaya dikemas kini.', 'success');
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Fasiliti gagal dikemas kini.', 'error');
  } finally {
    if (button) button.disabled = false;
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
    showToast(error.message || 'Sambungan server diperlukan untuk mengubah ketersediaan fasiliti.', 'error');
    return;
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
    if (handleAdminAuthorizationError(error)) return;
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-people"></i></div><div class="empty-state-title">Senarai pelanggan tidak dapat dimuatkan</div></div></td></tr>`;
  }
}

function renderClientsTable(clients) {
  const tbody = document.getElementById('clientsTbody');
  if (!tbody) return;

  if (!clients.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-person-x"></i></div><div class="empty-state-title">Tiada Pelanggan</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = clients.map((client) => `
    <tr>
      <td><span class="table-email" title="${escapeAttr(client.email)}">${escapeHtml(client.email)}</span></td>
      <td class="table-phone">${escapeHtml(client.phone || '-')}</td>
      <td class="table-status"><span class="status-badge status-pending">${Number(client.booking_count || 0)} tempahan</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm table-icon-btn" onclick="viewClientDetail(${Number(client.id)})" title="Lihat pelanggan" aria-label="Lihat pelanggan ${escapeAttr(client.email)}"><i class="bi bi-eye"></i></button>
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
      <div class="admin-password-reset">
        <label for="clientPasswordReset">Tetapkan Kata Laluan Baharu</label>
        <div class="admin-password-reset-row">
          <input type="password" id="clientPasswordReset" minlength="6" autocomplete="new-password" placeholder="Minimum 6 aksara">
          <button class="btn btn-primary btn-sm" id="clientPasswordResetButton" type="button" onclick="updateClientPassword(${Number(user.id)})"><i class="bi bi-key"></i> Simpan</button>
        </div>
      </div>
      <div style="margin-top:24px">
        <div class="admin-card-title" style="margin-bottom:12px">Tempahan Pelanggan</div>
        ${bookings.length ? `
          <div style="overflow-x:auto">
            <table class="data-table admin-client-bookings-table">
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
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Butiran pelanggan gagal dimuatkan.', 'error');
  }
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

  if (button) button.disabled = true;
  try {
    await tryApi(`users.php?id=${encodeURIComponent(id)}`, 'PUT', { password });
    if (input) input.value = '';
    showToast('Kata laluan pelanggan berjaya dikemas kini.', 'success');
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Kata laluan pelanggan gagal dikemas kini.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadMessages() {
  const tbody = document.getElementById('messagesTbody');
  if (!tbody) return;

  try {
    const result = await tryApi('messages.php');
    renderMessagesTable(result.data || []);
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-chat-square-x"></i></div><div class="empty-state-title">Mesej tidak dapat dimuatkan</div></div></td></tr>';
  }
}

function renderMessagesTable(messages) {
  const tbody = document.getElementById('messagesTbody');
  if (!tbody) return;
  if (!messages.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-chat-dots"></i></div><div class="empty-state-title">Tiada Mesej</div></div></td></tr>';
    return;
  }

  tbody.innerHTML = messages.map((message) => {
    const replySubject = encodeURIComponent(`Re: ${message.subject || 'Mesej PoliSpace'}`);
    return `
      <tr>
        <td><span class="table-email" title="${escapeAttr(message.email)}">${escapeHtml(message.email)}</span></td>
        <td>${escapeHtml(message.subject || '-')}</td>
        <td class="admin-message-content">${escapeHtml(message.message || '-')}</td>
        <td class="table-date">${escapeHtml(formatDateTime(message.created_at))}</td>
        <td><div class="table-actions"><a class="btn btn-secondary btn-sm table-icon-btn" href="mailto:${escapeAttr(message.email)}?subject=${replySubject}" title="Balas melalui e-mel" aria-label="Balas mesej ${escapeAttr(message.email)}"><i class="bi bi-reply"></i></a></div></td>
      </tr>
    `;
  }).join('');
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
  document.querySelectorAll('.admin-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.admin-menu-item').forEach((b) => b.classList.remove('active'));
  document.getElementById(`panel-${name}`)?.classList.add('active');
  btn?.classList.add('active');
  if (name === 'bookings') filterBookings('all', document.querySelector('#bookingFilterTabs .filter-tab'));
  if (name === 'messages') loadMessages();
  if (name === 'clients') loadClients();
  if (name === 'calendar') renderAdminDashboard();
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
      <div style="margin-left:auto">${statusBadgeHtml(booking.status)}</div>
    </div>
    <div class="detail-row"><span class="detail-label">Nama Penyewa</span><span class="detail-value">${escapeHtml(booking.name)}</span></div>
    <div class="detail-row"><span class="detail-label">Telefon</span><span class="detail-value">${escapeHtml(booking.phone)}</span></div>
    <div class="detail-row"><span class="detail-label">Jumlah Pengguna</span><span class="detail-value">${escapeHtml(String(booking.pax || '-'))}</span></div>
    ${booking.asrama_type ? `<div class="detail-row"><span class="detail-label">Asrama</span><span class="detail-value">${escapeHtml(asramaTypeLabel(booking.asrama_type))} - ${escapeHtml(String(booking.room_count || 1))} bilik</span></div>` : ''}
    <div class="detail-row"><span class="detail-label">Peralatan</span><span class="detail-value">${escapeHtml(booking.equipment || '-')}</span></div>
    <div class="detail-row"><span class="detail-label">Tujuan</span><span class="detail-value">${escapeHtml(booking.purpose || '-')}</span></div>
    <div class="detail-row"><span class="detail-label">Resit Bayaran</span><span class="detail-value">${receiptLinkHtml(booking.paymentFile)}</span></div>
    ${['pending', 'approved'].includes(booking.status) ? rejectNoteHtml(booking.status, booking.adminNote) : ''}
  `;
  document.getElementById('modalFooter').innerHTML = booking.status === 'pending'
    ? `<button class="btn btn-secondary" onclick="closeModal('bookingModal')">Batal</button><button class="btn btn-danger" onclick="rejectBookingFromModal('${escapeAttr(booking.id)}')"><i class="bi bi-x-lg"></i> Tolak</button><button class="btn btn-success" onclick="approveBookingFromModal('${escapeAttr(booking.id)}')"><i class="bi bi-check-lg"></i> Luluskan</button>`
    : booking.status === 'approved'
      ? `<button class="btn btn-secondary" onclick="closeModal('bookingModal')">Batal</button><button class="btn btn-danger" onclick="rejectBookingFromModal('${escapeAttr(booking.id)}')"><i class="bi bi-x-lg"></i> Tolak Tempahan</button>`
    : `<button class="btn btn-secondary" onclick="closeModal('bookingModal')">Tutup</button>`;
  document.getElementById('bookingModal')?.classList.add('active');
}

function rejectNoteHtml(status, currentNote = '') {
  const helper = status === 'approved'
    ? 'Tempahan ini sudah diluluskan / dibayar. Nyatakan sebab tarikh tersebut tidak dapat diberikan kepada pengguna.'
    : 'Nyatakan sebab permohonan ini ditolak.';
  return `
    <div class="admin-reject-note">
      <label>Sebab Penolakan *</label>
      <textarea id="modalNote" style="min-height:96px" placeholder="cth: Fasiliti perlu digunakan untuk program rasmi pada tarikh tersebut.">${escapeHtml(currentNote || '')}</textarea>
      <div class="admin-note-help">${helper}</div>
    </div>
  `;
}

async function updateStatus(id, status, note = '') {
  try {
    await tryApi(`bookings.php?action=status&id=${encodeURIComponent(id)}`, 'PUT', { status, admin_note: note });
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return false;
    showToast(error.message || 'Status tempahan gagal dikemas kini.', 'error');
    return false;
  }
  await renderAdminDashboard();
  return true;
}

async function approveBooking(id) {
  if (await updateStatus(id, 'approved')) showToast('Diluluskan', 'success');
}

async function approveBookingFromModal(id) {
  if (await updateStatus(id, 'approved', document.getElementById('modalNote')?.value || '')) {
    closeModal('bookingModal');
    showToast('Diluluskan', 'success');
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
    showToast('Ditolak', 'error');
  }
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


