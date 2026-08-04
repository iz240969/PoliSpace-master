// PoliSpace frontend entry point.
// Keep this file as the only script included by HTML pages.
// Feature files are loaded in order because this app uses plain browser globals.
(() => {
  const baseUrl = new URL('.', document.currentScript.src).href;
  const version = '20260804-availability-lock-3';
  const files = [
    'core/config.js',
    'core/navigation.js',
    'core/api.js',
    'core/fallback.js',
    'features/auth.js',
    'features/facilities.js',
    'features/booking.js',
    'features/status.js',
    'features/dashboard.js',
    'features/admin.js',
    'core/helpers.js',
    'core/init.js',
  ];

  files.forEach((file) => {
    document.write(`<script src="${baseUrl}${file}?v=${version}"><\/script>`);
  });
})();
