// ==================== API CONFIGURATION ====================
const APP_ROOT = '';
const ROUTES = {
  home: `${APP_ROOT}/resources/views/welcome.html`,
  booking: `${APP_ROOT}/resources/views/booking/index.html`,
  status: `${APP_ROOT}/resources/views/status/index.html`,
  login: `${APP_ROOT}/resources/views/auth/login.html`,
  signup: `${APP_ROOT}/resources/views/auth/signup.html`,
  dashboard: `${APP_ROOT}/resources/views/dashboard/index.html`,
  adminDashboard: `${APP_ROOT}/resources/views/admin/dashboard.html`,
  adminCreateBooking: `${APP_ROOT}/resources/views/admin/create-booking.html`,
  adminAsrama: `${APP_ROOT}/resources/views/admin/asrama.html`,
  adminLogin: `${APP_ROOT}/resources/views/admin/login.html`,
};
const API_BASE = `${APP_ROOT}/backend/api`;
let apiOnline = true;
let facilitiesCache = [];
let landingCalendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let bookingCalendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let bookingDatePickerDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

const FALLBACK_FACILITIES = [
  { id: 1, name: 'Dewan Utama', icon: 'bi-bank', capacity: 800, price_per_hour: 450, description: 'Kemudahan: Econ, PA system, projector.', pic_full_name: 'Person 1', pic_phone: '012-000-0001', equipment_options: ['Mikrofon', 'Projektor', 'PA System', 'Kerusi Tambahan', 'Meja Tambahan'], is_available: true },
  { id: 2, name: 'Dewan Syarahan', icon: 'bi-mortarboard', capacity: 120, price_per_hour: 400, description: 'Kemudahan: Econ, PA system, projector.', pic_full_name: 'Person 2', pic_phone: '012-000-0002', equipment_options: ['Mikrofon', 'Projektor', 'PA System'], is_available: true },
  { id: 3, name: 'Bilik Persidangan', icon: 'bi-people', capacity: 60, price_per_hour: 350, description: 'Kemudahan: LCD, projector, econ.', pic_full_name: 'Person 3', pic_phone: '012-000-0003', equipment_options: ['Projektor', 'TV LCD', 'Meja Mesyuarat'], is_available: true },
  { id: 4, name: 'Bilik Seminar', icon: 'bi-easel', capacity: 45, price_per_hour: 250, description: 'Kemudahan: TV besar, econ.', pic_full_name: 'Person 4', pic_phone: '012-000-0004', equipment_options: ['TV Besar', 'Papan Putih', 'Mikrofon'], is_available: true },
  { id: 5, name: 'Makmal Komputer - ILL 1', icon: 'bi-pc-display', capacity: 50, price_per_hour: 100, description: 'Makmal komputer ILL 1 untuk penggunaan akademik dan latihan.', pic_full_name: 'Person 5', pic_phone: '012-000-0005', equipment_options: ['Komputer Tambahan', 'Projektor'], is_available: true },
  { id: 6, name: 'Asrama - Bilik', icon: 'bi-door-open', capacity: 2, price_per_hour: 10, max_rooms: 10, description: 'Bilik asrama untuk penginapan. Harga untuk satu bilik.', pic_full_name: 'Person 6', pic_phone: '012-000-0006', equipment_options: [], is_available: true },
];
