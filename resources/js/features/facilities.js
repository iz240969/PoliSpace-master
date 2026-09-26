// ==================== FACILITIES ====================
let unavailableBookingDates = new Set();
let bookingDatePickerRequestId = 0;
const publicCalendarBookingsCache = new Map();
const publicCalendarLoadErrors = new Map();
const publicCalendarPendingRequests = new Map();

function publicCalendarCacheKey(year, month, facilityId = '') {
  return `${year}-${String(month).padStart(2, '0')}:${facilityId || 'all'}`;
}

function publicCalendarRetryNotice(year, month, facilityId = '') {
  const key = publicCalendarCacheKey(year, month, facilityId);
  if (!publicCalendarLoadErrors.has(key)) return '';
  return `<div class="calendar-load-warning" role="status"><i class="bi bi-exclamation-circle" aria-hidden="true"></i><span>Kalendar mungkin belum dikemas kini.</span><button class="btn btn-secondary btn-sm calendar-retry-button" type="button"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Cuba Lagi</button></div>`;
}

function normalizeFacilities(facilities) {
  return facilities.map((f) => ({
    id: String(f.id),
    name: f.name,
    icon: f.icon || 'bi-building',
    capacity: Number(f.capacity || f.cap || 0),
    price_per_hour: Number(f.price_per_hour || f.pricePerHour || 0),
    max_rooms: Number(f.max_rooms ?? f.maxRooms ?? 0) || null,
    asrama_normal_male_limit: Number(f.asrama_normal_male_limit ?? 30),
    asrama_normal_female_limit: Number(f.asrama_normal_female_limit ?? 30),
    asrama_holiday_enabled: Boolean(Number(f.asrama_holiday_enabled ?? 0)),
    asrama_holiday_start_date: f.asrama_holiday_start_date || '',
    asrama_holiday_end_date: f.asrama_holiday_end_date || '',
    asrama_holiday_male_limit: Number(f.asrama_holiday_male_limit ?? 30),
    asrama_holiday_female_limit: Number(f.asrama_holiday_female_limit ?? 30),
    description: f.description || f.desc || '',
    pic_id: f.pic_id === null || f.pic_id === undefined || f.pic_id === '' ? null : String(f.pic_id),
    pic_full_name: f.pic_full_name || f.picFullName || '',
    pic_phone: f.pic_phone || f.picPhone || '',
    pic_email: f.pic_email || f.picEmail || '',
    equipment_options: normalizeFacilityEquipmentOptions(f.equipment_options ?? f.equipmentOptions ?? []),
    is_available: Boolean(Number(f.is_available ?? f.available ?? 1)),
  }));
}

function normalizeFacilityEquipmentOptions(value) {
  let items = [];
  if (Array.isArray(value)) {
    items = value;
  } else {
    const raw = String(value || '').trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      items = raw.split(/\r\n|\r|\n|,/);
    }
  }

  const seen = new Set();
  return items.reduce((options, item) => {
    const name = String(typeof item === 'object' ? item?.name : item || '').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return options;
    seen.add(key);
    options.push({ name, max: Number(item?.max || 0) || null });
    return options;
  }, []);
}

function facilityIconHtml(facility) {
  return `<i class="bi ${escapeAttr(facility.icon)}"></i>`;
}

function facilityCapacityLabel(facility) {
  const capacity = Number(facility.capacity || 0);
  const name = String(facility.name || '').toLowerCase();
  if (name.includes('asrama')) {
    const maleLimit = Number(facility.asrama_normal_male_limit || 0);
    const femaleLimit = Number(facility.asrama_normal_female_limit || 0);
    return `${capacity} orang / bilik - had biasa: ${maleLimit} lelaki, ${femaleLimit} perempuan`;
  }
  return `${capacity} orang`;
}

function facilityPriceLabel(facility) {
  const price = Number(facility.price_per_hour || 0).toFixed(2);
  return `RM ${price} / ${String(facility.name || '').toLowerCase().includes('asrama') ? 'bilik' : 'jam'}`;
}

function facilityCategoryLabel(facility) {
  const name = String(facility.name || '').toLowerCase();
  if (name.includes('asrama')) return 'Asrama';
  if (name.includes('makmal') || name.includes('komputer')) return 'Makmal';
  if (name.includes('dewan')) return 'Dewan';
  if (name.includes('bilik')) return 'Bilik';
  return 'Fasiliti';
}

function facilityPhotoIndex(facility) {
  const name = String(facility.name || '').toLowerCase();
  if (name.includes('asrama')) return 5;
  if (name.includes('makmal') || name.includes('komputer')) return 4;
  if (name.includes('seminar')) return 3;
  if (name.includes('persidangan')) return 2;
  if (name.includes('syarahan')) return 1;
  return 0;
}

function facilityEquipmentIcon(name) {
  const item = String(name || '').toLowerCase();
  if (item.includes('mikrofon')) return 'bi-mic';
  if (item.includes('projektor')) return 'bi-projector';
  if (item.includes('pa system')) return 'bi-speaker';
  if (item.includes('tv') || item.includes('lcd')) return 'bi-display';
  if (item.includes('komputer')) return 'bi-pc-display';
  if (item.includes('papan')) return 'bi-easel';
  if (item.includes('meja')) return 'bi-layout-text-window';
  if (item.includes('kerusi')) return 'bi-grid-3x3';
  return 'bi-check2';
}

function isBlockingBookingStatus(status) {
  return ['pending', 'approved'].includes(status);
}

function bookingTimeToMinutes(time) {
  const value = String(time || '');
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const parts = value.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function getMinimumBookingDateValue() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function renderFacilities() {
  const grid = document.getElementById('facilitiesGrid');
  if (!grid) return;

  if (!grid.querySelector('.facility-card')) {
    grid.setAttribute('aria-busy', 'true');
    const placeholders = Array.from({ length: 6 }, () => '<article class="facility-card-skeleton" aria-hidden="true"><span class="facility-card-skeleton-photo skeleton"></span><div class="facility-card-skeleton-body"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div></article>').join('');
    grid.innerHTML = `<span class="sr-only" role="status" aria-live="polite">Memuatkan fasiliti...</span>${placeholders}`;
  }
  else grid.setAttribute('aria-busy', 'true');
  const facilities = await loadFacilities();
  const cardsHtml = facilities.map((f) => {
    const equipment = f.equipment_options;
    const isAsrama = String(f.name || '').toLowerCase().includes('asrama');
    return `
    <article class="facility-card" role="button" tabindex="0" data-facility-id="${escapeAttr(f.id)}" aria-label="Lihat butiran ${escapeAttr(f.name)}">
      <div class="facility-photo facility-photo--${facilityPhotoIndex(f)}">
        <div class="facility-photo-top">
          <span class="facility-category">
            <span class="facility-category-icon" aria-hidden="true">${facilityIconHtml(f)}</span>
            <span>${escapeHtml(facilityCategoryLabel(f))}</span>
          </span>
          <span class="facility-arrow" aria-hidden="true"><i class="bi bi-arrow-up-right"></i></span>
        </div>
        <span class="facility-availability ${f.is_available ? '' : 'is-unavailable'}"><i class="bi ${f.is_available ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}" aria-hidden="true"></i>${f.is_available ? 'Tersedia' : 'Tidak Tersedia'}</span>
      </div>
      <div class="facility-body">
        <h3 class="facility-name">${escapeHtml(f.name)}</h3>
        <p class="facility-desc">${escapeHtml(f.description)}</p>
        ${equipment.length ? `<div class="facility-equipment" aria-label="Peralatan">${equipment.map((item) => `<span class="facility-equipment-item"><span class="facility-equipment-icon"><i class="bi ${facilityEquipmentIcon(item.name)}" aria-hidden="true"></i></span><span>${escapeHtml(item.name)}</span></span>`).join('')}</div>` : ''}
        ${isAsrama || !equipment.length ? '<div class="facility-equipment-note"><i class="bi bi-info-circle" aria-hidden="true"></i><span>Keperluan boleh dipilih semasa tempahan</span></div>' : ''}
        <div class="facility-meta">
          <div class="facility-facts">
            <div class="facility-cap"><i class="bi bi-people" aria-hidden="true"></i><span>${escapeHtml(isAsrama ? `${Number(f.capacity || 0)} orang / bilik` : facilityCapacityLabel(f))}</span></div>
            ${isAsrama ? `<p class="facility-quota">Had biasa: ${Number(f.asrama_normal_male_limit || 0)} lelaki, ${Number(f.asrama_normal_female_limit || 0)} perempuan</p>` : ''}
            <div class="facility-price"><i class="bi bi-coin" aria-hidden="true"></i><span>${escapeHtml(facilityPriceLabel(f))}</span></div>
          </div>
          <span class="facility-details-link" aria-hidden="true">Lihat Butiran <i class="bi bi-arrow-right"></i></span>
        </div>
      </div>
    </article>
  `;
  }).join('');
  const retryNotice = facilitiesLoadError
    ? `<div class="facilities-load-warning" role="status"><i class="bi bi-exclamation-circle" aria-hidden="true"></i><span>Senarai fasiliti mungkin belum dikemas kini.</span><button class="btn btn-secondary btn-sm" id="retryFacilitiesButton" type="button"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Cuba Lagi</button></div>`
    : '';
  const emptyNotice = !facilities.length && !facilitiesLoadError
    ? '<div class="feedback-state"><span class="feedback-state-icon" aria-hidden="true"><i class="bi bi-building"></i></span><strong>Tiada fasiliti tersedia</strong><span>Sila semak semula kemudian.</span></div>'
    : '';
  grid.innerHTML = `${retryNotice}${emptyNotice}${cardsHtml}`;
  grid.removeAttribute('aria-busy');
  grid.querySelector('#retryFacilitiesButton')?.addEventListener('click', () => renderFacilities());

  grid.querySelectorAll('[data-facility-id]').forEach((card) => {
    const openFacility = () => selectFacilityAndBook(card.dataset.facilityId);
    card.addEventListener('click', openFacility);
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openFacility();
    });
  });

  setText('stat-facilities', facilities.filter((f) => f.is_available).length);
  try {
    const stats = await tryApi('bookings.php?action=public-stats');
    setText('stat-bookings', stats.data.today);
  } catch (error) {
    const today = formatLocalDateValue();
    setText('stat-bookings', getBookings().filter((b) => b.date === today && isBlockingBookingStatus(b.status)).length);
  }
}

function selectFacilityAndBook(fid) {
  const facility = facilitiesCache.find((item) => String(item.id) === String(fid));
  if (facility && !facility.is_available) {
    showToast('Fasiliti ini tidak tersedia untuk tempahan.', 'error');
    return;
  }
  localStorage.setItem('ps_selected_facility', fid);
  navigateToClientPage(ROUTES.booking);
}

async function loadPublicCalendarBookings(year, month, facilityId = '') {
  const cacheKey = publicCalendarCacheKey(year, month, facilityId);
  if (publicCalendarPendingRequests.has(cacheKey)) return publicCalendarPendingRequests.get(cacheKey);
  const request = (async () => {
    try {
      const facilityQuery = facilityId ? `&facility_id=${encodeURIComponent(facilityId)}` : '';
      const result = await apiRequest(`bookings.php?action=calendar&year=${year}&month=${month}${facilityQuery}`);
      const bookings = result.data || [];
      publicCalendarBookingsCache.set(cacheKey, bookings);
      publicCalendarLoadErrors.delete(cacheKey);
      return bookings;
    } catch (error) {
      publicCalendarLoadErrors.set(cacheKey, error);
      if (publicCalendarBookingsCache.has(cacheKey)) return publicCalendarBookingsCache.get(cacheKey);
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
      return getBookings()
        .filter((b) => (b.date || '').startsWith(monthPrefix))
        .filter((b) => isBlockingBookingStatus(b.status))
        .filter((b) => !facilityId || String(b.facilityId || b.facility_id) === String(facilityId))
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
  })();
  publicCalendarPendingRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (publicCalendarPendingRequests.get(cacheKey) === request) publicCalendarPendingRequests.delete(cacheKey);
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
  if (!list.dataset.loaded) showLoadingState(list, 'Memuatkan kalendar...', 2);
  else list.setAttribute('aria-busy', 'true');
  const bookings = await loadPublicCalendarBookings(year, displayMonth);
  list.removeAttribute('aria-busy');
  list.dataset.loaded = 'true';
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
    const availableFacilityIds = new Set(facilitiesCache.filter((facility) => facility.is_available).map((facility) => String(facility.id)));
    const bookedFacilityCount = new Set(dayBookings
      .filter((booking) => !booking.capacityManaged)
      .map((booking) => String(booking.facilityId || ''))
      .filter((facilityId) => availableFacilityIds.has(facilityId))).size;
    const availableFacilityCount = availableFacilityIds.size;
    const isFullyBooked = availableFacilityCount > 0 && bookedFacilityCount >= availableFacilityCount;
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

  const retryNotice = publicCalendarRetryNotice(year, displayMonth);
  if (!visibleBookings.length) {
    list.innerHTML = retryNotice || '<div class="landing-calendar-empty">Tiada tempahan untuk bulan ini.</div>';
    list.querySelector('.calendar-retry-button')?.addEventListener('click', () => renderLandingCalendar());
    return;
  }

  list.innerHTML = `${retryNotice}${visibleBookings.map((booking) => `
    <div class="landing-calendar-event">
      <div>${booking.facilityIcon || '<i class="bi bi-building"></i>'}</div>
      <div>
        <div class="landing-calendar-event-title">${escapeHtml(booking.facilityName)}</div>
        <div class="landing-calendar-event-meta">${formatDate(booking.date)} - ${escapeHtml(booking.start)}${booking.end ? ` - ${escapeHtml(booking.end)}` : ''}</div>
      </div>
      ${statusBadgeHtml(booking.status)}
    </div>
  `).join('')}`;
  list.querySelector('.calendar-retry-button')?.addEventListener('click', () => renderLandingCalendar());
}

async function renderPublicCalendarView() {
  const calendar = document.getElementById('calendarView');
  if (!calendar || document.getElementById('admin')) return;

  const year = bookingCalendarDate.getFullYear();
  const month = bookingCalendarDate.getMonth() + 1;
  if (!calendar.dataset.loaded) showLoadingState(calendar, 'Memuatkan kalendar...', 3);
  else calendar.setAttribute('aria-busy', 'true');
  const bookings = await loadPublicCalendarBookings(year, month);
  calendar.removeAttribute('aria-busy');
  calendar.dataset.loaded = 'true';
  renderCalendar(bookings, bookingCalendarDate);
  const retryNotice = publicCalendarRetryNotice(year, month);
  if (retryNotice) {
    calendar.insertAdjacentHTML('afterbegin', retryNotice);
    calendar.querySelector('.calendar-retry-button')?.addEventListener('click', () => renderPublicCalendarView());
  }
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

  if (adminDashboardLoaded) renderCalendar(adminBookingsCache, bookingCalendarDate);
  let bookings = [];
  try {
    const result = await tryApi('bookings.php');
    bookings = result.data || [];
  } catch (error) {
    bookings = adminDashboardLoaded ? adminBookingsCache : getBookings();
    if (adminDashboardLoaded) showToast(error.message || 'Kalendar tidak dapat dikemas kini. Data sebelumnya masih dipaparkan.', 'error');
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
      <button type="button" class="facility-select-item ${!f.is_available ? 'is-disabled' : ''}" data-fid="${escapeAttr(f.id)}" ${f.is_available ? `onclick="sidebarSelectFacility('${escapeAttr(f.id)}')"` : 'disabled aria-disabled="true"'}>
        <span>
          <span class="fsi-name">${facilityIconHtml(f)} ${escapeHtml(f.name)}</span>
          <span class="fsi-cap">${isAsramaRoomFacility(f) ? `${f.capacity} orang setiap bilik, had ikut tarikh` : `Maks. ${f.capacity} orang`} - RM${f.price_per_hour}</span>
        </span>
        <span class="${f.is_available ? 'status-badge status-available' : 'status-badge status-booked'}" style="font-size:10px">
          ${f.is_available ? '<i class="bi bi-check-lg"></i>' : '<i class="bi bi-x-lg"></i>'}
        </span>
      </button>
    `).join('');
    if (facilitiesLoadError) {
      list.insertAdjacentHTML('afterbegin', '<div class="facilities-load-warning" role="status"><i class="bi bi-exclamation-circle" aria-hidden="true"></i><span>Senarai fasiliti mungkin belum dikemas kini.</span><button class="btn btn-secondary btn-sm" id="retryBookingFacilitiesButton" type="button"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Cuba Lagi</button></div>');
      list.querySelector('#retryBookingFacilitiesButton')?.addEventListener('click', () => populateBookingFacilities());
    }
  }

  const selected = localStorage.getItem('ps_selected_facility');
  if (selected) {
    const selectedFacility = facilities.find((facility) => String(facility.id) === String(selected));
    if (selectedFacility?.is_available) select.value = selected;
    localStorage.removeItem('ps_selected_facility');
  }
  updateFacilityInfo();
}

function sidebarSelectFacility(fid) {
  document.getElementById('f-facility').value = fid;
  updateFacilityInfo();
}

function syncBookingDurationUnitForFacility() {
  const facility = getSelectedFacility();
  const hourButton = document.getElementById('durationUnitHour');
  const input = document.getElementById('f-duration');
  if (!input) return;

  const dayOnly = isAsramaRoomFacility(facility);
  if (hourButton) hourButton.disabled = dayOnly;
  if (dayOnly && selectedDurationUnit() !== 'day') {
    applyDurationUnitState('f-duration', 'day');
  } else {
    applyDurationUnitState('f-duration', selectedDurationUnit());
  }
}

function syncAsramaBookingFields() {
  const facility = getSelectedFacility();
  const asramaSelected = isAsramaRoomFacility(facility);
  document.querySelectorAll('[data-asrama-optional-field]').forEach((field) => {
    field.classList.toggle('is-hidden-for-asrama', asramaSelected);
    field.querySelectorAll('input, select, textarea, button').forEach((control) => {
      control.disabled = asramaSelected;
    });
  });
  document.querySelectorAll('[data-asrama-field]').forEach((field) => {
    field.classList.toggle('is-hidden-for-asrama', !asramaSelected);
    field.querySelectorAll('input, select, textarea, button').forEach((control) => {
      control.disabled = !asramaSelected;
    });
  });

  if (!asramaSelected) return;
  const startEl = document.getElementById('f-start');
  const endEl = document.getElementById('f-end');
  const equipmentEl = document.getElementById('f-equipment');
  const participantsEl = document.getElementById('f-participants');
  if (startEl) startEl.value = '';
  if (endEl) endEl.value = '';
  if (equipmentEl) equipmentEl.value = '';
  if (participantsEl) participantsEl.value = '1';
  const roomCountEl = document.getElementById('f-room-count');
  if (roomCountEl) {
    const limits = asramaConfiguredLimitsForDates(
      facility,
      document.getElementById('f-date')?.value || '',
      document.getElementById('f-duration')?.value || '1'
    );
    const maxRooms = Math.max(1, limits.male + limits.female);
    roomCountEl.value = String(Math.min(Math.max(1, Number(roomCountEl.value || 1)), maxRooms));
  }
  normalizeRoomCount();
  renderEquipmentList();
}

function updateFacilityInfo() {
  const fid = document.getElementById('f-facility')?.value || '';
  document.querySelectorAll('.facility-select-item').forEach((el) => {
    el.classList.toggle('selected', el.dataset.fid === fid);
  });
  renderSelectedFacilityPic();
  syncBookingDurationUnitForFacility();
  syncAsramaBookingFields();
  initializeEquipmentField(document.getElementById('f-equipment')?.value || '', 'f-equipment', 'equipmentAddSelect', 'equipmentList', fid);
  updateSetupOptions();
  updatePricing();
  renderBookingDatePicker();
}

function renderSelectedFacilityPic() {
  const container = document.getElementById('facilityPicInfo');
  if (!container) return;

  const facility = getSelectedFacility();
  if (!facility) {
    container.classList.remove('show');
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="facility-pic-heading">
      <i class="bi bi-person-badge"></i>
      <span class="facility-pic-label">PIC</span>
      <span class="facility-pic-name">${escapeHtml(facility.pic_full_name || '-')}</span>
    </div>
    <div class="facility-pic-contact">
      <i class="bi bi-telephone"></i>
      <span class="facility-pic-phone">${escapeHtml(facility.pic_phone || '-')}</span>
    </div>
  `;
  container.classList.add('show');
}

function getSelectedFacility() {
  const fid = document.getElementById('f-facility')?.value || '';
  return facilitiesCache.find((f) => String(f.id) === String(fid));
}

function updateSetupOptions() {
  return;
}

function calculateCost() {
  const facility = getSelectedFacility();
  const base = facility ? facility.price_per_hour : 0;
  const duration = Number(document.getElementById('f-duration')?.value || 1);
  const multiplier = Number.isFinite(duration) && duration > 0 ? duration : 1;
  const roomMultiplier = isAsramaRoomFacility(facility)
    ? Math.max(1, Number(document.getElementById('f-room-count')?.value || 1))
    : 1;
  const extra = 0;
  return { base, extra, total: (base * multiplier * roomMultiplier) + extra };
}

function updatePricing() {
  const pricing = document.getElementById('pricingBreakdown');
  if (!pricing) return;
  const cost = calculateCost();
  const pricingTitle = document.getElementById('pricingTitle');
  if (typeof isVerifiedStaffUser === 'function' && isVerifiedStaffUser()) {
    if (pricingTitle) pricingTitle.textContent = 'Bayaran';
    pricing.innerHTML = `
      <div class="pricing-minimal"><span><i class="bi bi-check-circle"></i></span><strong>Tidak Diperlukan</strong></div>
      <p class="pricing-note">Akaun kakitangan anda telah disahkan.</p>
    `;
    return;
  }
  if (pricingTitle) pricingTitle.textContent = 'Anggaran Kos';
  pricing.innerHTML = `
    <div class="pricing-minimal">
      <span>RM</span>
      <strong>${cost.total}</strong>
    </div>
    <p class="pricing-note">Nota: Sewaan dicaj mengikut ${selectedDurationUnit() === 'day' ? 'hari' : 'jam'}.</p>
  `;
}

async function renderBookingDatePicker() {
  const picker = document.getElementById('bookingDatePicker');
  if (!picker) return;

  const requestId = ++bookingDatePickerRequestId;

  const year = bookingDatePickerDate.getFullYear();
  const month = bookingDatePickerDate.getMonth();
  const displayMonth = month + 1;
  const monthNames = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  const dateInput = document.getElementById('f-date');
  let selectedDate = dateInput?.value || '';
  const selectedFacilityId = document.getElementById('f-facility')?.value || '';
  const bookings = selectedFacilityId
    ? await loadPublicCalendarBookings(year, displayMonth, selectedFacilityId)
    : [];
  if (requestId !== bookingDatePickerRequestId) return;
  const selectedFacility = getSelectedFacility();
  const bookedDates = isAsramaRoomFacility(selectedFacility)
    ? new Set()
    : new Set(bookings.map((booking) => booking.date));
  unavailableBookingDates = bookedDates;

  if (selectedDate && bookedDates.has(selectedDate)) {
    if (dateInput) dateInput.value = '';
    selectedDate = '';
    showToast('Tarikh ini telah dikunci oleh tempahan berbayar. Sila pilih tarikh lain.', 'error');
  }

  const minimumDate = getMinimumBookingDateValue();
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
    const isTooSoon = date < minimumDate;
    const isBooked = bookedDates.has(date);
    const isSelected = selectedDate === date;
    const classes = [
      'booking-date-picker-day',
      isTooSoon ? 'is-disabled' : '',
      isBooked ? 'is-booked' : 'is-available',
      isSelected ? 'is-selected' : '',
    ].filter(Boolean).join(' ');
    const disabled = isTooSoon || isBooked;
    const unavailableLabel = isBooked ? 'Telah ditempah' : isTooSoon ? 'Perlu ditempah 3 hari lebih awal' : 'Tersedia';
    html += `<button type="button" class="${classes}" ${disabled ? 'disabled' : ''} title="${unavailableLabel}" aria-label="${day} ${monthNames[month]} - ${unavailableLabel}" onclick="selectBookingDate('${date}')">${day}</button>`;
  }

  const calendarNotice = selectedFacilityId ? publicCalendarRetryNotice(year, displayMonth, selectedFacilityId) : '';
  picker.innerHTML = `${calendarNotice}${html}</div><div class="booking-date-picker-legend"><span><i class="available"></i> Tersedia</span><span><i class="booked"></i> Telah ditempah</span></div>`;
  picker.querySelector('.calendar-retry-button')?.addEventListener('click', () => renderBookingDatePicker());
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
  if (unavailableBookingDates.has(date)) {
    showToast('Tarikh ini telah dikunci oleh tempahan berbayar. Sila pilih tarikh lain.', 'error');
    return;
  }
  if (date < getMinimumBookingDateValue()) {
    showToast('Tempahan mesti dibuat sekurang-kurangnya 3 hari lebih awal.', 'error');
    return;
  }
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
