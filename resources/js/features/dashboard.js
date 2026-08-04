// ==================== DASHBOARD ====================
let psCurrentUserEmail = localStorage.getItem('ps_user_email') || '';
let pendingCancelBookingId = '';
let pendingReceiptBookingId = '';
let psDashboardBookings = [];

function initDashboard() {
  psCurrentUserEmail = psAuthState.role === 'user'
    ? (psAuthState.user?.email || localStorage.getItem('ps_user_email') || '')
    : '';

  if (!psCurrentUserEmail) {
    window.location.href = ROUTES.login;
    return;
  }
  loadUserBookings();
}

async function loadUserBookings() {
  const container = document.getElementById('dashBookingsContainer');
  if (!container) return;

  if (!psCurrentUserEmail) {
    setText('bookingCountLabel', '0 tempahan');
    container.innerHTML = `<div class="dash-empty"><div class="empty-icon"><i class="bi bi-envelope"></i></div><div class="empty-title">Log Masuk Diperlukan</div><div class="empty-sub">Sila log masuk untuk melihat tempahan anda.</div></div>`;
    return;
  }

  let bookings = [];
  try {
    const result = await tryApi('bookings.php?action=user');
    bookings = result.data || [];
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      psCurrentUserEmail = '';
      clearStoredAuthState();
      window.location.href = ROUTES.login;
      return;
    }
    bookings = getBookings().filter((b) => b.email && b.email.toLowerCase() === psCurrentUserEmail.toLowerCase());
  }
  psDashboardBookings = bookings;
  applyBookingFilters();
}

function applyBookingFilters() {
  const container = document.getElementById('dashBookingsContainer');
  if (!container) return;

  const query = (document.getElementById('bookingSearchInput')?.value || '').trim().toLowerCase();
  const status = document.querySelector('.dash-filter-chip.active')?.dataset.status || 'all';
  const bookings = psDashboardBookings
    .filter((booking) => {
      if (status !== 'all' && booking.status !== status) return false;
      if (!query) return true;

      return [
        booking.id,
        booking.booking_ref,
        booking.facilityName,
        booking.purpose,
        booking.date,
        booking.status,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    })
    .sort(compareBookingsByMostRecent);

  renderUserBookings(bookings, container, psDashboardBookings.length);
}

function setBookingStatusFilter(button) {
  document.querySelectorAll('.dash-filter-chip').forEach((chip) => {
    chip.classList.toggle('active', chip === button);
  });
  applyBookingFilters();
}

function compareBookingsByMostRecent(a, b) {
  const createdA = Date.parse(a.createdAt || a.created_at || '') || 0;
  const createdB = Date.parse(b.createdAt || b.created_at || '') || 0;
  const dateA = `${a.date || ''} ${a.start || ''}`;
  const dateB = `${b.date || ''} ${b.start || ''}`;

  if (createdA || createdB) return createdB - createdA;
  return dateB.localeCompare(dateA);
}

function renderUserBookings(bookings, container, totalCount = bookings.length) {
  setText('bookingCountLabel', totalCount === bookings.length ? `${bookings.length} tempahan` : `${bookings.length} / ${totalCount} tempahan`);
  if (bookings.length === 0) {
    const hasFilters = totalCount > 0;
    container.innerHTML = hasFilters
      ? `<div class="dash-empty"><div class="empty-icon"><i class="bi bi-funnel"></i></div><div class="empty-title">Tiada Padanan</div><div class="empty-sub">Cuba ubah carian atau filter status tempahan.</div></div>`
      : `<div class="dash-empty"><div class="empty-icon"><i class="bi bi-calendar2-x"></i></div><div class="empty-title">Tiada Tempahan</div><div class="empty-sub">Anda belum membuat sebarang tempahan dengan e-mel ini.</div><button class="btn btn-primary" style="margin-top:20px;" onclick="window.location.href='${ROUTES.booking}'"><i class="bi bi-calendar-plus"></i> Buat Tempahan Sekarang</button></div>`;
    return;
  }
  container.innerHTML = `
    <div class="dashboard-table-wrap">
      <table class="dashboard-booking-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Fasiliti</th>
            <th>Tarikh</th>
            <th>Masa</th>
            <th>Status</th>
            <th>Tindakan</th>
          </tr>
        </thead>
        <tbody>
          ${bookings.map((b) => `
            <tr>
              <td><span class="booking-id">${escapeHtml(b.id)}</span></td>
              <td>
                <div class="dashboard-facility-cell">
                  <span class="dashboard-facility-icon">${b.facilityIcon || '<i class="bi bi-building"></i>'}</span>
                  <span>${escapeHtml(b.facilityName || '-')}</span>
                </div>
              </td>
              <td>${formatDate(b.date)}</td>
              <td>${escapeHtml(b.start || '-')} - ${escapeHtml(b.end || '-')}</td>
              <td>${statusBadgeHtml(b.status)}</td>
              <td>
                <div class="booking-row-actions">
                  ${b.status === 'unpaid' ? `<button class="btn btn-primary btn-sm" onclick="openReceiptUploadModal('${escapeAttr(b.id)}')" title="Muat naik resit"><i class="bi bi-receipt"></i></button>` : ''}
                  ${['unpaid', 'pending'].includes(b.status) ? `<button class="btn-cancel" onclick="cancelUserBooking('${escapeAttr(b.id)}')"><i class="bi bi-x-lg"></i> Batal</button>` : ''}
                  ${['unpaid', 'pending'].includes(b.status) ? `<button class="btn btn-secondary btn-sm" onclick="openEditBookingModal('${escapeAttr(b.id)}')" title="Edit tempahan"><i class="bi bi-pencil-square"></i></button>` : ''}
                  <button class="btn btn-secondary btn-sm" onclick="viewUserBookingDetail('${escapeAttr(b.id)}')" title="Lihat butiran"><i class="bi bi-eye"></i></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function cancelUserBooking(id) {
  pendingCancelBookingId = id;
  setText('cancelBookingRef', id);
  document.getElementById('cancelBookingModal')?.classList.add('active');
}

async function confirmCancelUserBooking() {
  const id = pendingCancelBookingId;
  if (!id) return;
  const dashboardBooking = psDashboardBookings.find((booking) => booking.id === id || booking.booking_ref === id);

  closeModal('cancelBookingModal');
  try {
    await tryApi(`bookings.php?action=status&id=${encodeURIComponent(id)}`, 'PUT', { status: 'cancelled', admin_note: 'Dibatalkan oleh pengguna.' });
  } catch (error) {
    if (!canUseLocalFallback(error)) {
      showToast(error.message || 'Tempahan tidak dapat dibatalkan.', 'error');
      return;
    }
    if (dashboardBooking?.status === 'pending') {
      showToast('Sambungan server diperlukan untuk membatalkan tempahan yang telah dibayar.', 'error');
      return;
    }
    const bookings = getBookings();
    const booking = bookings.find((b) => b.id === id);
    if (!booking) {
      showToast('Sambungan server diperlukan untuk membatalkan tempahan ini.', 'error');
      return;
    }
    booking.status = 'cancelled';
    booking.adminNote = 'Dibatalkan oleh pengguna.';
    saveBookings(bookings);
  }
  pendingCancelBookingId = '';
  loadUserBookings();
  showToast(`Tempahan ${id} telah dibatalkan.`, 'success');
}

async function getUserBookingForDashboard(id) {
  if (apiOnline) {
    try {
      const result = await tryApi(`bookings.php?action=ref&ref=${encodeURIComponent(id)}`);
      return result.data;
    } catch (error) {
      if (!canUseLocalFallback(error)) throw error;
    }
  }

  return getBookings().find((booking) => booking.id === id || booking.booking_ref === id);
}

async function viewUserBookingDetail(id) {
  try {
    const booking = await getUserBookingForDashboard(id);
    if (!booking) {
      showToast('Tempahan tidak dijumpai.', 'error');
      return;
    }

    setText('userBookingModalTitle', `Butiran Tempahan - ${booking.id || booking.booking_ref}`);
    document.getElementById('userBookingModalBody').innerHTML = `
      <div class="user-booking-summary">
        <div class="user-booking-icon">${booking.facilityIcon || '<i class="bi bi-building"></i>'}</div>
        <div>
          <div class="user-booking-name">${escapeHtml(booking.facilityName || '-')}</div>
          <div class="user-booking-ref">${escapeHtml(booking.id || booking.booking_ref || '-')}</div>
        </div>
        ${statusBadgeHtml(booking.status)}
      </div>
      <div class="detail-row"><span class="detail-label">Tarikh</span><span class="detail-value">${formatDate(booking.date)}</span></div>
      <div class="detail-row"><span class="detail-label">Masa</span><span class="detail-value">${escapeHtml(booking.start || '-')} - ${escapeHtml(booking.end || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Angka</span><span class="detail-value">${escapeHtml(String(booking.pax || '-'))}</span></div>
      <div class="detail-row"><span class="detail-label">Peralatan</span><span class="detail-value">${escapeHtml(booking.equipment || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Tujuan</span><span class="detail-value">${escapeHtml(booking.purpose || '-')}</span></div>
      ${booking.adminNote ? `<div class="detail-row"><span class="detail-label">Nota Admin</span><span class="detail-value">${escapeHtml(booking.adminNote)}</span></div>` : ''}
    `;
    document.getElementById('userBookingModalFooter').innerHTML = `
      ${booking.status === 'unpaid' ? `<button class="btn btn-primary" onclick="openReceiptUploadModal('${escapeAttr(booking.id || booking.booking_ref)}')"><i class="bi bi-receipt"></i> Muat Naik Resit</button>` : ''}
      ${['unpaid', 'pending'].includes(booking.status) ? `<button class="btn btn-secondary" onclick="openEditBookingModal('${escapeAttr(booking.id || booking.booking_ref)}')"><i class="bi bi-pencil-square"></i> Edit</button>` : ''}
      <button class="btn btn-primary" onclick="closeModal('userBookingModal')">Tutup</button>
    `;
    document.getElementById('userBookingModal')?.classList.add('active');
  } catch (error) {
    showToast(error.message || 'Butiran tempahan gagal dimuatkan.', 'error');
  }
}

async function openEditBookingModal(id) {
  try {
    const booking = await getUserBookingForDashboard(id);
    if (!booking) {
      showToast('Tempahan tidak dijumpai.', 'error');
      return;
    }

    if (!['unpaid', 'pending'].includes(booking.status)) {
      showToast('Tempahan yang telah selesai tidak boleh diedit.', 'error');
      return;
    }

    setText('userBookingModalTitle', `Edit Tempahan - ${booking.id || booking.booking_ref}`);
    document.getElementById('userBookingModalBody').innerHTML = `
      <div class="edit-booking-form">
        <div class="form-group">
          <label>Tarikh Tempahan *</label>
          <input type="date" id="edit-booking-date" value="${escapeAttr(booking.date || '')}">
        </div>
        <div class="form-group">
          <label>Tempoh Penggunaan</label>
          <div class="duration-field">
            <div class="duration-input-wrap" role="group" aria-label="Tempoh penggunaan dalam jam">
              <button type="button" class="duration-step-button" onclick="adjustDuration(-1, 'edit-booking-duration')" aria-label="Kurangkan tempoh penggunaan"><i class="bi bi-dash-lg"></i></button>
              <input type="number" id="edit-booking-duration" min="1" max="24" step="1" value="${escapeAttr(durationInputValue(booking.duration || '1'))}" inputmode="numeric" aria-label="Tempoh penggunaan dalam jam">
              <span class="duration-unit">Jam</span>
              <button type="button" class="duration-step-button" onclick="adjustDuration(1, 'edit-booking-duration')" aria-label="Tambah tempoh penggunaan"><i class="bi bi-plus-lg"></i></button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>Masa Mula *</label>
          <input type="time" id="edit-booking-start" value="${escapeAttr(booking.start || '')}">
        </div>
        <div class="form-group">
          <label>Masa Tamat</label>
          <input type="time" id="edit-booking-end" value="${escapeAttr(booking.end || '')}" readonly>
        </div>
        <div class="form-group span-2">
          <label>Tujuan Penggunaan *</label>
          <textarea id="edit-booking-purpose">${escapeHtml(booking.purpose || '')}</textarea>
        </div>
        <div class="form-group span-2">
          <label>Peralatan Diperlukan</label>
          <div class="equipment-field">
            <input type="hidden" id="edit-booking-equipment" value="${escapeAttr(booking.equipment || '')}">
            <div class="equipment-add-row">
              <div class="equipment-select-wrap">
                <select id="editEquipmentAddSelect" aria-label="Pilih peralatan"></select>
                <i class="bi bi-chevron-down"></i>
              </div>
              <button type="button" class="equipment-add-button" onclick="addEquipmentItem('edit-booking-equipment', 'editEquipmentAddSelect', 'editEquipmentList')" aria-label="Tambah peralatan">
                <i class="bi bi-plus-lg"></i> Tambah
              </button>
            </div>
            <div class="equipment-list" id="editEquipmentList"></div>
          </div>
        </div>
        <div class="form-group">
          <label>Jumlah Pengguna</label>
          <div class="quantity-control">
            <button type="button" onclick="adjustParticipantCount('edit-booking-participants', -1)" aria-label="Kurangkan jumlah pengguna"><i class="bi bi-dash-lg"></i></button>
            <input type="number" id="edit-booking-participants" min="1" step="1" value="${escapeAttr(String(booking.pax || '1'))}">
            <button type="button" onclick="adjustParticipantCount('edit-booking-participants', 1)" aria-label="Tambah jumlah pengguna"><i class="bi bi-plus-lg"></i></button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('userBookingModalFooter').innerHTML = `
      <button class="btn btn-secondary" onclick="closeModal('userBookingModal')">Batal</button>
      <button class="btn btn-primary" onclick="submitUserBookingEdit('${escapeAttr(booking.id || booking.booking_ref)}')"><i class="bi bi-check-lg"></i> Simpan</button>
    `;
    document.getElementById('userBookingModal')?.classList.add('active');

    const minDate = getMinimumBookingDateValue();
    const dateEl = document.getElementById('edit-booking-date');
    if (dateEl) {
      dateEl.min = minDate;
      dateEl.addEventListener('change', () => validateDashboardBookingDateAvailability(booking));
    }
    document.getElementById('edit-booking-start')?.addEventListener('change', updateEditEndTime);
    document.getElementById('edit-booking-duration')?.addEventListener('input', updateEditEndTime);
    document.getElementById('edit-booking-duration')?.addEventListener('blur', () => normalizeDurationInput('edit-booking-duration'));
    initializeEquipmentField(booking.equipment || '', 'edit-booking-equipment', 'editEquipmentAddSelect', 'editEquipmentList');
  } catch (error) {
    showToast(error.message || 'Borang edit gagal dimuatkan.', 'error');
  }
}

async function validateDashboardBookingDateAvailability(booking) {
  const dateInput = document.getElementById('edit-booking-date');
  const selectedDate = dateInput?.value || '';
  if (!dateInput || !selectedDate) return true;
  if (selectedDate < getMinimumBookingDateValue()) {
    dateInput.value = '';
    showToast('Tempahan mesti dibuat sekurang-kurangnya 3 hari lebih awal.', 'error');
    return false;
  }

  const [year, month] = selectedDate.split('-').map(Number);
  const bookings = await loadPublicCalendarBookings(year, month);
  const bookingId = String(booking.id || booking.booking_ref || '');
  const isBlocked = bookings.some((item) => String(item.facilityId) === String(booking.facilityId)
    && item.date === selectedDate
    && String(item.id || '') !== bookingId);
  if (isBlocked) {
    dateInput.value = '';
    showToast('Tarikh ini telah dikunci oleh tempahan berbayar. Sila pilih tarikh lain.', 'error');
    return false;
  }
  return true;
}

function updateEditEndTime() {
  const start = document.getElementById('edit-booking-start')?.value;
  const duration = document.getElementById('edit-booking-duration')?.value || '1';
  const endEl = document.getElementById('edit-booking-end');
  if (!start || !endEl) return;

  const [hours, mins] = start.split(':').map(Number);
  const total = hours * 60 + mins + durationToMinutes(duration);
  endEl.value = total >= 24 * 60
    ? ''
    : `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function submitUserBookingEdit(id) {
  normalizeDurationInput('edit-booking-duration');
  normalizeEquipmentField('edit-booking-equipment', 'editEquipmentList');
  const data = {
    booking_date: document.getElementById('edit-booking-date')?.value || '',
    duration: document.getElementById('edit-booking-duration')?.value || '1',
    start_time: document.getElementById('edit-booking-start')?.value || '',
    end_time: document.getElementById('edit-booking-end')?.value || '',
    purpose: document.getElementById('edit-booking-purpose')?.value.trim() || '',
    equipment_required: document.getElementById('edit-booking-equipment')?.value.trim() || '',
    participant_count: Number(document.getElementById('edit-booking-participants')?.value || 0),
  };
  const durationHours = Number.parseFloat(String(data.duration).replace(',', '.'));

  if (!data.booking_date || !data.start_time || !data.purpose || !Number.isInteger(data.participant_count) || data.participant_count < 1) {
    showToast('Sila lengkapkan tarikh, masa mula, tujuan dan angka pengguna.', 'error');
    return;
  }
  const currentBooking = psDashboardBookings.find((booking) => booking.id === id || booking.booking_ref === id);
  const facility = facilitiesCache.find((item) => String(item.id) === String(currentBooking?.facilityId || currentBooking?.facility_id));
  if (facility?.capacity > 0 && data.participant_count > facility.capacity) {
    showToast(`Jumlah pengguna melebihi kapasiti ${facility.capacity} orang.`, 'error');
    return;
  }
  if (data.booking_date < getMinimumBookingDateValue()) {
    showToast('Tempahan mesti dibuat sekurang-kurangnya 3 hari lebih awal.', 'error');
    return;
  }
  if (!Number.isInteger(durationHours) || durationHours <= 0 || durationHours > 24) {
    showToast('Sila masukkan tempoh penggunaan antara 1 hingga 24 jam penuh.', 'error');
    return;
  }
  const startMinutes = bookingTimeToMinutes(data.start_time);
  const endMinutes = bookingTimeToMinutes(data.end_time);
  if (startMinutes === null || endMinutes === null || startMinutes + (durationHours * 60) !== endMinutes) {
    showToast('Tempahan mesti tamat pada hari yang sama dan sepadan dengan tempoh penggunaan.', 'error');
    return;
  }

  try {
    await tryApi(`bookings.php?action=user-update&id=${encodeURIComponent(id)}`, 'PUT', data);
  } catch (error) {
    if (!canUseLocalFallback(error)) {
      showToast(error.message || 'Tempahan gagal dikemas kini.', 'error');
      return;
    }

    const bookings = getBookings();
    const booking = bookings.find((item) => item.id === id || item.booking_ref === id);
    if (currentBooking?.status === 'pending') {
      showToast('Sambungan server diperlukan untuk mengubah tempahan yang telah dibayar.', 'error');
      return;
    }
    if (!booking) {
      showToast('Sambungan server diperlukan untuk mengubah tempahan ini.', 'error');
      return;
    }
    if (booking && ['unpaid', 'pending'].includes(booking.status)) {
      if (hasLocalBlockingConflict({ ...data, facility_id: booking.facilityId || booking.facility_id }, booking.id || booking.booking_ref)) {
        showToast('Tarikh ini telah dikunci oleh tempahan berbayar. Sila pilih tarikh lain.', 'error');
        return;
      }
      booking.date = data.booking_date;
      booking.duration = data.duration;
      booking.start = data.start_time;
      booking.end = data.end_time;
      booking.purpose = data.purpose;
      booking.equipment = data.equipment_required;
      booking.pax = data.participant_count || '-';
      saveBookings(bookings);
    }
  }

  closeModal('userBookingModal');
  await loadUserBookings();
  showToast('Tempahan berjaya dikemas kini.', 'success');
}

function openReceiptUploadModal(id) {
  pendingReceiptBookingId = id;
  setText('receiptBookingRef', id);
  const input = document.getElementById('dashboardReceiptInput');
  if (input) input.value = '';
  setText('dashboardReceiptFileName', 'Tiada fail dipilih');
  document.getElementById('receiptUploadModal')?.classList.add('active');
}

function updateDashboardReceiptFileName() {
  const file = document.getElementById('dashboardReceiptInput')?.files?.[0] || null;
  setText('dashboardReceiptFileName', file ? file.name : 'Tiada fail dipilih');
}

async function submitDashboardReceipt() {
  const id = pendingReceiptBookingId;
  const file = document.getElementById('dashboardReceiptInput')?.files?.[0] || null;
  if (!id) return;
  if (!file) {
    showToast('Sila pilih fail resit dahulu.', 'error');
    return;
  }
  if (!isValidReceiptFile(file)) {
    showToast('Resit mesti dalam format JPG, PNG, GIF atau PDF dan tidak melebihi 5MB.', 'error');
    return;
  }

  try {
    await uploadBookingReceiptApi(id, file);
  } catch (error) {
    const message = canUseLocalFallback(error)
      ? 'Ketersediaan tidak dapat disahkan. Resit belum dihantar; sila cuba lagi apabila sambungan server pulih.'
      : error.message || 'Resit gagal dimuat naik.';
    showToast(message, 'error');
    return;
  }

  closeModal('receiptUploadModal');
  pendingReceiptBookingId = '';
  await loadUserBookings();
  showToast('Resit diterima. Status tempahan kini Menunggu semakan.', 'success');
}

function openContactModal() {
  const emailInput = document.getElementById('contactEmail');
  if (emailInput) emailInput.value = psCurrentUserEmail || '';
  document.getElementById('contactModal')?.classList.add('active');
}

async function sendContactMessage() {
  const email = document.getElementById('contactEmail')?.value.trim() || '';
  const subject = document.getElementById('contactSubject')?.value.trim() || '';
  const message = document.getElementById('contactMessage')?.value.trim() || '';

  if (!isValidEmail(email) || !subject || !message) {
    showToast('Sila lengkapkan semua ruangan dengan e-mel yang sah.', 'error');
    return;
  }

  try {
    await tryApi('messages.php', 'POST', { email, subject, message });
  } catch (error) {
    const contacts = JSON.parse(localStorage.getItem('ps_contact_messages') || '[]');
    contacts.push({ id: `MSG-${String(contacts.length + 1).padStart(4, '0')}`, email, subject, message, createdAt: new Date().toISOString(), read: false });
    localStorage.setItem('ps_contact_messages', JSON.stringify(contacts));
  }

  closeModal('contactModal');
  const subjectEl = document.getElementById('contactSubject');
  const messageEl = document.getElementById('contactMessage');
  if (subjectEl) subjectEl.value = '';
  if (messageEl) messageEl.value = '';
  showToast('Mesej anda telah dihantar. Admin akan respon segera.', 'success');
}
