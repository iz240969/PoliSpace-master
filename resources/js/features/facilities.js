// ==================== FACILITIES ====================
function normalizeFacilities(facilities) {
  return facilities.map((f) => ({
    id: String(f.id),
    name: f.name,
    icon: f.icon || 'bi-building',
    capacity: Number(f.capacity || f.cap || 0),
    price_per_hour: Number(f.price_per_hour || f.pricePerHour || 0),
    description: f.description || f.desc || '',
    is_available: Boolean(Number(f.is_available ?? f.available ?? 1)),
  }));
}

function facilityIconHtml(facility) {
  return `<i class="bi ${escapeAttr(facility.icon)}"></i>`;
}

function facilityCapacityLabel(facility) {
  const capacity = Number(facility.capacity || 0);
  const name = String(facility.name || '').toLowerCase();
  if (name.includes('asrama')) return `${capacity} orang - 1 bilik`;
  return `${capacity} orang`;
}

function isBlockingBookingStatus(status) {
  return ['pending', 'approved'].includes(status);
}

function bookingTimeToMinutes(time) {
  const parts = String(time || '').split(':').map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

function bookingEndToMinutes(start, end, duration = '1') {
  const endMinutes = bookingTimeToMinutes(end);
  if (endMinutes !== null) return endMinutes;

  const startMinutes = bookingTimeToMinutes(start);
  if (startMinutes === null) return null;

  const durationMap = { '1': 60, '2': 120, '3': 180, '4': 240, halfday: 240, fullday: 480 };
  return startMinutes + (durationMap[duration] || 60);
}

function bookingsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function hasLocalBlockingConflict(data, excludeId = '') {
  const requestedStart = bookingTimeToMinutes(data.start_time || data.start);
  const requestedEnd = bookingEndToMinutes(data.start_time || data.start, data.end_time || data.end, data.duration);
  if (requestedStart === null || requestedEnd === null || requestedEnd <= requestedStart) return false;

  return getBookings().some((booking) => {
    const bookingId = booking.id || booking.booking_ref || '';
    if (excludeId && String(bookingId) === String(excludeId)) return false;
    if (!isBlockingBookingStatus(booking.status)) return false;
    if (String(booking.facilityId || booking.facility_id) !== String(data.facility_id || data.facilityId)) return false;
    if (String(booking.date || booking.booking_date) !== String(data.booking_date || data.date)) return false;

    const existingStart = bookingTimeToMinutes(booking.start || booking.start_time);
    const existingEnd = bookingEndToMinutes(booking.start || booking.start_time, booking.end || booking.end_time, booking.duration);
    if (existingStart === null || existingEnd === null || existingEnd <= existingStart) return false;

    return bookingsOverlap(requestedStart, requestedEnd, existingStart, existingEnd);
  });
}

async function renderFacilities() {
  const grid = document.getElementById('facilitiesGrid');
  if (!grid) return;

  const facilities = await loadFacilities();
  grid.innerHTML = facilities.map((f) => `
    <div class="facility-card" onclick="selectFacilityAndBook('${escapeAttr(f.id)}')">
      <div class="facility-card-accent"></div>
      <div class="facility-arrow"><i class="bi bi-arrow-up-right"></i></div>
      <div class="facility-icon">${facilityIconHtml(f)}</div>
      <div class="facility-name">${escapeHtml(f.name)}</div>
      <div class="facility-desc">${escapeHtml(f.description)}</div>
      <div class="facility-meta">
        <div class="facility-cap">Kapasiti: <span>${escapeHtml(facilityCapacityLabel(f))}</span></div>
        <div class="${f.is_available ? 'status-badge status-available' : 'status-badge status-booked'}">
          ${f.is_available ? '<i class="bi bi-check-circle"></i> Tersedia' : '<i class="bi bi-x-circle"></i> Ditempah'}
        </div>
      </div>
    </div>
  `).join('');

  setText('stat-facilities', facilities.filter((f) => f.is_available).length);
  try {
    const stats = await tryApi('bookings.php?action=public-stats');
    setText('stat-bookings', stats.data.today);
  } catch (error) {
    const today = new Date().toISOString().split('T')[0];
    setText('stat-bookings', getBookings().filter((b) => b.date === today).length);
  }
}

function selectFacilityAndBook(fid) {
  localStorage.setItem('ps_selected_facility', fid);
  window.location.href = ROUTES.booking;
}

async function loadPublicCalendarBookings(year, month) {
  try {
    const result = await apiRequest(`bookings.php?action=calendar&year=${year}&month=${month}`);
    return result.data || [];
  } catch (error) {
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    return getBookings()
      .filter((b) => (b.date || '').startsWith(monthPrefix))
      .filter((b) => isBlockingBookingStatus(b.status))
      .map((b) => ({
        id: b.id || b.booking_ref,
        facilityId: b.facilityId || b.facility_id || '',
        date: b.date,
        start: b.start,
        end: b.end,
        status: b.status,
        facilityName: b.facilityName || 'Fasiliti',
        facilityIcon: b.facilityIcon || '<i class="bi bi-building"></i>',
      }));
  }
}

async function renderLandingCalendar() {
  const calendar = document.getElementById('landingCalendar');
  const title = document.getElementById('landingCalendarTitle');
  const list = document.getElementById('landingCalendarList');
  if (!calendar || !title || !list) return;

  const year = landingCalendarDate.getFullYear();
  const month = landingCalendarDate.getMonth();
  const displayMonth = month + 1;
  const monthNames = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  const weekdays = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'];
  const bookings = await loadPublicCalendarBookings(year, displayMonth);
  const bookingsByDate = bookings.reduce((groups, booking) => {
    if (!groups[booking.date]) groups[booking.date] = [];
    groups[booking.date].push(booking);
    return groups;
  }, {});

  title.textContent = `${monthNames[month]} ${year}`;
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  let html = weekdays.map((day) => `<div class="landing-calendar-weekday">${day}</div>`).join('');

  for (let i = 0; i < firstDay; i += 1) {
    html += '<div class="landing-calendar-blank"></div>';
  }

  for (let day = 1; day <= days; day += 1) {
    const date = `${year}-${String(displayMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayBookings = bookingsByDate[date] || [];
    const bookedFacilityCount = new Set(dayBookings.map((booking) => String(booking.facilityId || '')).filter(Boolean)).size;
    const availableFacilityCount = facilitiesCache.filter((facility) => facility.is_available).length || facilitiesCache.length || 4;
    const isFullyBooked = bookedFacilityCount >= availableFacilityCount;
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    const markers = dayBookings.slice(0, 4).map((booking) =>
      `<span class="landing-calendar-marker ${escapeAttr(booking.status)}"></span>`
    ).join('');
    const fullMarker = isFullyBooked ? '<span class="landing-calendar-marker full"></span>' : '';
    const calendarDayClass = `landing-calendar-day${isToday ? ' today' : ''}${dayBookings.length ? ' has-booking' : ''}${isFullyBooked ? ' fully-booked' : ''}`;
    html += `
      <div class="${calendarDayClass}" title="${isFullyBooked ? 'Penuh' : dayBookings.length ? `${dayBookings.length} tempahan` : ''}">
        <div class="landing-calendar-date">${day}</div>
        <div class="landing-calendar-markers">${isFullyBooked ? fullMarker : markers}</div>
      </div>
    `;
  }

  calendar.innerHTML = html;
  const visibleBookings = bookings
    .slice()
    .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`))
    .slice(0, 4);

  if (!visibleBookings.length) {
    list.innerHTML = '<div class="landing-calendar-empty">Tiada tempahan untuk bulan ini.</div>';
    return;
  }

  list.innerHTML = visibleBookings.map((booking) => `
    <div class="landing-calendar-event">
      <div>${booking.facilityIcon || '<i class="bi bi-building"></i>'}</div>
      <div>
        <div class="landing-calendar-event-title">${escapeHtml(booking.facilityName)}</div>
        <div class="landing-calendar-event-meta">${formatDate(booking.date)} - ${escapeHtml(booking.start)}${booking.end ? ` - ${escapeHtml(booking.end)}` : ''}</div>
      </div>
      ${statusBadgeHtml(booking.status)}
    </div>
  `).join('');
}

async function renderPublicCalendarView() {
  const calendar = document.getElementById('calendarView');
  if (!calendar || document.getElementById('admin')) return;

  const year = bookingCalendarDate.getFullYear();
  const month = bookingCalendarDate.getMonth() + 1;
  let bookings = [];
  try {
    bookings = await loadPublicCalendarBookings(year, month);
  } catch (error) {
    bookings = getBookings();
  }
  renderCalendar(bookings, bookingCalendarDate);
}

function changeLandingCalendarMonth(delta) {
  landingCalendarDate = new Date(landingCalendarDate.getFullYear(), landingCalendarDate.getMonth() + delta, 1);
  renderLandingCalendar();
}

async function refreshBookingCalendar() {
  const calendar = document.getElementById('calendarView');
  if (!calendar) return;

  if (!document.getElementById('admin')) {
    await renderPublicCalendarView();
    return;
  }

  let bookings = [];
  try {
    const result = await tryApi('bookings.php');
    bookings = result.data || [];
  } catch (error) {
    bookings = getBookings();
  }
  renderCalendar(bookings, bookingCalendarDate);
}

function changeBookingCalendarMonth(delta) {
  bookingCalendarDate = new Date(bookingCalendarDate.getFullYear(), bookingCalendarDate.getMonth() + delta, 1);
  refreshBookingCalendar();
}

function resetBookingCalendarMonth() {
  const now = new Date();
  bookingCalendarDate = new Date(now.getFullYear(), now.getMonth(), 1);
  refreshBookingCalendar();
}

async function populateBookingFacilities() {
  const select = document.getElementById('f-facility');
  if (!select) return;

  const facilities = await loadFacilities();
  select.innerHTML = '<option value="">-- Pilih Fasiliti --</option>' + facilities.map((f) =>
    `<option value="${escapeAttr(f.id)}" ${!f.is_available ? 'disabled' : ''}>${escapeHtml(f.name)}${!f.is_available ? ' (Tidak Tersedia)' : ''}</option>`
  ).join('');

  const list = document.getElementById('facilitySelectorList');
  if (list) {
    list.innerHTML = facilities.map((f) => `
      <div class="facility-select-item" data-fid="${escapeAttr(f.id)}" onclick="sidebarSelectFacility('${escapeAttr(f.id)}')">
        <div>
          <div class="fsi-name">${facilityIconHtml(f)} ${escapeHtml(f.name)}</div>
          <div class="fsi-cap">Maks. ${f.capacity} orang - RM${f.price_per_hour}</div>
        </div>
        <div class="${f.is_available ? 'status-badge status-available' : 'status-badge status-booked'}" style="font-size:10px">
          ${f.is_available ? '<i class="bi bi-check-lg"></i>' : '<i class="bi bi-x-lg"></i>'}
        </div>
      </div>
    `).join('');
  }

  const selected = localStorage.getItem('ps_selected_facility');
  if (selected) {
    select.value = selected;
    localStorage.removeItem('ps_selected_facility');
  }
  updateFacilityInfo();
}

function sidebarSelectFacility(fid) {
  document.getElementById('f-facility').value = fid;
  updateFacilityInfo();
}

function updateFacilityInfo() {
  const fid = document.getElementById('f-facility')?.value || '';
  document.querySelectorAll('.facility-select-item').forEach((el) => {
    el.classList.toggle('selected', el.dataset.fid === fid);
  });
  updateSetupOptions();
  updatePricing();
  renderBookingDatePicker();
}

function getSelectedFacility() {
  const fid = document.getElementById('f-facility')?.value || '';
  return facilitiesCache.find((f) => f.id === fid);
}

function updateSetupOptions() {
  return;
}

function calculateCost() {
  const facility = getSelectedFacility();
  const base = facility ? facility.price_per_hour : 0;
  const extra = 0;
  return { base, extra, total: base + extra };
}

function updatePricing() {
  const pricing = document.getElementById('pricingBreakdown');
  if (!pricing) return;
  const cost = calculateCost();
  pricing.innerHTML = `
    <div class="pricing-minimal">
      <span>RM</span>
      <strong>${cost.total}</strong>
    </div>
    <p class="pricing-note">Nota: Sewaan dicaj mengikut hari.</p>
  `;
}

async function renderBookingDatePicker() {
  const picker = document.getElementById('bookingDatePicker');
  if (!picker) return;

  const year = bookingDatePickerDate.getFullYear();
  const month = bookingDatePickerDate.getMonth();
  const displayMonth = month + 1;
  const monthNames = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  const selectedDate = document.getElementById('f-date')?.value || '';
  const selectedFacilityId = document.getElementById('f-facility')?.value || '';
  const bookings = await loadPublicCalendarBookings(year, displayMonth);
    const bookedDates = new Set(
    bookings
      .filter((booking) => selectedFacilityId && String(booking.facilityId) === String(selectedFacilityId))
      .map((booking) => booking.date)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  let html = `
    <div class="booking-date-picker-head">
      <button type="button" onclick="changeBookingDatePickerMonth(-1)" aria-label="Bulan sebelum"><i class="bi bi-chevron-left"></i></button>
      <strong>${monthNames[month]} ${year}</strong>
      <button type="button" onclick="changeBookingDatePickerMonth(1)" aria-label="Bulan seterusnya"><i class="bi bi-chevron-right"></i></button>
    </div>
    <div class="booking-date-picker-weekdays">
      ${['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'].map((day) => `<span>${day}</span>`).join('')}
    </div>
    <div class="booking-date-picker-grid">
  `;

  for (let i = 0; i < firstDay; i += 1) {
    html += '<span class="booking-date-picker-blank"></span>';
  }

  for (let day = 1; day <= days; day += 1) {
    const date = `${year}-${String(displayMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(year, month, day);
    const isPast = dateObj < today;
    const isBooked = bookedDates.has(date);
    const isSelected = selectedDate === date;
    const classes = [
      'booking-date-picker-day',
      isPast ? 'is-disabled' : '',
      isBooked ? 'is-booked' : 'is-available',
      isSelected ? 'is-selected' : '',
    ].filter(Boolean).join(' ');
    const disabled = isPast;
    html += `<button type="button" class="${classes}" ${disabled ? 'disabled' : ''} onclick="selectBookingDate('${date}')">${day}</button>`;
  }

  picker.innerHTML = `${html}</div><div class="booking-date-picker-legend"><span><i class="available"></i> Tersedia</span><span><i class="booked"></i> Telah ditempah</span></div>`;
}

function toggleBookingDatePicker() {
  const picker = document.getElementById('bookingDatePicker');
  const toggle = document.querySelector('.booking-date-toggle');
  if (!picker) return;

  const isOpen = picker.classList.toggle('is-open');
  toggle?.classList.toggle('is-active', isOpen);
  toggle?.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) renderBookingDatePicker();
}

function changeBookingDatePickerMonth(delta) {
  bookingDatePickerDate = new Date(bookingDatePickerDate.getFullYear(), bookingDatePickerDate.getMonth() + delta, 1);
  renderBookingDatePicker();
}

function selectBookingDate(date) {
  const input = document.getElementById('f-date');
  if (!input) return;
  input.value = date;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  document.getElementById('bookingDatePicker')?.classList.remove('is-open');
  document.querySelector('.booking-date-toggle')?.classList.remove('is-active');
  document.querySelector('.booking-date-toggle')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (event) => {
  const picker = document.getElementById('bookingDatePicker');
  const toggle = document.querySelector('.booking-date-toggle');
  if (!picker?.classList.contains('is-open')) return;
  if (picker.contains(event.target) || toggle?.contains(event.target)) return;

  picker.classList.remove('is-open');
  toggle?.classList.remove('is-active');
  toggle?.setAttribute('aria-expanded', 'false');
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  document.getElementById('bookingDatePicker')?.classList.remove('is-open');
  document.querySelector('.booking-date-toggle')?.classList.remove('is-active');
  document.querySelector('.booking-date-toggle')?.setAttribute('aria-expanded', 'false');
});
