// ==================== BOOKING FORM ====================
const BOOKING_CART_STORAGE_PREFIX = 'ps_booking_cart:';
const DURATION_UNITS = {
  hour: { label: 'Jam', min: 1, max: 24 },
  day: { label: 'Hari', min: 1, max: 30 },
};
let bookingCartEditingId = null;
let bookingSubmissionInProgress = false;

function selectedDurationUnit(inputId = 'f-duration') {
  const input = document.getElementById(inputId);
  return input?.dataset.durationUnit === 'day' ? 'day' : 'hour';
}

function isAsramaRoomFacility(facility) {
  const name = String(facility?.name || facility?.facility_name || '').toLowerCase();
  return name.includes('asrama') && name.includes('bilik');
}

function setMinDate() {
  const el = document.getElementById('f-date');
  if (el) el.min = getMinimumBookingDateValue();
}

function updateEndTime() {
  const start = document.getElementById('f-start')?.value;
  const duration = document.getElementById('f-duration')?.value || '1';
  const unit = selectedDurationUnit();
  const endInput = document.getElementById('f-end');
  if (unit === 'day') {
    if (endInput) endInput.value = '';
    return;
  }
  if (!start) return;
  const [hours, mins] = start.split(':').map(Number);
  const total = hours * 60 + mins + durationToMinutes(duration, unit);
  if (!endInput) return;
  endInput.value = total >= 24 * 60
    ? ''
    : `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function durationToMinutes(duration = '1', unit = 'hour') {
  const durationMap = { halfday: 240, fullday: 480 };
  if (durationMap[duration]) return durationMap[duration];

  const amount = Number.parseFloat(String(duration).replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return unit === 'day' ? 24 * 60 : 60;
  return Math.round(amount * (unit === 'day' ? 24 * 60 : 60));
}

function durationInputValue(duration = '1', unit = 'hour') {
  const minutes = durationToMinutes(duration, unit);
  return String(Math.max(1, Math.ceil(minutes / (unit === 'day' ? 24 * 60 : 60))));
}

function formatDurationValue(value) {
  return String(Math.max(1, Math.ceil(value)));
}

function applyDurationUnitState(inputId = 'f-duration', unit = selectedDurationUnit(inputId)) {
  const config = DURATION_UNITS[unit] || DURATION_UNITS.hour;
  const input = document.getElementById(inputId);
  if (!input) return;
  input.dataset.durationUnit = unit;
  input.min = String(config.min);
  input.max = String(config.max);
  input.setAttribute('aria-label', `Tempoh penggunaan dalam ${config.label.toLowerCase()}`);

  const label = inputId === 'f-duration'
    ? document.getElementById('durationUnitLabel')
    : input.closest('.duration-field')?.querySelector('.duration-unit');
  if (label) label.textContent = config.label;

  document.querySelectorAll(`[data-duration-unit-target="${inputId}"]`).forEach((button) => {
    const active = button.dataset.durationUnit === unit;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  normalizeDurationInput(inputId);
}

function setDurationUnit(unit, inputId = 'f-duration') {
  const nextUnit = unit === 'day' ? 'day' : 'hour';
  applyDurationUnitState(inputId, nextUnit);
  updateEndTime();
  updatePricing();
}

function setDurationValue(value, inputId = 'f-duration') {
  const input = document.getElementById(inputId);
  if (!input) return;

  const min = Number(input.min || 1);
  const max = Number(input.max || 999);
  const next = Math.min(max, Math.max(min, Number(value) || min));
  input.value = formatDurationValue(next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function adjustDuration(delta, inputId = 'f-duration') {
  const input = document.getElementById(inputId);
  if (!input) return;

  const min = Number(input.min || 1);
  const current = Number.parseFloat(String(input.value).replace(',', '.'));
  if (!Number.isFinite(current) || current <= 0) {
    setDurationValue(min, inputId);
    return;
  }

  const next = Number.isInteger(current)
    ? current + delta
    : delta > 0 ? Math.ceil(current) : Math.floor(current);
  setDurationValue(next, inputId);
}

function normalizeDurationInput(inputId = 'f-duration') {
  const input = document.getElementById(inputId);
  if (!input) return;

  const min = Number(input.min || 1);
  const max = Number(input.max || 999);
  const current = Number.parseFloat(String(input.value).replace(',', '.'));
  input.value = formatDurationValue(Number.isFinite(current) ? Math.min(max, Math.max(min, current)) : min);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const BOOKING_EQUIPMENT_OPTIONS = [
  { name: 'Mikrofon', max: null },
  { name: 'Projektor', max: null },
  { name: 'PA System', max: null },
  { name: 'Kerusi Tambahan', max: null },
  { name: 'Meja Tambahan', max: null },
];
const psEquipmentContextByInput = {};

function equipmentOptionsForFacility(facilityId = '') {
  const facility = facilitiesCache.find((item) => String(item.id) === String(facilityId));
  const options = facility ? (facility.equipment_options || []) : BOOKING_EQUIPMENT_OPTIONS;
  if (isAsramaRoomFacility(facility)) return [];
  return options;
}

function equipmentOptions(inputId = 'f-equipment') {
  const facilityId = psEquipmentContextByInput[inputId] || document.getElementById('f-facility')?.value || '';
  const options = equipmentOptionsForFacility(facilityId);
  return '<option value="">Pilih Peralatan</option>' + options
    .map((item) => `<option value="${escapeAttr(item.name)}">${escapeHtml(item.name)}</option>`)
    .join('');
}

function findEquipmentOption(name, inputId = 'f-equipment') {
  const normalized = String(name || '').trim().toLowerCase();
  const facilityId = psEquipmentContextByInput[inputId] || document.getElementById('f-facility')?.value || '';
  return equipmentOptionsForFacility(facilityId).find((item) => item.name.toLowerCase() === normalized) || null;
}

function normalizeEquipmentQuantity(name, value, inputId = 'f-equipment') {
  const option = findEquipmentOption(name, inputId);
  const max = Number(option?.max || 999);
  const qty = Math.max(1, Math.floor(Number(value) || 1));
  return max > 0 ? Math.min(qty, max) : qty;
}

function parseEquipmentItems(value = '', inputId = 'f-equipment') {
  const raw = String(value || '').trim();
  if (!raw) return [];

  return raw.split(',').reduce((items, part) => {
    const text = part.trim();
    if (!text) return items;

    const match = text.match(/^(.+?)\s+x\s*(\d+)$/i);
    const name = match ? match[1].trim() : text;
    const option = findEquipmentOption(name, inputId);
    if (!option) return items;

    const qty = normalizeEquipmentQuantity(option.name, match ? match[2] : 1, inputId);
    const existing = items.find((item) => item.name === option.name);
    if (existing) {
      existing.quantity = normalizeEquipmentQuantity(option.name, existing.quantity + qty, inputId);
    } else {
      items.push({ name: option.name, quantity: qty });
    }
    return items;
  }, []);
}

function formatEquipmentItems(items = [], inputId = 'f-equipment') {
  return items
    .map((item) => {
      const option = findEquipmentOption(item.name, inputId);
      if (!option) return null;
      return `${option.name} x ${normalizeEquipmentQuantity(option.name, item.quantity, inputId)}`;
    })
    .filter(Boolean)
    .join(', ');
}

function renderEquipmentList(inputId = 'f-equipment', listId = 'equipmentList') {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (!input || !list) return;

  const items = parseEquipmentItems(input.value, inputId);
  if (!items.length) {
    list.innerHTML = '<div class="equipment-empty">Tiada peralatan dipilih</div>';
    return;
  }

  list.innerHTML = items.map((item) => {
    const max = Number(findEquipmentOption(item.name, inputId)?.max || 999);
    return `
    <div class="equipment-item">
      <div class="equipment-name"><i class="bi bi-tools"></i><span>${escapeHtml(item.name)}</span></div>
      <div class="equipment-qty-control">
        <button type="button" onclick="adjustEquipmentQuantity('${escapeAttr(item.name)}', -1, '${escapeAttr(inputId)}', '${escapeAttr(listId)}')" aria-label="Kurangkan ${escapeAttr(item.name)}"><i class="bi bi-dash-lg"></i></button>
        <input type="number" min="1" max="${escapeAttr(String(max))}" step="1" value="${escapeAttr(String(item.quantity))}" onchange="setEquipmentQuantity('${escapeAttr(item.name)}', this.value, '${escapeAttr(inputId)}', '${escapeAttr(listId)}')" aria-label="Jumlah ${escapeAttr(item.name)}">
        <button type="button" onclick="adjustEquipmentQuantity('${escapeAttr(item.name)}', 1, '${escapeAttr(inputId)}', '${escapeAttr(listId)}')" aria-label="Tambah ${escapeAttr(item.name)}"><i class="bi bi-plus-lg"></i></button>
      </div>
      <button type="button" class="equipment-remove-button" onclick="removeEquipmentItem('${escapeAttr(item.name)}', '${escapeAttr(inputId)}', '${escapeAttr(listId)}')" aria-label="Buang ${escapeAttr(item.name)}"><i class="bi bi-x-lg"></i></button>
    </div>
  `;
  }).join('');
}

function syncEquipmentItems(items, inputId = 'f-equipment', listId = 'equipmentList') {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.value = formatEquipmentItems(items, inputId);
  renderEquipmentList(inputId, listId);
}

function addEquipmentItem(inputId = 'f-equipment', selectId = 'equipmentAddSelect', listId = 'equipmentList') {
  const select = document.getElementById(selectId);
  const option = findEquipmentOption(select?.value || '', inputId);
  if (!option) return;

  const input = document.getElementById(inputId);
  const items = parseEquipmentItems(input?.value || '', inputId);
  const existing = items.find((item) => item.name === option.name);
  if (existing) {
    existing.quantity = normalizeEquipmentQuantity(option.name, existing.quantity + 1, inputId);
  } else {
    items.push({ name: option.name, quantity: 1 });
  }

  if (select) select.value = '';
  syncEquipmentItems(items, inputId, listId);
}

function removeEquipmentItem(name, inputId = 'f-equipment', listId = 'equipmentList') {
  const input = document.getElementById(inputId);
  const items = parseEquipmentItems(input?.value || '', inputId).filter((item) => item.name !== name);
  syncEquipmentItems(items, inputId, listId);
}

function setEquipmentQuantity(name, value, inputId = 'f-equipment', listId = 'equipmentList') {
  const input = document.getElementById(inputId);
  const items = parseEquipmentItems(input?.value || '', inputId);
  const item = items.find((entry) => entry.name === name);
  if (!item) return;

  item.quantity = normalizeEquipmentQuantity(name, value, inputId);
  syncEquipmentItems(items, inputId, listId);
}

function adjustEquipmentQuantity(name, delta, inputId = 'f-equipment', listId = 'equipmentList') {
  const input = document.getElementById(inputId);
  const items = parseEquipmentItems(input?.value || '', inputId);
  const item = items.find((entry) => entry.name === name);
  if (!item) return;

  item.quantity = normalizeEquipmentQuantity(name, item.quantity + delta, inputId);
  syncEquipmentItems(items, inputId, listId);
}

function initializeEquipmentField(initialValue = '', inputId = 'f-equipment', selectId = 'equipmentAddSelect', listId = 'equipmentList', facilityId = '') {
  const input = document.getElementById(inputId);
  const select = document.getElementById(selectId);
  if (!input) return;

  psEquipmentContextByInput[inputId] = facilityId || document.getElementById('f-facility')?.value || '';
  if (select) {
    select.innerHTML = equipmentOptions(inputId);
    select.disabled = equipmentOptionsForFacility(psEquipmentContextByInput[inputId]).length === 0;
  }
  input.value = formatEquipmentItems(parseEquipmentItems(initialValue || input.value, inputId), inputId);
  renderEquipmentList(inputId, listId);
}

function normalizeEquipmentField(inputId = 'f-equipment', listId = 'equipmentList') {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.value = formatEquipmentItems(parseEquipmentItems(input.value, inputId), inputId);
  renderEquipmentList(inputId, listId);
}

function toggleStartTimePicker() {
  const input = document.getElementById('f-start');
  if (!input) return;
  if (typeof input.showPicker === 'function') {
    input.showPicker();
    return;
  }
  input.focus();
}

async function submitBooking() {
  if (bookingSubmissionInProgress) return;

  if (!isClientLoggedIn()) {
    showToast('Sila log masuk sebagai pelanggan sebelum membuat tempahan.', 'error');
    window.location.href = ROUTES.login;
    return;
  }

  normalizeDurationInput();
  normalizeEquipmentField();
  const receiptInput = document.getElementById('f-receipt');
  const receiptFile = receiptInput?.files?.[0] || null;
  const data = getBookingFormData();
  const validationMessage = validateBookingFormData(data, receiptFile);

  if (validationMessage) {
    showToast(validationMessage, 'error');
    return;
  }

  const submitButton = document.getElementById('submitBookingButton');
  bookingSubmissionInProgress = true;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="bi bi-arrow-repeat"></i> Menghantar';
  }

  try {
    const ref = await createBookingRecord(data, receiptFile);
    if (bookingCartEditingId) removeBookingCartItem(bookingCartEditingId, false);
    showBookingSuccess(ref);
  } catch (error) {
    showToast(error.message || 'Tempahan gagal dihantar.', 'error');
  } finally {
    bookingSubmissionInProgress = false;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Hantar Permohonan <i class="bi bi-arrow-right ms-2"></i>';
    }
  }
}

function getBookingFormData() {
  const accountEmail = psAuthState.role === 'user'
    ? (psAuthState.user?.email || localStorage.getItem('ps_user_email') || '')
    : '';
  const facility = getSelectedFacility();
  const asramaSelected = isAsramaRoomFacility(facility);
  return {
    full_name: document.getElementById('f-name')?.value.trim() || '',
    organization: '',
    email: accountEmail || document.getElementById('f-email')?.value.trim() || '',
    phone: document.getElementById('f-phone')?.value.trim() || '',
    facility_id: document.getElementById('f-facility')?.value || '',
    booking_date: document.getElementById('f-date')?.value || '',
    start_time: asramaSelected ? '00:00' : (document.getElementById('f-start')?.value || ''),
    end_time: asramaSelected ? '' : (document.getElementById('f-end')?.value || ''),
    duration: document.getElementById('f-duration')?.value || '1',
    duration_unit: selectedDurationUnit(),
    purpose: document.getElementById('f-purpose')?.value.trim() || '',
    equipment_required: asramaSelected ? '' : (document.getElementById('f-equipment')?.value.trim() || ''),
    participant_count: asramaSelected ? 1 : Number(document.getElementById('f-participants')?.value || 0),
    setup_required: 'full',
    estimated_cost: calculateCost().total,
  };
}

function validateBookingFormData(data, receiptFile = null) {
  const durationValue = Number.parseFloat(String(data.duration).replace(',', '.'));
  const durationUnit = data.duration_unit === 'day' ? 'day' : 'hour';
  const facility = facilitiesCache.find((item) => String(item.id) === String(data.facility_id));

  if (!data.full_name || !data.email || !data.phone || !data.facility_id || !data.booking_date || !data.start_time || !data.purpose) {
    return 'Sila lengkapkan semua maklumat yang diperlukan.';
  }
  if (!facility || !facility.is_available) {
    return 'Fasiliti ini tidak tersedia untuk tempahan.';
  }
  if (data.booking_date < getMinimumBookingDateValue()) {
    return 'Tempahan mesti dibuat sekurang-kurangnya 3 hari lebih awal.';
  }
  if (isAsramaRoomFacility(facility) && durationUnit !== 'day') {
    return 'Asrama - Bilik hanya boleh ditempah mengikut hari.';
  }
  if (!Number.isInteger(durationValue) || durationValue <= 0 || durationValue > DURATION_UNITS[durationUnit].max) {
    if (durationUnit === 'day') return 'Sila masukkan tempoh penggunaan antara 1 hingga 30 hari penuh.';
    return 'Sila masukkan tempoh penggunaan antara 1 hingga 24 jam penuh.';
  }
  if (!Number.isInteger(data.participant_count) || data.participant_count < 1) {
    return 'Sila masukkan angka / jumlah pengguna yang sah.';
  }
  if (facility.capacity > 0 && data.participant_count > facility.capacity) {
    return `Jumlah pengguna melebihi kapasiti ${facility.capacity} orang.`;
  }
  const startMinutes = bookingTimeToMinutes(data.start_time);
  const endMinutes = bookingTimeToMinutes(data.end_time);
  const expectedEnd = startMinutes === null ? null : startMinutes + (durationValue * 60);
  if (durationUnit === 'hour' && (startMinutes === null || endMinutes === null || expectedEnd >= 24 * 60 || endMinutes !== expectedEnd)) {
    return 'Tempahan mesti tamat pada hari yang sama dan sepadan dengan tempoh penggunaan.';
  }
  if (!isValidEmail(data.email)) {
    return 'Format e-mel tidak sah.';
  }
  if (receiptFile && !isValidReceiptFile(receiptFile)) {
    return 'Resit mesti dalam format JPG, PNG, GIF atau PDF dan tidak melebihi 5MB.';
  }
  return '';
}

function bookingBlockedDateValues(dateValue, duration = '1', durationUnit = 'hour') {
  if (!dateValue) return [];
  const startDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(startDate.getTime())) return [];

  const days = durationUnit === 'day'
    ? Math.max(1, Math.min(30, Number.parseInt(String(duration), 10) || 1))
    : 1;
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return formatLocalDateValue(date);
  });
}

function bookingDateRangesOverlap(a, b) {
  const datesA = new Set(bookingBlockedDateValues(a.booking_date, a.duration, a.duration_unit));
  return bookingBlockedDateValues(b.booking_date, b.duration, b.duration_unit).some((date) => datesA.has(date));
}

async function createBookingRecord(data, receiptFile = null) {
  const payload = { ...data };
  if (receiptFile) payload.payment_file = receiptFile;

  try {
    const result = await createBookingApi(payload);
    return result?.booking_ref || '';
  } catch (error) {
    if (!error.status) {
      throw new Error('Tempahan tidak dapat dihantar kerana sambungan server terputus. Sila cuba lagi.');
    }
    throw error;
  }
}

async function initBookingPage() {
  if (!document.getElementById('booking')) return;

  const emailEl = document.getElementById('f-email');
  const nameEl = document.getElementById('f-name');
  const phoneEl = document.getElementById('f-phone');
  const storedEmail = localStorage.getItem('ps_user_email') || '';

  [nameEl, phoneEl, emailEl].forEach((el) => {
    if (el) {
      el.readOnly = true;
      el.classList.add('booking-readonly');
    }
  });

  if (emailEl) {
    emailEl.value = psAuthState.role === 'user'
      ? (psAuthState.user?.email || storedEmail)
      : storedEmail;
  }

  try {
    const result = psAuthState.checked ? psAuthState : await getCurrentUser();
    const user = result.user || {};
    if (emailEl) emailEl.value = user.email || storedEmail;
    if (nameEl && user.name) nameEl.value = user.name;
    if (phoneEl && user.phone) phoneEl.value = user.phone;
  } catch (error) {
    if (emailEl && storedEmail) emailEl.value = storedEmail;
  }

  initializeEquipmentField();
  updateBookingCartCount();
}

function bookingCartStorageKey() {
  const email = String(psAuthState.user?.email || localStorage.getItem('ps_user_email') || '').trim().toLowerCase();
  return `${BOOKING_CART_STORAGE_PREFIX}${email || 'guest'}`;
}

function getBookingCartItems() {
  try {
    const items = JSON.parse(localStorage.getItem(bookingCartStorageKey()) || '[]');
    return Array.isArray(items) ? items : [];
  } catch (error) {
    return [];
  }
}

function saveBookingCartItems(items) {
  localStorage.setItem(bookingCartStorageKey(), JSON.stringify(items));
  updateBookingCartCount();
}

function createBookingCartId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `cart-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createBookingCartGroupRef() {
  const randomPart = window.crypto?.getRandomValues
    ? Array.from(window.crypto.getRandomValues(new Uint8Array(3))).map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()
    : Math.random().toString(16).slice(2, 8).toUpperCase();
  return `TR${Date.now().toString(36).toUpperCase()}${randomPart}`;
}

async function addBookingToCart() {
  if (bookingSubmissionInProgress) return;

  if (!isClientLoggedIn()) {
    showToast('Sila log masuk sebagai pelanggan sebelum menggunakan troli.', 'error');
    window.location.href = ROUTES.login;
    return;
  }

  normalizeDurationInput();
  normalizeEquipmentField();
  const receiptFile = document.getElementById('f-receipt')?.files?.[0] || null;
  const data = getBookingFormData();
  const validationMessage = validateBookingFormData(data, receiptFile);
  if (validationMessage) {
    showToast(validationMessage, 'error');
    return;
  }

  const facility = facilitiesCache.find((item) => String(item.id) === String(data.facility_id));
  const items = getBookingCartItems();
  const duplicate = items.find((item) => item.id !== bookingCartEditingId
    && String(item.facility_id) === String(data.facility_id)
    && bookingDateRangesOverlap(item, data));
  if (duplicate) {
    showToast('Fasiliti dan tarikh ini bertindih dengan item dalam troli.', 'error');
    return;
  }

  if (receiptFile) {
    const addButton = document.getElementById('addToCartButton');
    bookingSubmissionInProgress = true;
    if (addButton) {
      addButton.disabled = true;
      addButton.innerHTML = '<i class="bi bi-arrow-repeat"></i><span>Menghantar</span>';
    }

    try {
      const ref = await createBookingRecord(data, receiptFile);
      if (bookingCartEditingId) removeBookingCartItem(bookingCartEditingId, false);
      bookingCartEditingId = null;
      updateBookingCartFormState();
      clearBookingDetailFields();
      renderBookingCart();
      showToast(`Tempahan dengan resit dihantar. Rujukan: ${ref}`, 'success');
    } catch (error) {
      showToast(error.message || 'Tempahan dengan resit gagal dihantar.', 'error');
    } finally {
      bookingSubmissionInProgress = false;
      updateBookingCartFormState();
      if (addButton) addButton.disabled = false;
    }
    return;
  }

  const cartItem = {
    id: bookingCartEditingId || createBookingCartId(),
    facility_id: data.facility_id,
    facility_name: facility?.name || 'Fasiliti',
    facility_icon: facility?.icon || 'bi-building',
    booking_date: data.booking_date,
    start_time: data.start_time,
    end_time: data.end_time,
    duration: data.duration,
    duration_unit: data.duration_unit,
    purpose: data.purpose,
    equipment_required: data.equipment_required,
    participant_count: data.participant_count,
    setup_required: data.setup_required,
    estimated_cost: data.estimated_cost,
  };
  const existingIndex = items.findIndex((item) => item.id === cartItem.id);
  if (existingIndex >= 0) items[existingIndex] = cartItem;
  else items.push(cartItem);

  saveBookingCartItems(items);
  const wasEditing = Boolean(bookingCartEditingId);
  bookingCartEditingId = null;
  updateBookingCartFormState();
  clearBookingDetailFields();
  showToast(
    wasEditing ? 'Item troli berjaya dikemas kini.' : 'Tempahan berjaya ditambah ke troli.',
    'success'
  );
}

function updateBookingCartCount() {
  const count = getBookingCartItems().length;
  const badge = document.getElementById('bookingCartCount');
  if (!badge) return;
  badge.textContent = String(count);
  badge.classList.toggle('is-empty', count === 0);
  badge.setAttribute('aria-label', `${count} item dalam troli`);
}

function ensureBookingCartModal() {
  if (document.getElementById('bookingCartModal')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="bookingCartModal">
      <div class="modal booking-cart-modal" role="dialog" aria-modal="true" aria-labelledby="bookingCartModalTitle">
        <div class="modal-header">
          <div class="modal-title" id="bookingCartModalTitle"><i class="bi bi-cart3 modal-title-icon"></i> Troli Tempahan</div>
          <button class="modal-close" type="button" onclick="closeBookingCart()" aria-label="Tutup troli"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="modal-body booking-cart-body">
          <div class="booking-cart-list" id="bookingCartList"></div>
          <div class="booking-cart-receipt" id="bookingCartReceiptStatus"></div>
          <div class="booking-cart-summary" id="bookingCartSummary"></div>
        </div>
        <div class="modal-footer booking-cart-footer">
          <button class="btn btn-secondary" type="button" onclick="closeBookingCart()">Tutup</button>
          <label class="btn btn-secondary booking-cart-receipt-button" for="bookingCartReceiptInput">
            <i class="bi bi-receipt"></i> Resit
            <input id="bookingCartReceiptInput" type="file" accept=".jpg,.jpeg,.png,.gif,.pdf" onchange="updateBookingCartReceiptState()" aria-label="Muat naik resit troli">
          </label>
          <button class="btn btn-primary" id="submitBookingCartButton" type="button" onclick="submitBookingCart()">
            <i class="bi bi-send-check"></i> Hantar Semua
          </button>
        </div>
      </div>
    </div>
  `);
  document.getElementById('bookingCartModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'bookingCartModal') closeBookingCart();
  });
}

function getBookingCartReceiptFile() {
  return document.getElementById('bookingCartReceiptInput')?.files?.[0] || null;
}

function updateBookingCartReceiptState() {
  const receiptStatus = document.getElementById('bookingCartReceiptStatus');
  const submitButton = document.getElementById('submitBookingCartButton');
  const receiptFile = getBookingCartReceiptFile();
  const items = getBookingCartItems();
  if (!receiptStatus || !submitButton) return;

  if (!items.length) {
    receiptStatus.innerHTML = '';
    submitButton.disabled = true;
    return;
  }

  if (!receiptFile) {
    receiptStatus.innerHTML = '<span><i class="bi bi-info-circle"></i> Muat naik resit sebelum hantar semua tempahan.</span>';
    submitButton.disabled = true;
    return;
  }

  if (!isValidReceiptFile(receiptFile)) {
    receiptStatus.innerHTML = '<span class="is-error"><i class="bi bi-exclamation-circle"></i> Resit mesti JPG, PNG, GIF atau PDF dan tidak melebihi 5MB.</span>';
    submitButton.disabled = true;
    return;
  }

  receiptStatus.innerHTML = `<span class="is-ready"><i class="bi bi-check-circle"></i> ${escapeHtml(receiptFile.name)}</span>`;
  submitButton.disabled = false;
}

function openBookingCart() {
  ensureBookingCartModal();
  renderBookingCart();
  document.querySelector('.account-menu')?.classList.remove('is-open');
  document.querySelector('.account-menu-trigger')?.setAttribute('aria-expanded', 'false');
  document.getElementById('bookingCartModal')?.classList.add('active');
  document.querySelector('.booking-cart-nav')?.classList.add('active');
}

function closeBookingCart() {
  document.getElementById('bookingCartModal')?.classList.remove('active');
  document.querySelector('.booking-cart-nav')?.classList.remove('active');
}

function renderBookingCart() {
  const list = document.getElementById('bookingCartList');
  const summary = document.getElementById('bookingCartSummary');
  const submitButton = document.getElementById('submitBookingCartButton');
  const receiptStatus = document.getElementById('bookingCartReceiptStatus');
  if (!list || !summary || !submitButton || !receiptStatus) return;

  const items = getBookingCartItems();
  if (!items.length) {
    list.innerHTML = `
      <div class="booking-cart-empty">
        <i class="bi bi-cart-x"></i>
        <strong>Troli masih kosong</strong>
        <span>Lengkapkan butiran tempahan dan tambah fasiliti ke troli.</span>
      </div>
    `;
    summary.innerHTML = '';
    receiptStatus.innerHTML = '';
    const receiptInput = document.getElementById('bookingCartReceiptInput');
    if (receiptInput) receiptInput.value = '';
    submitButton.disabled = true;
    return;
  }

  list.innerHTML = items.map((item) => `
    <div class="booking-cart-item">
      <div class="booking-cart-item-icon"><i class="bi ${escapeAttr(item.facility_icon || 'bi-building')}"></i></div>
      <div class="booking-cart-item-content">
        <div class="booking-cart-item-head">
          <strong>${escapeHtml(item.facility_name || 'Fasiliti')}</strong>
        </div>
        <div class="booking-cart-item-meta">
          <span><i class="bi bi-calendar3"></i> ${escapeHtml(formatDate(item.booking_date))}</span>
          <span><i class="bi bi-clock"></i> ${escapeHtml(item.start_time)} - ${escapeHtml(item.end_time || '-')}</span>
          <span><i class="bi bi-hourglass-split"></i> ${escapeHtml(String(item.duration || 1))} ${item.duration_unit === 'day' ? 'hari' : 'jam'}</span>
          <span><i class="bi bi-people"></i> ${escapeHtml(String(item.participant_count || 1))} orang</span>
        </div>
      </div>
      <div class="booking-cart-item-price">RM${escapeHtml(String(item.estimated_cost || 0))}</div>
      <div class="booking-cart-item-actions">
        <button type="button" onclick="editBookingCartItem('${escapeAttr(item.id)}')" title="Edit tempahan" aria-label="Edit ${escapeAttr(item.facility_name || 'fasiliti')}"><i class="bi bi-pencil"></i></button>
        <button class="is-danger" type="button" onclick="removeBookingCartItem('${escapeAttr(item.id)}')" title="Buang daripada troli" aria-label="Buang ${escapeAttr(item.facility_name || 'fasiliti')}"><i class="bi bi-trash3"></i></button>
      </div>
    </div>
  `).join('');

  const total = items.reduce((sum, item) => sum + Number(item.estimated_cost || 0), 0);
  summary.innerHTML = `<span>${items.length} tempahan</span><strong>Jumlah Anggaran: RM${escapeHtml(String(total))}</strong>`;
  updateBookingCartReceiptState();
}

function editBookingCartItem(id) {
  const item = getBookingCartItems().find((entry) => entry.id === id);
  if (!item) return;

  const values = {
    'f-facility': item.facility_id,
    'f-date': item.booking_date,
    'f-start': item.start_time,
    'f-end': item.end_time,
    'f-duration': item.duration,
    'f-purpose': item.purpose,
    'f-equipment': item.equipment_required,
    'f-participants': item.participant_count,
  };
  Object.entries(values).forEach(([fieldId, value]) => {
    const field = document.getElementById(fieldId);
    if (field) field.value = value ?? '';
  });

  bookingCartEditingId = id;
  applyDurationUnitState('f-duration', item.duration_unit === 'day' ? 'day' : 'hour');
  initializeEquipmentField(item.equipment_required || '');
  clearReceiptUpload();
  updateBookingCartFormState();
  updateFacilityInfo();
  closeBookingCart();
  document.getElementById('booking-form-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('Item troli dimuatkan untuk dikemas kini.', 'success');
}

function removeBookingCartItem(id, notify = true) {
  const items = getBookingCartItems();
  const nextItems = items.filter((item) => item.id !== id);
  if (nextItems.length === items.length) return;

  saveBookingCartItems(nextItems);
  if (bookingCartEditingId === id) {
    bookingCartEditingId = null;
    updateBookingCartFormState();
  }
  renderBookingCart();
  if (notify) showToast('Item dibuang daripada troli.', 'success');
}

function updateBookingCartFormState() {
  const button = document.getElementById('addToCartButton');
  if (!button) return;
  button.querySelector('i')?.classList.toggle('bi-cart-plus', !bookingCartEditingId);
  button.querySelector('i')?.classList.toggle('bi-check-lg', Boolean(bookingCartEditingId));
  const label = button.querySelector('span');
  if (label) label.textContent = bookingCartEditingId ? 'Kemas Kini Troli' : 'Tambah ke Troli';
}

async function submitBookingCart() {
  if (!isClientLoggedIn()) {
    showToast('Sila log masuk sebagai pelanggan sebelum menghantar troli.', 'error');
    return;
  }

  const items = getBookingCartItems();
  if (!items.length) return;
  const receiptFile = getBookingCartReceiptFile();
  if (!receiptFile) {
    showToast('Sila muat naik resit sebelum menghantar troli.', 'error');
    updateBookingCartReceiptState();
    return;
  }
  if (!isValidReceiptFile(receiptFile)) {
    showToast('Resit mesti dalam format JPG, PNG, GIF atau PDF dan tidak melebihi 5MB.', 'error');
    updateBookingCartReceiptState();
    return;
  }
  const profile = getBookingFormData();
  if (!profile.full_name || !profile.email || !profile.phone) {
    showToast('Sila lengkapkan maklumat profil sebelum menghantar troli.', 'error');
    return;
  }

  const submitButton = document.getElementById('submitBookingCartButton');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="bi bi-arrow-repeat"></i> Menghantar';
  }

  const completedIds = [];
  const references = [];
  const failures = [];
  const cartGroupRef = createBookingCartGroupRef();
  for (const item of items) {
    const data = {
      full_name: profile.full_name,
      organization: '',
      email: profile.email,
      phone: profile.phone,
      facility_id: item.facility_id,
      booking_date: item.booking_date,
      start_time: item.start_time,
      end_time: item.end_time,
      duration: item.duration,
      duration_unit: item.duration_unit || 'hour',
      purpose: item.purpose,
      equipment_required: item.equipment_required,
      participant_count: Number(item.participant_count || 0),
      setup_required: item.setup_required || 'full',
      estimated_cost: Number(item.estimated_cost || 0),
      cart_group_ref: cartGroupRef,
    };
    const validationMessage = validateBookingFormData(data);
    if (validationMessage) {
      failures.push(item.facility_name || 'Fasiliti');
      continue;
    }

    try {
      references.push(await createBookingRecord(data, receiptFile));
      completedIds.push(item.id);
    } catch (error) {
      failures.push(item.facility_name || 'Fasiliti');
    }
  }

  const remainingItems = getBookingCartItems().filter((item) => !completedIds.includes(item.id));
  saveBookingCartItems(remainingItems);
  renderBookingCart();
  if (submitButton) {
    submitButton.disabled = remainingItems.length === 0;
    submitButton.innerHTML = '<i class="bi bi-send-check"></i> Hantar Semua';
  }

  if (!failures.length) {
    bookingCartEditingId = null;
    const receiptInput = document.getElementById('bookingCartReceiptInput');
    if (receiptInput) receiptInput.value = '';
    updateBookingCartFormState();
    closeBookingCart();
    showBookingSuccess(references.join(', '));
    return;
  }

  const resultMessage = completedIds.length
    ? `${completedIds.length} tempahan dihantar. ${failures.length} tempahan masih berada dalam troli.`
    : 'Troli tidak dapat dihantar. Sila cuba lagi.';
  showToast(resultMessage, 'error');
}

function clearBookingDetailFields() {
  ['f-facility', 'f-date', 'f-start', 'f-end', 'f-purpose', 'f-equipment', 'f-receipt'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const durationEl = document.getElementById('f-duration');
  if (durationEl) durationEl.value = '1';
  applyDurationUnitState('f-duration', 'hour');
  const participantsEl = document.getElementById('f-participants');
  if (participantsEl) participantsEl.value = '1';
  initializeEquipmentField();
  updateReceiptPreview();
  updateFacilityInfo();
}

function isValidReceiptFile(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  const maxSize = 5 * 1024 * 1024;
  return allowedTypes.includes(file.type) && file.size <= maxSize;
}

function updateReceiptPreview() {
  const receiptInput = document.getElementById('f-receipt');
  const preview = document.getElementById('receiptPreview');
  const fileName = document.getElementById('receiptFileName');
  const file = receiptInput?.files?.[0] || null;
  if (!preview || !fileName) return;

  if (!file) {
    preview.classList.remove('show');
    fileName.textContent = '';
    return;
  }

  fileName.textContent = file.name;
  preview.classList.add('show');
}

function clearReceiptUpload() {
  const receiptInput = document.getElementById('f-receipt');
  if (receiptInput) receiptInput.value = '';
  updateReceiptPreview();
}

function showBookingSuccess(ref) {
  document.getElementById('booking-form-wrap').style.display = 'none';
  document.getElementById('successScreen').classList.add('show');
  setText('refCode', ref || '');
}

function adjustParticipantCount(inputId, delta) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const min = Number(input.min || 1);
  const current = Number(input.value || min);
  input.value = String(Math.max(min, current + delta));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function doSignup() {
  const fullName = document.getElementById('signup-name')?.value.trim() || '';
  const phone = document.getElementById('signup-phone')?.value.trim() || '';
  const email = document.getElementById('signup-email')?.value.trim() || '';
  const password = document.getElementById('signup-password')?.value || '';
  const passwordConfirm = document.getElementById('signup-password-confirm')?.value || '';
  const errorEl = document.getElementById('signupError');

  if (errorEl) errorEl.classList.remove('show');

  if (!fullName || !phone || !isValidEmail(email) || password.length < 6 || password !== passwordConfirm) {
    const message = password !== passwordConfirm ? 'Kata laluan pengesahan tidak sama.' : 'Sila lengkapkan semua ruangan dengan betul.';
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('show');
    } else {
      showToast(message, 'error');
    }
    return;
  }

  try {
    const result = await signupClient({
      full_name: fullName,
      phone,
      email,
      password,
      password_confirm: passwordConfirm,
    });
    localStorage.setItem('ps_user_email', result.email || email);
    localStorage.removeItem('ps_admin_logged_in');
    window.location.href = ROUTES.booking;
  } catch (error) {
    const message = error.message || 'Pendaftaran gagal.';
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('show');
    } else {
      showToast(message, 'error');
    }
  }
}

function resetBookingForm() {
  document.getElementById('booking-form-wrap').style.display = '';
  document.getElementById('successScreen').classList.remove('show');
  bookingCartEditingId = null;
  updateBookingCartFormState();
  clearBookingDetailFields();
}
