// Run with: node --test documentation/checks/accounts-functions.test.js
// Isolated account/API regressions; no server, database, or email delivery.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

const apiSource = readFileSync(resolve(__dirname, '../../resources/js/core/api.js'), 'utf8');

function apiHarness() {
  const requests = [];
  const timeoutDelays = [];
  let timerId = 0;
  const context = vm.createContext({
    API_BASE: '/backend/api',
    apiOnline: true,
    FormData,
    AbortController: class {
      constructor() { this.signal = {}; }
      abort() {}
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    },
    window: {
      setTimeout(callback, delay) {
        timeoutDelays.push(delay);
        timerId += 1;
        return timerId;
      },
      clearTimeout() {},
    },
  });
  vm.runInContext(apiSource, context);
  return { context, requests, timeoutDelays };
}

test('booking submission selects its timeout from the supplied booking data', async () => {
  const upload = apiHarness();
  await upload.context.createBookingApi({ purpose: 'Training', payment_file: 'receipt.pdf' });
  assert.equal(upload.requests.length, 1);
  assert.equal(upload.timeoutDelays[0], 120000);
  assert.equal(upload.requests[0].options.body.get('purpose'), 'Training');
  assert.equal(upload.requests[0].options.body.get('payment_file'), 'receipt.pdf');

  const standard = apiHarness();
  await standard.context.createBookingApi({ purpose: 'Staff meeting' });
  assert.equal(standard.timeoutDelays[0], 60000);
});

test('customer login sends the password argument without reading the page DOM', async () => {
  const harness = apiHarness();
  await harness.context.userLogin('member@example.test', 'secret-123');
  assert.equal(harness.requests.length, 1);
  assert.match(harness.requests[0].url, /auth\.php\?action=user/);
  assert.equal(harness.requests[0].options.body.get('email'), 'member@example.test');
  assert.equal(harness.requests[0].options.body.get('password'), 'secret-123');
});

test('profile submission blocks a blank phone before calling the API', async () => {
  const values = new Map([
    ['profileName', { value: 'Test User' }],
    ['profilePhone', { value: '' }],
    ['saveProfileButton', null],
  ]);
  const toasts = [];
  let apiCalls = 0;
  const document = {
    activeElement: null,
    body: { classList: { contains: () => false, toggle() {} } },
    getElementById: (id) => values.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const context = vm.createContext({
    document,
    window: { matchMedia: () => ({ addEventListener() {} }) },
    MutationObserver: class { observe() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    showToast: (message, type) => toasts.push({ message, type }),
    apiRequest: async () => { apiCalls += 1; return { user: {} }; },
  });
  vm.runInContext(readFileSync(resolve(__dirname, '../../resources/js/core/navigation.js'), 'utf8'), context);
  await context.saveUserProfile({ preventDefault() {} });
  assert.equal(apiCalls, 0);
  assert.deepEqual(toasts, [{ message: 'Sila masukkan nombor telefon yang sah.', type: 'error' }]);
});
