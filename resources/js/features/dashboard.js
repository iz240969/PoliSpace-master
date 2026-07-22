// ==================== DASHBOARD ====================
let psCurrentUserEmail = localStorage.getItem('ps_user_email') || '';

function initDashboard() {
  if (!psCurrentUserEmail) {
    window.location.href = ROUTES.login;
    return;
  }
  const input = document.getElementById('dashEmailInput');
  if (input) input.value = psCurrentUserEmail;
  loadUserBookings();
}

function setUserEmail() {
  const email = document.getElementById('dashEmailInput')?.value.trim() || '';
  if (!isValidEmail(email)) {
    showToast('Format e-mel tidak sah.', 'error');
    return;
  }
  psCurrentUserEmail = email;
  localStorage.setItem('ps_user_email', email);
  loadUserBookings();
  showToast('E-mel dikemas kini. Tempahan anda dimuatkan.', 'success');
}

async function loadUserBookings() {
  const container = document.getElementById('dashBookingsContainer');
  if (!container) return;

  if (!psCurrentUserEmail) {
    setText('bookingCountLabel', '0 tempahan');
    container.innerHTML = `<div class="dash-empty"><div class="empty-icon"><i class="bi bi-envelope"></i></div><div class="empty-title">Masukkan E-mel Anda</div><div class="empty-sub">Gunakan ruangan di atas untuk memuatkan tempahan anda.</div></div>`;
    return;
  }

  let bookings = [];
  try {
    const result = await tryApi(`bookings.php?action=user&email=${encodeURIComponent(psCurrentUserEmail)}`);
    bookings = result.data || [];
  } catch (error) {
    bookings = getBookings().filter((b) => b.email && b.email.toLowerCase() === psCurrentUserEmail.toLowerCase());
  }
  renderUserBookings(bookings, container);
}

function renderUserBookings(bookings, container) {
  bookings.sort((a, b) => (a.date > b.date ? -1 : 1));
  setText('bookingCountLabel', `${bookings.length} tempahan`);
  if (bookings.length === 0) {
    container.innerHTML = `<div class="dash-empty"><div class="empty-icon"><i class="bi bi-calendar2-x"></i></div><div class="empty-title">Tiada Tempahan</div><div class="empty-sub">Anda belum membuat sebarang tempahan dengan e-mel ini.</div><button class="btn btn-primary" style="margin-top:20px;" onclick="window.location.href='${ROUTES.booking}'"><i class="bi bi-calendar-plus"></i> Buat Tempahan Sekarang</button></div>`;
    return;
  }
  container.innerHTML = `
    <div class="dash-table-wrap">
      <table class="data-table dash-bookings-table">
        <thead><tr><th>Rujukan</th><th>Fasiliti</th><th>Tarikh</th><th>Masa</th><th>Status</th><th>Tindakan</th></tr></thead>
        <tbody>${bookings.map((b) => `
          <tr>
            <td><div class="booking-id">${escapeHtml(b.id)}</div></td>
            <td><span style="display:flex;align-items:center;gap:6px;">${b.facilityIcon || ''} ${escapeHtml(b.facilityName)}</span></td>
            <td>${formatDate(b.date)}</td>
            <td>${escapeHtml(b.start)} - ${escapeHtml(b.end || '-')}</td>
            <td>${statusBadgeHtml(b.status)}</td>
            <td>
              <div class="booking-row-actions">
                <button class="btn btn-secondary btn-sm" onclick="viewUserBookingDetail('${escapeAttr(b.id)}')" title="Lihat butiran"><i class="bi bi-eye"></i></button>
                ${b.status === 'pending' ? `<button class="btn btn-secondary btn-sm" onclick="openEditBookingModal('${escapeAttr(b.id)}')" title="Edit tempahan"><i class="bi bi-pencil-square"></i></button><button class="btn-cancel" onclick="cancelUserBooking('${escapeAttr(b.id)}')"><i class="bi bi-x-lg"></i> Batal</button>` : ''}
              </div>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
}

async function cancelUserBooking(id) {
  if (!confirm('Anda pasti mahu membatalkan tempahan ini?')) return;
  try {
    await tryApi(`bookings.php?action=status&id=${encodeURIComponent(id)}`, 'PUT', { status: 'cancelled', admin_note: 'Dibatalkan oleh pengguna.' });
  } catch (error) {
    if (!canUseLocalFallback(error)) {
      showToast(error.message || 'Tempahan tidak dapat dibatalkan.', 'error');
      return;
    }
    const bookings = getBookings();
    const booking = bookings.find((b) => b.id === id);
    if (booking) {
      booking.status = 'cancelled';
      booking.adminNote = 'Dibatalkan oleh pengguna.';
      saveBookings(bookings);
    }
  }
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
      <div class="detail-row"><span class="detail-label">Tujuan</span><span class="detail-value">${escapeHtml(booking.purpose || '-')}</span></div>
      ${booking.adminNote ? `<div class="detail-row"><span class="detail-label">Nota Admin</span><span class="detail-value">${escapeHtml(booking.adminNote)}</span></div>` : ''}
    `;
    document.getElementById('userBookingModalFooter').innerHTML = `
      ${booking.status === 'pending' ? `<button class="btn btn-secondary" onclick="openEditBookingModal('${escapeAttr(booking.id || booking.booking_ref)}')"><i class="bi bi-pencil-square"></i> Edit</button>` : ''}
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

    if (booking.status !== 'pending') {
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
          <select id="edit-booking-duration">
            ${bookingDurationOptions(booking.duration)}
          </select>
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
      </div>
    `;
    document.getElementById('userBookingModalFooter').innerHTML = `
      <button class="btn btn-secondary" onclick="closeModal('userBookingModal')">Batal</button>
      <button class="btn btn-primary" onclick="submitUserBookingEdit('${escapeAttr(booking.id || booking.booking_ref)}')"><i class="bi bi-check-lg"></i> Simpan</button>
    `;
    document.getElementById('userBookingModal')?.classList.add('active');

    const minDate = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('edit-booking-date');
    if (dateEl) dateEl.min = minDate;
    document.getElementById('edit-booking-start')?.addEventListener('change', updateEditEndTime);
    document.getElementById('edit-booking-duration')?.addEventListener('change', updateEditEndTime);
  } catch (error) {
    showToast(error.message || 'Borang edit gagal dimuatkan.', 'error');
  }
}

function bookingDurationOptions(currentDuration) {
  const options = [
    ['1', '1 Jam'],
    ['2', '2 Jam'],
    ['3', '3 Jam'],
    ['4', '4 Jam'],
    ['halfday', 'Setengah Hari'],
    ['fullday', 'Sehari Penuh'],
  ];
  return options.map(([value, label]) => `<option value="${value}" ${String(currentDuration || '1') === value ? 'selected' : ''}>${label}</option>`).join('');
}

function updateEditEndTime() {
  const start = document.getElementById('edit-booking-start')?.value;
  const duration = document.getElementById('edit-booking-duration')?.value || '1';
  const endEl = document.getElementById('edit-booking-end');
  if (!start || !endEl) return;

  const durationMap = { '1': 60, '2': 120, '3': 180, '4': 240, halfday: 240, fullday: 480 };
  const [hours, mins] = start.split(':').map(Number);
  const total = hours * 60 + mins + (durationMap[duration] || 60);
  endEl.value = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function submitUserBookingEdit(id) {
  const data = {
    booking_date: document.getElementById('edit-booking-date')?.value || '',
    duration: document.getElementById('edit-booking-duration')?.value || '1',
    start_time: document.getElementById('edit-booking-start')?.value || '',
    end_time: document.getElementById('edit-booking-end')?.value || '',
    purpose: document.getElementById('edit-booking-purpose')?.value.trim() || '',
  };

  if (!data.booking_date || !data.start_time || !data.purpose) {
    showToast('Sila lengkapkan tarikh, masa mula dan tujuan.', 'error');
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
    if (booking && booking.status === 'pending') {
      booking.date = data.booking_date;
      booking.duration = data.duration;
      booking.start = data.start_time;
      booking.end = data.end_time;
      booking.purpose = data.purpose;
      saveBookings(bookings);
    }
  }

  closeModal('userBookingModal');
  await loadUserBookings();
  showToast('Tempahan berjaya dikemas kini.', 'success');
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
