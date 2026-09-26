// ==================== LOCAL FALLBACK ====================
function getBookings() {
  try {
    const bookings = JSON.parse(localStorage.getItem('ps_bookings') || '[]');
    return Array.isArray(bookings) ? bookings : [];
  } catch (error) {
    return [];
  }
}
