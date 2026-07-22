// ==================== BOOKING FORM ====================
function setMinDate() {
  const el = document.getElementById('f-date');
  if (el) el.min = new Date().toISOString().split('T')[0];
}

function updateEndTime() {
  const start = document.getElementById('f-start')?.value;
  const duration = document.getElementById('f-duration')?.value || '1';
  if (!start) return;
  const durationMap = { '1': 60, '2': 120, '3': 180, '4': 240, halfday: 240, fullday: 480 };
  const [hours, mins] = start.split(':').map(Number);
  const total = hours * 60 + mins + (durationMap[duration] || 60);
  document.getElementById('f-end').value = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function submitBooking() {
  const receiptInput = document.getElementById('f-receipt');
  const receiptFile = receiptInput?.files?.[0] || null;
  const data = {
    full_name: document.getElementById('f-name')?.value.trim() || '',
    organization: '',
    email: document.getElementById('f-email')?.value.trim() || '',
    phone: document.getElementById('f-phone')?.value.trim() || '',
    facility_id: document.getElementById('f-facility')?.value || '',
    booking_date: document.getElementById('f-date')?.value || '',
    start_time: document.getElementById('f-start')?.value || '',
    end_time: document.getElementById('f-end')?.value || '',
    duration: document.getElementById('f-duration')?.value || '1',
    purpose: document.getElementById('f-purpose')?.value.trim() || '',
    participant_count: 0,
    setup_required: 'full',
    estimated_cost: calculateCost().total,
  };

  if (!data.full_name || !data.email || !data.phone || !data.facility_id || !data.booking_date || !data.start_time || !data.purpose) {
    showToast('Sila lengkapkan semua maklumat yang diperlukan.', 'error');
    return;
  }
  if (!isValidEmail(data.email)) {
    showToast('Format e-mel tidak sah.', 'error');
    return;
  }
  if (!receiptFile) {
    showToast('Sila muat naik resit bayaran sebelum menghantar permohonan.', 'error');
    return;
  }
  if (!isValidReceiptFile(receiptFile)) {
    showToast('Resit mesti dalam format JPG, PNG, GIF atau PDF dan tidak melebihi 5MB.', 'error');
    return;
  }
  data.payment_file = receiptFile;
  try {
    const result = apiOnline ? await createBookingApi(data) : null;
    redirectToSignup(result?.booking_ref, data);
  } catch (error) {
    apiOnline = false;
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
      setup: data.setup_required,
      pax: data.participant_count || '-',
      paymentFile: receiptFile.name,
      status: 'pending',
      createdAt: new Date().toISOString(),
      adminNote: '',
    };
    const bookings = getBookings();
    bookings.push(booking);
    saveBookings(bookings);
    redirectToSignup(id, data);
  }
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

function redirectToSignup(ref, bookingData) {
  localStorage.setItem('ps_pending_signup_ref', ref || '');
  localStorage.setItem('ps_pending_signup_email', bookingData.email || '');
  const params = new URLSearchParams({
    ref: ref || '',
    email: bookingData.email || '',
    name: bookingData.full_name || '',
    phone: bookingData.phone || '',
  });
  window.location.href = `${ROUTES.signup}?${params.toString()}`;
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
    window.location.href = ROUTES.dashboard;
  } catch (error) {
    if (errorEl) {
      errorEl.textContent = error.message || 'Pendaftaran gagal.';
      errorEl.classList.add('show');
    } else {
      showToast(error.message || 'Pendaftaran gagal.', 'error');
    }
  }
}

function initSignupPage() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref') || localStorage.getItem('ps_pending_signup_ref') || '';
  const email = params.get('email') || localStorage.getItem('ps_pending_signup_email') || '';
  const name = params.get('name') || '';
  const phone = params.get('phone') || '';

  setText('signupRef', ref || '-');
  const emailEl = document.getElementById('signup-email');
  const nameEl = document.getElementById('signup-name');
  const phoneEl = document.getElementById('signup-phone');
  if (emailEl) emailEl.value = email;
  if (nameEl) nameEl.value = name;
  if (phoneEl) phoneEl.value = phone;
}

function resetBookingForm() {
  document.getElementById('booking-form-wrap').style.display = '';
  document.getElementById('successScreen').classList.remove('show');
  ['f-name', 'f-email', 'f-phone', 'f-facility', 'f-date', 'f-start', 'f-end', 'f-purpose', 'f-receipt'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  updateReceiptPreview();
  updatePricing();
}
