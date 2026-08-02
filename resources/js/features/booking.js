// ==================== BOOKING FORM ====================
function setMinDate() {
  const el = document.getElementById('f-date');
  if (el) el.min = new Date().toISOString().split('T')[0];
}

function updateEndTime() {
  const start = document.getElementById('f-start')?.value;
  const duration = document.getElementById('f-duration')?.value || '1';
  if (!start) return;
  const [hours, mins] = start.split(':').map(Number);
  const total = hours * 60 + mins + durationToMinutes(duration);
  document.getElementById('f-end').value = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
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
  if (!isClientLoggedIn()) {
    showToast('Sila log masuk sebagai pelanggan sebelum membuat tempahan.', 'error');
    window.location.href = ROUTES.login;
    return;
  }

  normalizeDurationInput();
  normalizeEquipmentField();
  const receiptInput = document.getElementById('f-receipt');
  const receiptFile = receiptInput?.files?.[0] || null;
  const accountEmail = psAuthState.role === 'user'
    ? (psAuthState.user?.email || localStorage.getItem('ps_user_email') || '')
    : '';
  const data = {
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
  const durationHours = Number.parseFloat(String(data.duration).replace(',', '.'));

  if (!data.full_name || !data.email || !data.phone || !data.facility_id || !data.booking_date || !data.start_time || !data.purpose) {
    showToast('Sila lengkapkan semua maklumat yang diperlukan.', 'error');
    return;
  }
  if (!Number.isInteger(durationHours) || durationHours <= 0) {
    showToast('Sila masukkan tempoh penggunaan dalam jam penuh.', 'error');
    return;
  }
  if (!Number.isInteger(data.participant_count) || data.participant_count < 1) {
    showToast('Sila masukkan angka / jumlah pengguna yang sah.', 'error');
    return;
  }
  if (!isValidEmail(data.email)) {
    showToast('Format e-mel tidak sah.', 'error');
    return;
  }
  if (receiptFile && !isValidReceiptFile(receiptFile)) {
    showToast('Resit mesti dalam format JPG, PNG, GIF atau PDF dan tidak melebihi 5MB.', 'error');
    return;
  }
  if (receiptFile) data.payment_file = receiptFile;
  try {
    const result = apiOnline ? await createBookingApi(data) : null;
    showBookingSuccess(result?.booking_ref);
  } catch (error) {
    if (!canUseLocalFallback(error)) {
      showToast(error.message || 'Tempahan gagal dihantar.', 'error');
      return;
    }

    apiOnline = false;
    if (receiptFile && hasLocalBlockingConflict(data)) {
      showToast('Slot ini telah ditempah oleh pelanggan yang telah membuat bayaran. Sila pilih masa lain.', 'error');
      return;
    }
    const facility = getSelectedFacility();
    const id = generateId();
    const booking = {
      id,
      booking_ref: id,
      name: data.full_name,
      org: data.organization,
      email: data.email,
      phone: data.phone,
      facilityId: data.facility_id,
      facilityName: facility?.name || '',
      facilityIcon: facility ? facilityIconHtml(facility) : '',
      date: data.booking_date,
      start: data.start_time,
      end: data.end_time,
      duration: data.duration,
      purpose: data.purpose,
      equipment: data.equipment_required,
      setup: data.setup_required,
      pax: data.participant_count || '-',
      paymentFile: receiptFile?.name || '',
      status: receiptFile ? 'pending' : 'unpaid',
      createdAt: new Date().toISOString(),
      adminNote: '',
    };
    const bookings = getBookings();
    bookings.push(booking);
    saveBookings(bookings);
    showBookingSuccess(id);
  }
}

async function initBookingPage() {
  if (!document.getElementById('booking')) return;

  const emailEl = document.getElementById('f-email');
  const nameEl = document.getElementById('f-name');
  const phoneEl = document.getElementById('f-phone');
  const storedEmail = localStorage.getItem('ps_user_email') || '';

  if (emailEl) {
    emailEl.readOnly = true;
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
  ['f-facility', 'f-date', 'f-start', 'f-end', 'f-duration', 'f-purpose', 'f-equipment', 'f-receipt'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const durationEl = document.getElementById('f-duration');
  if (durationEl) durationEl.value = '1';
  const participantsEl = document.getElementById('f-participants');
  if (participantsEl) participantsEl.value = '1';
  initializeEquipmentField();
  updateReceiptPreview();
  updatePricing();
}
