// ==================== LOCAL FALLBACK ====================
function getBookings() {
  return JSON.parse(localStorage.getItem('ps_bookings') || '[]');
}

function saveBookings(bookings) {
  localStorage.setItem('ps_bookings', JSON.stringify(bookings));
}

function generateId() {
  return 'PS-' + String(getBookings().length + 1).padStart(4, '0');
}

function ensureFallbackSeed() {
  if (getBookings().length > 0) return;
  saveBookings([{
    id: 'PS-0001',
    booking_ref: 'PS-0001',
    name: 'Ahmad Faris',
    org: 'Kelab Sukan',
    email: 'a@poli.my',
    phone: '012-345',
    facilityId: '1',
    facilityName: 'Dewan Utama',
    facilityIcon: '<i class="bi bi-bank"></i>',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    start: '09:00',
    end: '13:00',
    duration: '4',
    purpose: 'Majlis',
    setup: 'full',
    pax: '300',
    paymentFile: '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    adminNote: '',
  }]);
}
