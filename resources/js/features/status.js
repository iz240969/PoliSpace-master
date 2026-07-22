// ==================== STATUS PAGE ====================
async function checkStatus() {
  const ref = document.getElementById('statusInput')?.value.trim().toUpperCase() || '';
  const card = document.getElementById('statusResultCard');
  if (!ref || !card) return;

  try {
    const result = await tryApi(`bookings.php?action=ref&ref=${encodeURIComponent(ref)}`);
    renderStatusCard(result.data, card);
  } catch (error) {
    const booking = getBookings().find((b) => (b.id || b.booking_ref) === ref);
    if (!booking) {
      showToast('Nombor rujukan tidak dijumpai.', 'error');
      card.classList.remove('show');
      return;
    }
    renderStatusCard(booking, card);
  }
}

function renderStatusCard(booking, card) {
  card.classList.add('show');
  setText('statusRef', booking.id || booking.booking_ref);
  document.getElementById('statusBadge').innerHTML = statusBadgeHtml(booking.status);
  document.getElementById('statusDetails').innerHTML = `
    <div class="detail-row"><span class="detail-label">Nama</span><span class="detail-value">${escapeHtml(booking.name)}</span></div>
    <div class="detail-row"><span class="detail-label">Fasiliti</span><span class="detail-value" style="display:flex;align-items:center;gap:6px">${booking.facilityIcon || ''} ${escapeHtml(booking.facilityName)}</span></div>
    <div class="detail-row"><span class="detail-label">Tarikh</span><span class="detail-value">${formatDate(booking.date)}</span></div>
    <div class="detail-row"><span class="detail-label">Masa</span><span class="detail-value">${escapeHtml(booking.start)} - ${escapeHtml(booking.end || '-')}</span></div>
    <div class="detail-row"><span class="detail-label">Tujuan</span><span class="detail-value">${escapeHtml(booking.purpose)}</span></div>
    ${booking.adminNote ? `<div class="detail-row"><span class="detail-label">Nota Admin</span><span class="detail-value" style="color:var(--amber)">${escapeHtml(booking.adminNote)}</span></div>` : ''}
  `;

  const steps = [
    { label: 'Permohonan Dihantar', done: true, time: formatDateTime(booking.createdAt) },
    { label: 'Semakan Permohonan', done: booking.status !== 'pending', active: booking.status === 'pending', time: booking.status !== 'pending' ? 'Selesai' : 'Dalam proses...' },
    { label: booking.status === 'rejected' ? 'Permohonan Ditolak' : 'Tempahan Disahkan', done: booking.status === 'approved', active: booking.status === 'rejected', time: booking.status === 'approved' ? 'E-mel pengesahan dihantar' : booking.status === 'rejected' ? 'Sila hubungi pentadbir' : 'Menunggu' },
  ];
  document.getElementById('statusTimeline').innerHTML = steps.map((s) => `
    <div class="timeline-step">
      <div class="timeline-dot ${s.done ? 'done' : s.active ? 'active' : 'pending'}">${s.done ? '<i class="bi bi-check-lg"></i>' : s.active ? '<i class="bi bi-three-dots"></i>' : '<i class="bi bi-circle"></i>'}</div>
      <div class="timeline-content"><div class="timeline-label">${s.label}</div><div class="timeline-time">${s.time}</div></div>
    </div>
  `).join('');
}
