// ==================== INIT ====================
async function init() {
  setupAdminWorkspace();
  setupSurfaceAccessibility();
  setupNetworkStatus();
  setupNavigationAccess();
  await refreshAuthState();
  setupNavigationAccess();
  if (psAuthState.sessionExpired) return;
  if (!protectLoggedInPages()) return;

  if (document.getElementById('admin') && !isAdminLoggedIn()) {
    window.location.replace(ROUTES.adminLogin);
    return;
  }
  document.documentElement.classList.remove('auth-pending');

  if (document.getElementById('adminCreateBookingPage')) {
    await renderAdminCreateBookingPage();
    return;
  }
  if (document.getElementById('asramaBuildings')) {
    await loadAsramaRoomManagement();
    return;
  }
  if (document.getElementById('dashDate')) {
    await renderAdminDashboard();
    return;
  }

  if (document.getElementById('facilitiesGrid')) {
    await Promise.all([renderFacilities(), renderLandingCalendar(), renderPublicCalendarView()]);
    return;
  }

  if (document.getElementById('dashboard')) {
    initDashboard();
    return;
  }

  if (!document.getElementById('booking')) return;

  await populateBookingFacilities();
  await initBookingPage();
  await renderBookingDatePicker();
  setMinDate();
  const startEl = document.getElementById('f-start');
  if (startEl) {
    startEl.addEventListener('change', updateEndTime);
    document.getElementById('f-duration')?.addEventListener('input', () => { updateEndTime(); normalizeRoomCount(); updatePricing(); });
    document.getElementById('f-duration')?.addEventListener('blur', () => normalizeDurationInput());
    document.getElementById('f-facility')?.addEventListener('change', updateFacilityInfo);
    document.getElementById('f-date')?.addEventListener('change', () => { normalizeRoomCount(); renderBookingDatePicker(); });
    document.getElementById('f-receipt')?.addEventListener('change', updateReceiptPreview);
    ['f-asrama-lelaki-rooms', 'f-asrama-perempuan-rooms'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () => { normalizeRoomCount(); updatePricing(); });
      document.getElementById(id)?.addEventListener('blur', normalizeRoomCount);
    });
  }

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
