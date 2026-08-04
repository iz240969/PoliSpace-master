// ==================== BOOKING FORM ====================
const BOOKING_CART_STORAGE_PREFIX = 'ps_booking_cart:';
let bookingCartEditingId = null;
let bookingSubmissionInProgress = false;

function setMinDate() {
  const el = document.getElementById('f-date');
  if (el) el.min = getMinimumBookingDateValue();
}

function updateEndTime() {
  const start = document.getElementById('f-start')?.value;
  const duration = document.getElementById('f-duration')?.value || '1';
  if (!start) return;
  const [hours, mins] = start.split(':').map(Number);
  const total = hours * 60 + mins + durationToMinutes(duration);
  const endInput = document.getElementById('f-end');
  if (!endInput) return;
  endInput.value = total >= 24 * 60
    ? ''
    : `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function durationToMinutes(duration = '1') {
  const durationMap = { halfday: 240, fullday: 480 };
  if (durationMap[duration]) return durationMap[duration];

  const hours = Number.parseFloat(String(duration).replace(',', '.'));
  if (!Number.isFinite(hours) || hours <= 0) return 60;
  return Math.round(hours * 60);
}

function durationInputValue(duration = '1') {
  const minutes = durationToMinutes(duration);
  return String(Math.max(1, Math.ceil(minutes / 60)));
}

function formatDurationValue(value) {
  return String(Math.max(1, Math.ceil(value)));
}

function setDurationValue(value, inputId = 'f-duration') {
  const input = document.getElementById(inputId);
  if (!input) return;

  const min = Number(input.min || 1);
  const next = Math.max(min, Number(value) || min);
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
  const current = Number.parseFloat(String(input.value).replace(',', '.'));
  input.value = formatDurationValue(Number.isFinite(current) ? Math.max(min, current) : min);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const BOOKING_EQUIPMENT_OPTIONS = [
  { name: 'Mikrofon', max: null },
  { name: 'Projektor', max: null },
  { name: 'PA System', max: null },
  { name: 'Kerusi Tambahan', max: null },
  { name: 'Meja Tambahan', max: null },
];

function equipmentOptions() {
  return '<option value="">Pilih Peralatan</option>' + BOOKING_EQUIPMENT_OPTIONS
    .map((item) => `<option value="${escapeAttr(item.name)}">${escapeHtml(item.name)}</option>`)
    .join('');
}

function findEquipmentOption(name) {
  const normalized = String(name || '').trim().toLowerCase();
  return BOOKING_EQUIPMENT_OPTIONS.find((item) => item.name.toLowerCase() === normalized) || null;
}

function normalizeEquipmentQuantity(name, value) {
  const option = findEquipmentOption(name);
  const max = Number(option?.max || 999);
  const qty = Math.max(1, Math.floor(Number(value) || 1));
  return max > 0 ? Math.min(qty, max) : qty;
}

function parseEquipmentItems(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return [];

  return raw.split(',').reduce((items, part) => {
    const text = part.trim();
    if (!text) return items;

    const match = text.match(/^(.+?)\s+x\s*(\d+)$/i);
    const name = match ? match[1].trim() : text;
    const option = findEquipmentOption(name);
    if (!option) return items;

    const qty = normalizeEquipmentQuantity(option.name, match ? match[2] : 1);
    const existing = items.find((item) => item.name === option.name);
    if (existing) {
      existing.quantity = normalizeEquipmentQuantity(option.name, existing.quantity + qty);
    } else {
      items.push({ name: option.name, quantity: qty });
    }
    return items;
  }, []);
}

function formatEquipmentItems(items = []) {
  return items
    .map((item) => {
      const option = findEquipmentOption(item.name);
      if (!option) return null;
      return `${option.name} x ${normalizeEquipmentQuantity(option.name, item.quantity)}`;
    })
    .filter(Boolean)
    .join(', ');
}

function renderEquipmentList(inputId = 'f-equipment', listId = 'equipmentList') {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (!input || !list) return;

  const items = parseEquipmentItems(input.value);
  if (!items.length) {
    list.innerHTML = '<div class="equipment-empty">Tiada peralatan dipilih</div>';
    return;
  }

  list.innerHTML = items.map((item) => {
    const max = Number(findEquipmentOption(item.name)?.max || 999);
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

  input.value = formatEquipmentItems(items);
  renderEquipmentList(inputId, listId);
}

function addEquipmentItem(inputId = 'f-equipment', selectId = 'equipmentAddSelect', listId = 'equipmentList') {
  const select = document.getElementById(selectId);
  const option = findEquipmentOption(select?.value || '');
  if (!option) return;

  const input = document.getElementById(inputId);
  const items = parseEquipmentItems(input?.value || '');
  const existing = items.find((item) => item.name === option.name);
  if (existing) {
    existing.quantity = normalizeEquipmentQuantity(option.name, existing.quantity + 1);
  } else {
    items.push({ name: option.name, quantity: 1 });
  }

  if (select) select.value = '';
  syncEquipmentItems(items, inputId, listId);
}

function removeEquipmentItem(name, inputId = 'f-equipment', listId = 'equipmentList') {
  const input = document.getElementById(inputId);
  const items = parseEquipmentItems(input?.value || '').filter((item) => item.name !== name);
  syncEquipmentItems(items, inputId, listId);
}

function setEquipmentQuantity(name, value, inputId = 'f-equipment', listId = 'equipmentList') {
  const input = document.getElementById(inputId);
  const items = parseEquipmentItems(input?.value || '');
  const item = items.find((entry) => entry.name === name);
  if (!item) return;

  item.quantity = normalizeEquipmentQuantity(name, value);
  syncEquipmentItems(items, inputId, listId);
}

function adjustEquipmentQuantity(name, delta, inputId = 'f-equipment', listId = 'equipmentList') {
  const input = document.getElementById(inputId);
  const items = parseEquipmentItems(input?.value || '');
  const item = items.find((entry) => entry.name === name);
  if (!item) return;

  item.quantity = normalizeEquipmentQuantity(name, item.quantity + delta);
  syncEquipmentItems(items, inputId, listId);
}

function initializeEquipmentField(initialValue = '', inputId = 'f-equipment', selectId = 'equipmentAddSelect', listId = 'equipmentList') {
  const input = document.getElementById(inputId);
  const select = document.getElementById(selectId);
  if (!input) return;

  if (select) select.innerHTML = equipmentOptions();
  input.value = formatEquipmentItems(parseEquipmentItems(initialValue || input.value));
  renderEquipmentList(inputId, listId);
}

function normalizeEquipmentField(inputId = 'f-equipment', listId = 'equipmentList') {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.value = formatEquipmentItems(parseEquipmentItems(input.value));
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
  return {
    full_name: document.getElementById('f-name')?.value.trim() || '',
    organization: '',
    email: accountEmail || document.getElementById('f-email')?.value.trim() || '',
    phone: document.getElementById('f-phone')?.value.trim() || '',
    facility_id: document.getElementById('f-facility')?.value || '',
    booking_date: document.getElementById('f-date')?.value || '',
    start_time: document.getElementById('f-start')?.value || '',
    end_time: document.getElementById('f-end')?.value || '',
    duration: document.getElementById('f-duration')?.value || '1',
    purpose: document.getElementById('f-purpose')?.value.trim() || '',
    equipment_required: document.getElementById('f-equipment')?.value.trim() || '',
    participant_count: Number(document.getElementById('f-participants')?.value || 0),
    setup_required: 'full',
    estimated_cost: calculateCost().total,
  };
}

function validateBookingFormData(data, receiptFile = null) {
  const durationHours = Number.parseFloat(String(data.duration).replace(',', '.'));
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
  if (!Number.isInteger(durationHours) || durationHours <= 0 || durationHours > 24) {
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
  const expectedEnd = startMinutes === null ? null : startMinutes + (durationHours * 60);
  if (startMinutes === null || endMinutes === null || expectedEnd >= 24 * 60 || endMinutes !== expectedEnd) {
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

function addBookingToCart() {
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
    && item.booking_date === data.booking_date);
  if (duplicate) {
    showToast('Fasiliti dan tarikh ini sudah berada dalam troli.', 'error');
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
    receiptFile
      ? 'Tempahan ditambah ke troli. Resit boleh dimuat naik melalui Dashboard selepas troli dihantar.'
      : wasEditing ? 'Item troli berjaya dikemas kini.' : 'Tempahan berjaya ditambah ke troli.',
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
          <div class="booking-cart-summary" id="bookingCartSummary"></div>
        </div>
        <div class="modal-footer booking-cart-footer">
          <button class="btn btn-secondary" type="button" onclick="closeBookingCart()">Tutup</button>
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
  if (!list || !summary || !submitButton) return;

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
    submitButton.disabled = true;
    return;
  }

  list.innerHTML = items.map((item) => `
    <div class="booking-cart-item">
      <div class="booking-cart-item-icon"><i class="bi ${escapeAttr(item.facility_icon || 'bi-building')}"></i></div>
      <div class="booking-cart-item-content">
        <div class="booking-cart-item-head">
          <strong>${escapeHtml(item.facility_name || 'Fasiliti')}</strong>
          <span>RM${escapeHtml(String(item.estimated_cost || 0))}</span>
        </div>
        <div class="booking-cart-item-meta">
          <span><i class="bi bi-calendar3"></i> ${escapeHtml(formatDate(item.booking_date))}</span>
          <span><i class="bi bi-clock"></i> ${escapeHtml(item.start_time)} - ${escapeHtml(item.end_time || '-')}</span>
          <span><i class="bi bi-people"></i> ${escapeHtml(String(item.participant_count || 1))} orang</span>
        </div>
      </div>
      <div class="booking-cart-item-actions">
        <button type="button" onclick="editBookingCartItem('${escapeAttr(item.id)}')" title="Edit tempahan" aria-label="Edit ${escapeAttr(item.facility_name || 'fasiliti')}"><i class="bi bi-pencil"></i></button>
        <button class="is-danger" type="button" onclick="removeBookingCartItem('${escapeAttr(item.id)}')" title="Buang daripada troli" aria-label="Buang ${escapeAttr(item.facility_name || 'fasiliti')}"><i class="bi bi-trash3"></i></button>
      </div>
    </div>
  `).join('');

  const total = items.reduce((sum, item) => sum + Number(item.estimated_cost || 0), 0);
  summary.innerHTML = `<span>${items.length} tempahan</span><strong>Jumlah Anggaran: RM${escapeHtml(String(total))}</strong>`;
  submitButton.disabled = false;
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
      purpose: item.purpose,
      equipment_required: item.equipment_required,
      participant_count: Number(item.participant_count || 0),
      setup_required: item.setup_required || 'full',
      estimated_cost: Number(item.estimated_cost || 0),
    };
    const validationMessage = validateBookingFormData(data);
    if (validationMessage) {
      failures.push(item.facility_name || 'Fasiliti');
      continue;
    }

    try {
      references.push(await createBookingRecord(data));
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
