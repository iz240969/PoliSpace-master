// ==================== INIT ====================
async function init() {
  setupNavigationAccess();
  await refreshAuthState();
  setupNavigationAccess();
  protectLoggedInPages();

  if (document.getElementById('admin') && !isAdminLoggedIn()) {
    window.location.href = ROUTES.login;
    return;
  }
  await renderFacilities();
  await renderLandingCalendar();
  await renderPublicCalendarView();
  await populateBookingFacilities();
  await initBookingPage();
  await renderBookingDatePicker();
  setMinDate();
  await renderAdminDashboard();
  await loadAsramaRoomManagement();

  const startEl = document.getElementById('f-start');
  if (startEl) {
    startEl.addEventListener('change', updateEndTime);
    document.getElementById('f-duration')?.addEventListener('input', () => { updateEndTime(); updatePricing(); });
    document.getElementById('f-duration')?.addEventListener('blur', () => normalizeDurationInput());
    document.getElementById('f-facility')?.addEventListener('change', updateFacilityInfo);
    document.getElementById('f-date')?.addEventListener('change', renderBookingDatePicker);
    document.getElementById('f-receipt')?.addEventListener('change', updateReceiptPreview);
    ['f-asrama-lelaki-rooms', 'f-asrama-perempuan-rooms'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () => { normalizeRoomCount(); updatePricing(); });
      document.getElementById(id)?.addEventListener('blur', normalizeRoomCount);
    });
  }

  if (document.getElementById('dashboard')) {
    initDashboard();
  }

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
