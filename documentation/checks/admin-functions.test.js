// Run with: node --test documentation/checks/admin-functions.test.js
// Isolated checks for admin UI state and inline controls; no API writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

function harness() {
  const elements = new Map();
  const selectors = new Map();
  const document = {
    body: null,
    activeElement: null,
    getElementById: (id) => elements.get(id) || null,
    querySelector: (selector) => selectors.get(selector)?.[0] || null,
    querySelectorAll: (selector) => selectors.get(selector) || [],
    addEventListener() {},
  };
  function element(id, value = '') {
    const classes = new Set();
    const attributes = {};
    const item = {
      id,
      value,
      innerHTML: '',
      textContent: '',
      hidden: false,
      isConnected: true,
      classList: {
        contains: (name) => classes.has(name),
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        toggle(name, force) {
          const add = force === undefined ? !classes.has(name) : force;
          if (add) classes.add(name); else classes.delete(name);
          return add;
        },
      },
      setAttribute: (name, next) => { attributes[name] = String(next); },
      getAttribute: (name) => attributes[name],
      removeAttribute: (name) => { delete attributes[name]; },
      hasAttribute: (name) => Object.hasOwn(attributes, name),
    };
    elements.set(id, item);
    return item;
  }
  document.body = element('body');
  const context = vm.createContext({ document, console, Date, URL, Set, Map, window: { setTimeout, clearTimeout }, showToast() {} });
  for (const file of ['core/config.js', 'core/helpers.js', 'features/admin.js']) {
    vm.runInContext(readFileSync(resolve(__dirname, '../../resources/js', file), 'utf8'), context);
  }
  const run = (code) => vm.runInContext(code, context);
  return { context, run, element, selectors, document };
}

function runInlineHandler(h, html) {
  const match = html.match(/onclick="([^"]+)"/);
  assert.ok(match, `Expected an inline action in: ${html}`);
  const handler = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  vm.runInContext(handler, h.context);
}

test('payment step opens only after the admin booking form is complete', async () => {
  const h = harness();
  const form = h.element('adminCreateBookingForm');
  const panel = h.element('adminCreatePaymentOptions');
  const button = h.element('adminCreatePaymentButton');
  const unit = h.element('adminBookingDurationUnit', 'hour');
  h.element('adminBookingEnd', '10:00');
  panel.classList.add('is-hidden');
  panel.scrollIntoView = () => {};
  h.context.validateAdminCreateBookingDate = async () => true;
  h.context.getAdminCreateSelectedFacility = () => ({});
  h.context.isAsramaRoomFacility = () => false;
  form.reportValidity = () => false;
  await h.run('toggleAdminCreatePaymentOptions()');
  assert.equal(panel.classList.contains('is-hidden'), true);

  form.reportValidity = () => true;
  await h.run('toggleAdminCreatePaymentOptions()');
  assert.equal(panel.classList.contains('is-hidden'), false);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
});

test('equipment names with quotes and backslashes remain valid admin actions', () => {
  const h = harness();
  const name = `Director's "Projector" \\ Display`;
  const input = h.element('facilityEquipment', name);
  const grid = h.element('facilityEquipmentGrid');
  let received;
  h.context.removeAdminEquipmentOption = (inputId, equipmentName) => { received = [inputId, equipmentName]; };

  h.context.renderAdminEquipmentOptions('facilityEquipment');
  runInlineHandler(h, grid.innerHTML);

  assert.deepEqual(received, ['facilityEquipment', name]);
});

test('day bookings show an all-day label instead of a time range', () => {
  const h = harness();
  assert.equal(h.context.adminBookingTimeLabel({ duration_unit: 'day', start: '00:00', end: null }), 'Sepanjang hari');
  assert.equal(h.context.adminBookingTimeLabel({ durationUnit: 'hour', start: '09:00', end: '10:00' }), '09:00 - 10:00');
});

test('failed status filtering preserves the previously displayed filter and rows', async () => {
  const h = harness();
  const tbody = h.element('allBookingsTbody');
  const all = h.element('allButton');
  const pending = h.element('pendingButton');
  const existingRow = { status: 'approved' };
  h.selectors.set('#bookingFilterTabs .filter-tab', [all, pending]);
  h.context.tryApi = async () => { throw new Error('offline'); };
  h.context.handleAdminAuthorizationError = () => false;
  h.context.renderAdminBookings = () => {};
  h.context.window.testRow = existingRow;
  h.run('adminBookingsCache = [window.testRow]');
  all.classList.add('active');
  all.setAttribute('aria-pressed', 'true');

  await h.context.filterBookings('pending', pending);

  assert.equal(h.run('adminBookingActiveFilter'), 'all');
  assert.equal(all.getAttribute('aria-pressed'), 'true');
  assert.notEqual(pending.getAttribute('aria-pressed'), 'true');
  assert.equal(tbody.hasAttribute('aria-busy'), false);
  assert.equal(h.run('adminBookingsCache')[0], existingRow);
});

test('successful status filtering keeps refreshed dashboard rows under that filter', async () => {
  const h = harness();
  const tbody = h.element('allBookingsTbody');
  const all = h.element('allButton');
  const approved = h.element('approvedButton');
  h.selectors.set('#bookingFilterTabs .filter-tab', [all, approved]);
  h.context.tryApi = async () => ({ data: [{ status: 'approved' }] });
  h.context.renderAdminBookings = () => {};

  await h.context.filterBookings('approved', approved);
  h.run('adminBookingsCache = adminBookingsForActiveFilter([{status:"pending"},{status:"approved"}])');

  assert.equal(h.run('adminBookingActiveFilter'), 'approved');
  assert.equal(approved.getAttribute('aria-pressed'), 'true');
  assert.equal(tbody.hasAttribute('aria-busy'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(h.run('adminBookingsCache').map((booking) => booking.status))), ['approved']);
});

test('a stale filter response cannot replace the latest filter result', async () => {
  const h = harness();
  const oldButton = h.element('pendingButton');
  const latestButton = h.element('approvedButton');
  h.element('allBookingsTbody');
  h.selectors.set('#bookingFilterTabs .filter-tab', [oldButton, latestButton]);
  const pendingRequest = new Promise((resolve, reject) => { h.context.resolvePending = resolve; h.context.rejectPending = reject; });
  h.context.tryApi = (url) => url.includes('status=pending') ? pendingRequest : Promise.resolve({ data: [{ status: 'approved' }] });
  h.context.renderAdminBookings = () => {};

  const stale = h.context.filterBookings('pending', oldButton);
  await h.context.filterBookings('approved', latestButton);
  h.context.resolvePending({ data: [{ status: 'pending' }] });
  await stale;

  assert.equal(h.run('adminBookingActiveFilter'), 'approved');
  assert.deepEqual(JSON.parse(JSON.stringify(h.run('adminBookingsCache').map((booking) => booking.status))), ['approved']);
});
