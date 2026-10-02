// Run with: node --test documentation/checks/customer-functions.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

function loadFeature(file, globals = {}) {
  const context = vm.createContext({ console, ...globals });
  vm.runInContext(readFileSync(resolve(__dirname, '../../resources/js/features', file), 'utf8'), context);
  return context;
}

function classList() {
  const classes = new Set();
  return {
    add: (...names) => names.forEach((name) => classes.add(name)),
    remove: (...names) => names.forEach((name) => classes.delete(name)),
    contains: (name) => classes.has(name),
    toggle(name, force) {
      const shouldAdd = force === undefined ? !classes.has(name) : force;
      if (shouldAdd) classes.add(name); else classes.delete(name);
      return shouldAdd;
    },
  };
}

function element(value = '') {
  const attributes = {};
  const listeners = {};
  return {
    value,
    innerHTML: '',
    textContent: '',
    dataset: {},
    classList: classList(),
    listeners,
    setAttribute(name, attributeValue) { attributes[name] = String(attributeValue); },
    getAttribute(name) { return Object.hasOwn(attributes, name) ? attributes[name] : null; },
    removeAttribute(name) { delete attributes[name]; },
    addEventListener(type, handler) { listeners[type] = handler; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

test('Asrama validation rejects negative and fractional room allocations', () => {
  const context = loadFeature('booking.js', {
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    facilitiesCache: [{
      id: '6', name: 'Asrama - Bilik', is_available: true, capacity: 2,
      asrama_normal_male_limit: 30, asrama_normal_female_limit: 30,
    }],
    getMinimumBookingDateValue: () => '2026-01-01',
    bookingTimeToMinutes: (time) => time === '00:00' ? 0 : null,
    isValidEmail: () => true,
    formatLocalDateValue: (date) => date.toISOString().slice(0, 10),
  });
  const validBase = {
    full_name: 'User', email: 'user@example.test', phone: '0123456789',
    facility_id: '6', booking_date: '2026-12-10', start_time: '00:00', end_time: '',
    duration: '1', duration_unit: 'day', purpose: 'Program', participant_count: 2,
    asrama_type: 'lelaki,perempuan', room_count: 1,
  };

  assert.match(
    context.validateBookingFormData({ ...validBase, asrama_lelaki_rooms: -1, asrama_perempuan_rooms: 2 }),
    /nombor bulat yang sah/
  );
  assert.match(
    context.validateBookingFormData({ ...validBase, asrama_lelaki_rooms: 0.5, asrama_perempuan_rooms: 0.5 }),
    /nombor bulat yang sah/
  );
});

test('equipment handlers preserve apostrophes and backslashes in option names', () => {
  const input = element("PIC's \\ Mic x 1");
  const list = element();
  const elements = new Map([['f-equipment', input], ['equipmentList', list], ['f-facility', element('1')]]);
  const escapeAttribute = (value) => String(value)
    .replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const context = loadFeature('booking.js', {
    document: {
      getElementById: (id) => elements.get(id) || null,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    facilitiesCache: [{ id: '1', name: 'Audit room', equipment_options: [{ name: "PIC's \\ Mic", max: 3 }] }],
    escapeAttr: escapeAttribute,
    escapeHtml: escapeAttribute,
  });
  context.renderEquipmentList();
  const handler = list.innerHTML.match(/onclick="([^"]*adjustEquipmentQuantity[^"]*)"/)[1]
    .replaceAll('&quot;', '"').replaceAll('&amp;', '&');
  let received;
  Function('adjustEquipmentQuantity', `${handler}`)((...args) => { received = args; });
  assert.deepEqual(received, ["PIC's \\ Mic", -1, 'f-equipment', 'equipmentList']);
});

test('equipment controls keep names with quotes and backslashes callable', () => {
  const itemName = `Director's \\ "backup"`;
  const input = element(`${itemName} x 2`);
  const list = element();
  const facility = element('1');
  const context = loadFeature('booking.js', {
    document: { getElementById: (id) => ({ 'f-equipment': input, equipmentList: list, 'f-facility': facility })[id] || null },
    facilitiesCache: [{ id: '1', equipment_options: [{ name: itemName, max: 5 }] }],
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char])),
    escapeAttr: (value) => String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char])).replace(/`/g, '&#96;'),
  });

  context.renderEquipmentList();
  const handlers = [...list.innerHTML.matchAll(/(?:onclick|onchange)="([^"]*)"/g)];
  assert.equal(handlers.length, 4);
  const decodeHtml = (value) => value
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  let adjustedName;
  const adjust = new Function('adjustEquipmentQuantity', 'setEquipmentQuantity', 'removeEquipmentItem', decodeHtml(handlers[0][1]));
  adjust((name) => { adjustedName = name; }, () => {}, () => {});
  assert.equal(adjustedName, itemName);
  for (const [, handler] of handlers.slice(1)) {
    assert.doesNotThrow(() => new Function('adjustEquipmentQuantity', 'setEquipmentQuantity', 'removeEquipmentItem', decodeHtml(handler)));
  }
});

test('booking calendar opens with dates immediately while availability loads without a loading label', async () => {
  let finishAvailability;
  const pendingAvailability = new Promise((resolvePromise) => { finishAvailability = resolvePromise; });
  const picker = element();
  const dateInput = element();
  const facilitySelect = element('1');
  const context = loadFeature('facilities.js', {
    document: {
      getElementById: (id) => ({ bookingDatePicker: picker, 'f-date': dateInput, 'f-facility': facilitySelect })[id] || null,
      querySelector: () => null,
      addEventListener() {},
    },
    facilitiesCache: [{ id: '1', name: 'Dewan Utama' }],
    bookingDatePickerDate: new Date(2026, 8, 1),
    isAsramaRoomFacility: () => false,
    apiRequest: () => pendingAvailability,
    showToast() {},
  });

  const render = context.renderBookingDatePicker();
  assert.match(picker.innerHTML, /booking-date-picker-day/);
  assert.doesNotMatch(picker.innerHTML, /Memuatkan/i);
  assert.equal(picker.getAttribute('aria-busy'), 'true');
  assert.match(picker.innerHTML, /data-booking-date="2026-09-30" disabled/);

  finishAvailability({ data: [] });
  await render;
  assert.equal(picker.getAttribute('aria-busy'), 'false');
  assert.match(picker.innerHTML, /data-booking-date="2026-09-30"[^>]*>30<\/button>/);
});

test('calendar icon click opens the booking picker through a delegated listener', () => {
  const picker = element();
  const toggle = element();
  const facilitySelect = element('');
  const listeners = [];
  const context = loadFeature('facilities.js', {
    document: {
      getElementById: (id) => ({ bookingDatePicker: picker, 'f-date': element(), 'f-facility': facilitySelect })[id] || null,
      querySelector: () => toggle,
      addEventListener: (type, handler) => listeners.push({ type, handler }),
    },
    facilitiesCache: [],
    bookingDatePickerDate: new Date(2026, 8, 1),
    isAsramaRoomFacility: () => false,
  });
  let defaultPrevented = false;

  const click = listeners.find((listener) => listener.type === 'click').handler;
  click({
    target: { closest: (selector) => selector === '.booking-date-toggle' ? toggle : null },
    preventDefault() { defaultPrevented = true; },
  });

  assert.equal(defaultPrevented, true);
  assert.equal(picker.classList.contains('is-open'), true);
  assert.match(picker.innerHTML, /booking-date-picker-day/);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.doesNotMatch(picker.innerHTML, /Memuatkan/i);
});

test('status details describe day bookings as a duration', () => {
  const context = loadFeature('status.js');
  const result = context.statusBookingDurationLabel({
    duration: '3', durationUnit: 'day', start: '00:00', end: '',
  });
  assert.equal(result.label, 'Tempoh');
  assert.equal(result.value, '3 hari');
});

test('dashboard actions keep upload, cancel, edit and view in the documented order', () => {
  const context = loadFeature('dashboard.js', {
    localStorage: { getItem: () => null },
    escapeAttr: String,
    escapeHtml: String,
    formatDate: String,
    statusBadgeHtml: (status) => status,
  });
  const html = context.bookingRowHtml({
    id: 'PS1', facilityName: 'Dewan', date: '2026-12-10', start: '09:00', end: '10:00',
    status: 'unpaid', paymentRequired: true,
  });
  const actions = ['openReceiptUploadModal', 'cancelUserBooking', 'openEditBookingModal', 'viewUserBookingDetail'];
  const positions = actions.map((action) => html.indexOf(action));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, positions.slice().sort((a, b) => a - b));
});

test('dashboard date validation allows capacity-managed Asrama dates', async () => {
  const dateInput = element('2026-12-10');
  let toastCount = 0;
  const context = loadFeature('dashboard.js', {
    localStorage: { getItem: () => null },
    document: { getElementById: (id) => id === 'edit-booking-date' ? dateInput : null },
    getMinimumBookingDateValue: () => '2026-01-01',
    refreshPublicCalendarBookings: async () => [{
      id: 'OTHER', facilityId: '6', date: '2026-12-10', capacityManaged: true,
    }],
    showToast: () => { toastCount += 1; },
  });

  const available = await context.validateDashboardBookingDateAvailability({
    id: 'PS1', facilityId: '6',
  });
  assert.equal(available, true);
  assert.equal(dateInput.value, '2026-12-10');
  assert.equal(toastCount, 0);
});

test('an older dashboard response cannot replace newer booking data', async () => {
  const container = element();
  const pending = [];
  const context = loadFeature('dashboard.js', {
    localStorage: { getItem: () => 'user@example.test' },
    document: {
      getElementById: (id) => id === 'dashBookingsContainer' ? container : null,
      querySelector: () => null,
    },
    setText() {},
    showLoadingState() {},
    tryApi: () => new Promise((resolvePromise) => pending.push(resolvePromise)),
  });
  context.applyBookingFilters = () => {};

  const first = context.loadUserBookings();
  const second = context.loadUserBookings();
  pending[1]({ data: [{ id: 'NEW' }] });
  await second;
  pending[0]({ data: [{ id: 'OLD' }] });
  await first;

  assert.equal(vm.runInContext('psDashboardBookings[0].id', context), 'NEW');
});

test('an older landing-calendar response cannot overwrite a newer month', async () => {
  const elements = new Map([
    ['landingCalendar', element()],
    ['landingCalendarTitle', element()],
    ['landingCalendarList', element()],
  ]);
  const pending = [];
  const context = loadFeature('facilities.js', {
    document: {
      getElementById: (id) => elements.get(id) || null,
      addEventListener() {},
      querySelector: () => null,
    },
    facilitiesCache: [],
    showLoadingState() {},
    escapeAttr: String,
    escapeHtml: String,
    formatDate: String,
    statusBadgeHtml: String,
  });
  context.loadPublicCalendarBookings = (year, month) => new Promise((resolvePromise) => {
    pending.push({ year, month, resolve: resolvePromise });
  });

  vm.runInContext('landingCalendarDate = new Date(2026, 0, 1)', context);
  const january = context.renderLandingCalendar();
  vm.runInContext('landingCalendarDate = new Date(2026, 1, 1)', context);
  const february = context.renderLandingCalendar();
  pending[1].resolve([]);
  await february;
  pending[0].resolve([]);
  await january;

  assert.equal(elements.get('landingCalendarTitle').textContent, 'Februari 2026');
});
