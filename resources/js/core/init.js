// ==================== INIT ====================
async function init() {
  ensureFallbackSeed();
  setupNavigationAccess();
  protectLoggedInPages();

  if (document.getElementById('admin') && localStorage.getItem('ps_admin_logged_in') !== '1') {
    window.location.href = ROUTES.login;
    return;
  }
  await renderFacilities();
  await renderLandingCalendar();
  await renderPublicCalendarView();
  await populateBookingFacilities();
  await initBookingPage();
  setMinDate();
  await renderAdminDashboard();

  const startEl = document.getElementById('f-start');
  if (startEl) {
    startEl.addEventListener('change', updateEndTime);
    document.getElementById('f-duration')?.addEventListener('change', () => { updateEndTime(); updatePricing(); });
    document.getElementById('f-facility')?.addEventListener('change', updateFacilityInfo);
    document.getElementById('f-receipt')?.addEventListener('change', updateReceiptPreview);
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
