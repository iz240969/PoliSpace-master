// ==================== STATUS PAGE ====================
async function checkStatus() {
  const ref = document.getElementById('statusInput')?.value.trim().toUpperCase() || '';
  const card = document.getElementById('statusResultCard');
  if (!ref || !card) return;

  const button = document.getElementById('statusSearchButton');
  if (button?.disabled) return;
  if (button) setButtonLoading(button, true, 'Menyemak status...');

  try {
    const result = await tryApi(`bookings.php?action=ref&ref=${encodeURIComponent(ref)}`);
    renderStatusCard(result.data, card);
  } catch (error) {
    showToast(error.status === 404 ? 'Nombor rujukan tidak dijumpai.' : error.message || 'Status tempahan tidak dapat dimuatkan.', 'error');
    card.classList.remove('show');
  } finally {
    if (button) setButtonLoading(button, false);
  }
}

function renderStatusCard(booking, card) {
  if (booking?.type === 'group') {
    renderStatusGroupCard(booking, card);
    return;
  }

  card.classList.add('show');
  setText('statusRef', booking.id || booking.booking_ref);
  document.getElementById('statusBadge').innerHTML = booking.paymentRequired === false && booking.status === 'pending'
    ? '<div class="status-badge status-pending">Menunggu Kelulusan</div>'
    : statusBadgeHtml(booking.status);
  document.getElementById('statusDetails').innerHTML = `
    <div class="detail-row"><span class="detail-label">Nama</span><span class="detail-value">${escapeHtml(booking.name)}</span></div>
    <div class="detail-row"><span class="detail-label">Fasiliti</span><span class="detail-value detail-value-with-icon">${booking.facilityIcon || ''} ${escapeHtml(booking.facilityName)}</span></div>
    <div class="detail-row"><span class="detail-label">Tarikh</span><span class="detail-value">${formatDate(booking.date)}</span></div>
    <div class="detail-row"><span class="detail-label">${statusBookingDurationLabel(booking).label}</span><span class="detail-value">${statusBookingDurationLabel(booking).value}</span></div>
    <div class="detail-row"><span class="detail-label">Jumlah Pengguna</span><span class="detail-value">${escapeHtml(String(booking.pax || '-'))}</span></div>
    <div class="detail-row"><span class="detail-label">Jenis Pemohon</span><span class="detail-value">${escapeHtml(booking.accountTypeLabel || (booking.accountType === 'staff' ? 'Kakitangan' : 'Orang Awam'))}</span></div>
    <div class="detail-row"><span class="detail-label">Bayaran</span><span class="detail-value">${booking.paymentRequired === false ? 'Tidak diperlukan' : 'Diperlukan'}</span></div>
    <div class="detail-row"><span class="detail-label">Nama Penuh PIC</span><span class="detail-value">${escapeHtml(booking.picFullName || '-')}</span></div>
    <div class="detail-row"><span class="detail-label">No Telefon PIC</span><span class="detail-value">${escapeHtml(booking.picPhone || '-')}</span></div>
    ${booking.asrama_type ? `<div class="detail-row"><span class="detail-label">Asrama</span><span class="detail-value">${escapeHtml(asramaTypeLabel(booking.asrama_type))} - ${escapeHtml(String(booking.room_count || 1))} bilik</span></div>` : ''}
    <div class="detail-row"><span class="detail-label">Peralatan</span><span class="detail-value">${escapeHtml(booking.equipment || '-')}</span></div>
    <div class="detail-row"><span class="detail-label">Tujuan</span><span class="detail-value">${escapeHtml(booking.purpose)}</span></div>
    ${booking.adminNote ? `<div class="detail-row"><span class="detail-label">Nota Admin</span><span class="detail-value detail-value-warning">${escapeHtml(booking.adminNote)}</span></div>` : ''}
    ${booking.cancellationReason ? `<div class="detail-row"><span class="detail-label">Sebab Pembatalan</span><span class="detail-value detail-value-warning">${escapeHtml(booking.cancellationReason)}</span></div>` : ''}
  `;

  const hasReceipt = Boolean(booking.paymentFile || booking.payment_file);
  const paymentRequired = booking.paymentRequired !== false;
  const steps = [
    { label: 'Permohonan Dihantar', done: true, time: formatDateTime(booking.createdAt || booking.created_at) },
    ...(paymentRequired ? [{ label: 'Bayaran / Resit', done: hasReceipt, active: booking.status === 'unpaid', time: hasReceipt ? 'Resit diterima' : booking.status === 'cancelled' ? 'Tiada resit' : 'Menunggu resit bayaran' }] : []),
    { label: 'Semakan Permohonan', done: ['approved', 'rejected'].includes(booking.status), active: booking.status === 'pending', time: booking.status === 'pending' ? 'Dalam proses...' : ['approved', 'rejected'].includes(booking.status) ? 'Sudah disemak' : 'Belum bermula' },
    { label: booking.status === 'rejected' ? 'Permohonan Ditolak' : booking.status === 'cancelled' ? 'Tempahan Dibatalkan' : 'Tempahan Disahkan', done: booking.status === 'approved', active: ['rejected', 'cancelled'].includes(booking.status), time: booking.status === 'approved' ? 'Tempahan telah diluluskan' : booking.status === 'rejected' ? 'Sila hubungi pentadbir' : booking.status === 'cancelled' ? 'Dibatalkan oleh pengguna' : 'Menunggu' },
  ];
  document.getElementById('statusTimeline').innerHTML = steps.map((s) => `
    <div class="timeline-step">
      <div class="timeline-dot ${s.done ? 'done' : s.active ? 'active' : 'pending'}">${s.done ? '<i class="bi bi-check-lg"></i>' : s.active ? '<i class="bi bi-three-dots"></i>' : '<i class="bi bi-circle"></i>'}</div>
      <div class="timeline-content"><div class="timeline-label">${s.label}</div><div class="timeline-time">${s.time}</div></div>
    </div>
  `).join('');
}

function statusBookingDurationLabel(booking) {
  const dayBased = booking.durationUnit === 'day' || booking.duration_unit === 'day';
  if (dayBased) {
    const days = Math.max(1, Number.parseInt(String(booking.duration || '1'), 10) || 1);
    return { label: 'Tempoh', value: `${days} hari` };
  }
  return {
    label: 'Masa',
    value: `${escapeHtml(booking.start || '-')} - ${escapeHtml(booking.end || '-')}`,
  };
}

function renderStatusGroupCard(group, card) {
  const bookings = group.bookings || [];
  card.classList.add('show');
  setText('statusRef', group.id || group.cartGroupRef || '-');
  document.getElementById('statusBadge').innerHTML = `<div class="status-badge status-pending">${bookings.length} Tempahan</div>`;
  document.getElementById('statusDetails').innerHTML = bookings.length
    ? bookings.map((booking) => `
      <div class="status-group-booking">
        <div class="status-group-booking-head">
          <span class="booking-id">${escapeHtml(booking.id || booking.booking_ref)}</span>
          ${statusBadgeHtml(booking.status)}
        </div>
        <div class="detail-row"><span class="detail-label">Fasiliti</span><span class="detail-value detail-value-with-icon">${booking.facilityIcon || ''} ${escapeHtml(booking.facilityName)}</span></div>
        <div class="detail-row"><span class="detail-label">Tarikh</span><span class="detail-value">${formatDate(booking.date)}</span></div>
        <div class="detail-row"><span class="detail-label">${statusBookingDurationLabel(booking).label}</span><span class="detail-value">${statusBookingDurationLabel(booking).value}</span></div>
        <div class="detail-row"><span class="detail-label">Jenis Pemohon</span><span class="detail-value">${escapeHtml(booking.accountTypeLabel || (booking.accountType === 'staff' ? 'Kakitangan' : 'Orang Awam'))}</span></div>
        <div class="detail-row"><span class="detail-label">Bayaran</span><span class="detail-value">${booking.paymentRequired === false ? 'Tidak diperlukan' : 'Diperlukan'}</span></div>
        <div class="detail-row"><span class="detail-label">Nama Penuh PIC</span><span class="detail-value">${escapeHtml(booking.picFullName || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">No Telefon PIC</span><span class="detail-value">${escapeHtml(booking.picPhone || '-')}</span></div>
      </div>
    `).join('')
    : '<div class="detail-row"><span class="detail-label">Tempahan</span><span class="detail-value">Tiada rekod</span></div>';

  document.getElementById('statusTimeline').innerHTML = bookings.map((booking) => `
    <div class="timeline-step">
      <div class="timeline-dot ${booking.status === 'approved' ? 'done' : ['rejected', 'cancelled'].includes(booking.status) ? 'active' : 'pending'}">
        ${booking.status === 'approved' ? '<i class="bi bi-check-lg"></i>' : '<i class="bi bi-circle"></i>'}
      </div>
      <div class="timeline-content">
        <div class="timeline-label">${escapeHtml(booking.id || booking.booking_ref)}</div>
        <div class="timeline-time">${escapeHtml(booking.facilityName || 'Fasiliti')} - ${formatDate(booking.date)}</div>
      </div>
    </div>
  `).join('');
}
