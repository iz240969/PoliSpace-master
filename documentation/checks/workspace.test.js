// Run with: node --test documentation/checks/workspace.test.js
// Native Node test runner only; no frontend build or package dependencies.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

function harness() {
  const elements = new Map();
  const selectors = new Map();
  const document = {
    getElementById: (id) => elements.get(id) || null,
    querySelector: (selector) => selectors.get(selector)?.[0] || null,
    querySelectorAll: (selector) => {
      const match = selector.match(/^\[id="(.*)"\]$/);
      return match ? (elements.has(match[1]) ? [elements.get(match[1])] : []) : selectors.get(selector) || [];
    },
    addEventListener() {},
  };
  function element(id, value = '') {
    const classes = new Set();
    const attributes = {};
    const item = {
      value, innerHTML: '', textContent: '', hidden: false, inert: false,
      classList: {
        contains: (name) => classes.has(name),
        add: (name) => classes.add(name), remove: (name) => classes.delete(name),
        toggle(name, force) {
          const add = force === undefined ? !classes.has(name) : force;
          if (add) classes.add(name); else classes.delete(name);
          return add;
        },
      },
      setAttribute: (name, value) => { attributes[name] = value; },
      getAttribute: (name) => attributes[name],
      focus: () => { document.activeElement = item; },
      querySelector: (selector) => document.querySelector(selector),
    };
    elements.set(id, item);
    return item;
  }
  document.body = element('body');
  const context = vm.createContext({ document, console });
  for (const file of ['core/config.js', 'core/helpers.js', 'core/navigation.js', 'core/motion.js', 'features/admin.js']) {
    vm.runInContext(readFileSync(resolve(__dirname, '../../resources/js', file), 'utf8'), context);
  }
  const run = (code) => vm.runInContext(code, context);
  return { context, run, element, selectors, document };
}

test('API requests recover after a temporary network failure', async () => {
  let requests = 0;
  const context = vm.createContext({
    API_BASE: '/backend/api',
    apiOnline: true,
    fetch: async () => {
      requests += 1;
      if (requests === 1) throw new Error('Network unavailable');
      return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) };
    },
  });
  vm.runInContext(readFileSync(resolve(__dirname, '../../resources/js/core/api.js'), 'utf8'), context);
  await assert.rejects(context.tryApi('facilities.php'));
  assert.equal(context.apiOnline, false);
  await context.tryApi('facilities.php');
  assert.equal(context.apiOnline, true);
  assert.equal(requests, 2);
});

test('malformed successful HTTP responses are rejected', async () => {
  const context = vm.createContext({
    API_BASE: '/backend/api',
    fetch: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('HTML response'); } }),
  });
  vm.runInContext(readFileSync(resolve(__dirname, '../../resources/js/core/api.js'), 'utf8'), context);
  await assert.rejects(context.apiRequest('facilities.php'), /Respons pelayan tidak sah/);
});

test('landing sections initialize together without delaying other pages', async () => {
  const started = [];
  let finishFacilities;
  const context = vm.createContext({
    document: {
      readyState: 'loading',
      addEventListener() {},
      documentElement: { classList: { remove() {} } },
      getElementById: (id) => id === 'facilitiesGrid' ? {} : null,
    },
    setupAdminWorkspace() {}, setupSurfaceAccessibility() {}, setupNavigationAccess() {},
    refreshAuthState: async () => {}, protectLoggedInPages: () => true,
    renderFacilities: () => { started.push('facilities'); return new Promise((resolve) => { finishFacilities = resolve; }); },
    renderLandingCalendar: () => { started.push('legacy calendar'); },
    renderPublicCalendarView: () => { started.push('calendar'); },
  });
  vm.runInContext(readFileSync(resolve(__dirname, '../../resources/js/core/init.js'), 'utf8'), context);
  const initialization = context.init();
  await new Promise(setImmediate);
  assert.deepEqual(started, ['facilities', 'legacy calendar', 'calendar']);
  finishFacilities();
  await initialization;
});

test('customer search and account filters preserve the staff verification queue and source records', () => {
  const h = harness();
  h.element('adminClientSearch', 'ali EXAMPLE');
  h.element('clientResultCount');
  h.element('clientsTbody');
  h.element('staffVerificationTbody');
  const badge = h.element('staffVerificationBadge');
  h.run(`adminClientsCache = [
    {id: 1, full_name: 'Ali <Admin>', email: 'ali@example.test', account_type: 'public'},
    {id: 2, full_name: 'Siti', email: 'siti@example.test', account_type: 'staff', staff_verification_status: 'pending'}
  ]; renderAdminClients();`);
  assert.match(h.document.getElementById('clientsTbody').innerHTML, /Ali &lt;Admin&gt;/);
  assert.doesNotMatch(h.document.getElementById('clientsTbody').innerHTML, /siti@example/);
  assert.equal(badge.textContent, '1');
  assert.match(h.document.getElementById('staffVerificationTbody').innerHTML, /Siti/);
  h.document.getElementById('adminClientSearch').value = '';
  h.run(`filterAdminClients('staff', null)`);
  assert.match(h.document.getElementById('clientsTbody').innerHTML, /siti@example/);
  assert.doesNotMatch(h.document.getElementById('clientsTbody').innerHTML, /ali@example/);
  assert.equal(h.run('adminClientsCache.length'), 2);
});

test('booking search finds cart references without changing record status or grouping', () => {
  const h = harness();
  h.element('adminBookingSearch', 'GROUP-12');
  h.element('bookingResultCount');
  h.run(`adminBookingsCache = [
    {id: 'B1', cartGroupRef: 'GROUP-12', status: 'pending'},
    {id: 'B2', cartGroupRef: 'GROUP-12', status: 'approved'},
    {id: 'B3', status: 'cancelled'}
  ]; renderBookingsTable = (id, records) => { globalThis.visibleBookings = records; }; renderAdminBookings();`);
  assert.equal(h.context.visibleBookings.length, 2);
  assert.equal(h.run('adminBookingGroups(visibleBookings)[0].bookings.length'), 2);
  assert.equal(h.run('adminBookingsCache[2].status'), 'cancelled');
  assert.equal(h.document.getElementById('bookingResultCount').textContent, '2 daripada 3 tempahan');
});

test('rapid status filter changes ignore an older response', async () => {
  const h = harness();
  const pending = [];
  h.context.tryApi = (url) => new Promise((resolve) => pending.push({ url, resolve }));
  h.run('renderAdminBookings = () => {};');
  const first = h.run("filterBookings('pending', null)");
  const second = h.run("filterBookings('unpaid', null)");
  assert.equal(pending[1].url, 'bookings.php?status=unpaid');
  pending[1].resolve({ data: [{ id: 'new', status: 'unpaid' }] });
  await second;
  pending[0].resolve({ data: [{ id: 'old', status: 'pending' }] });
  await first;
  assert.equal(h.run('adminBookingsCache[0].id'), 'new');
});

test('PIC search includes assignments, escapes user content, and retains labelled actions', () => {
  const h = harness();
  h.element('adminPicSearch', 'DEWAN');
  const grid = h.element('picManageGrid');
  h.element('picResultCount');
  h.run(`adminPicsCache = [{id: '1', full_name: '<script>', phone: '', email: 'pic@example.test', facility_names: ['Dewan Utama']}]; renderPicManagement();`);
  assert.match(grid.innerHTML, /&lt;script&gt;/);
  assert.match(grid.innerHTML, /title="Hantar E-mel"/);
  assert.match(grid.innerHTML, /openPicEditModal/);
  h.document.getElementById('adminPicSearch').value = 'unmatched';
  h.run('renderPicManagement()');
  assert.match(grid.innerHTML, /Tiada padanan PIC/);
});

test('drawer restores focus and interactive content when closed', () => {
  const h = harness();
  h.element('adminSidebar');
  const main = h.element('adminWorkspace');
  const nav = h.element('main-nav');
  const active = h.element('active');
  const toggle = h.element('toggle');
  const backdrop = h.element('backdrop');
  h.selectors.set('.admin-menu-item.active', [active]);
  h.selectors.set('.admin-nav-toggle', [toggle]);
  h.selectors.set('.admin-nav-backdrop', [backdrop]);
  h.run('toggleAdminNavigation()');
  assert.equal(main.inert, true);
  assert.equal(nav.inert, true);
  assert.equal(h.document.activeElement, active);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  h.run('closeAdminNavigation()');
  assert.equal(main.inert, false);
  assert.equal(nav.inert, false);
  assert.equal(backdrop.hidden, true);
  assert.equal(h.document.activeElement, toggle);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
});

test('facility form disclosure preserves entered values', () => {
  const h = harness();
  const form = h.element('adminFacilityForm');
  form.hidden = true;
  const name = h.element('facilityName', 'Bilik Mesyuarat');
  const toggle = h.element('facilityCreateToggle');
  h.run('toggleFacilityCreateForm()');
  assert.equal(form.hidden, false);
  assert.equal(h.document.activeElement, name);
  h.run('toggleFacilityCreateForm(false)');
  assert.equal(form.hidden, true);
  assert.equal(name.value, 'Bilik Mesyuarat');
  assert.equal(h.document.activeElement, toggle);
});

test('report refresh retains content, ignores stale responses and restores controls', async () => {
  const h = harness();
  const content = h.element('adminReportContent');
  content.innerHTML = '<div>Previously loaded report</div>';
  const period = h.element('reportPeriodSelect', 'month');
  const print = h.element('printAdminReportButton');
  const sort = h.element('reportEvidenceSortSelect');
  h.element('reportUpdateStatus');
  const requests = [];
  h.context.tryApi = () => new Promise((resolve) => requests.push(resolve));
  h.run(`adminReportMeta = {period: 'all', generatedAt: '2026-09-25'};
    renderAdminReports = () => {
      document.getElementById('adminReportContent').innerHTML = adminReportMeta.period;
      document.getElementById('printAdminReportButton').disabled = false;
    };`);
  const first = h.run('loadAdminReports()');
  assert.equal(content.innerHTML, '<div>Previously loaded report</div>');
  assert.equal(content.getAttribute('aria-busy'), 'true');
  assert.equal(print.disabled, true);
  assert.equal(sort.disabled, true);
  period.value = 'year';
  const second = h.run('loadAdminReports()');
  requests[1]({data: {period: 'year', generated_at: '2026-09-25'}});
  await second;
  requests[0]({data: {period: 'month', generated_at: '2026-09-25'}});
  await first;
  assert.equal(content.innerHTML, 'year');
  assert.equal(content.getAttribute('aria-busy'), 'false');
  assert.equal(print.disabled, false);
  assert.equal(sort.disabled, false);
});

test('failed report refresh retains the displayed report and its matching period', async () => {
  const h = harness();
  const content = h.element('adminReportContent');
  content.innerHTML = 'Existing report';
  const period = h.element('reportPeriodSelect', 'year');
  const status = h.element('reportUpdateStatus');
  const print = h.element('printAdminReportButton');
  h.element('reportEvidenceSortSelect');
  h.run("adminReportMeta = {period: 'month', generatedAt: '2026-09-25'};");
  h.context.tryApi = async () => { throw new Error('Offline'); };
  await h.run('loadAdminReports()');
  assert.equal(content.innerHTML, 'Existing report');
  assert.equal(period.value, 'month');
  assert.match(status.textContent, /Kemas kini gagal/);
  assert.equal(content.getAttribute('aria-busy'), 'false');
  assert.equal(print.disabled, false);
});

test('session checking never renders a guest login menu before authentication completes', () => {
  const h = harness();
  const actions = h.element('actions');
  h.context.actions = actions;
  h.run('updateNavActions(actions, false)');
  assert.equal(actions.getAttribute('aria-busy'), 'true');
  assert.doesNotMatch(actions.innerHTML, /Log Masuk|Daftar Akaun/);
  assert.match(actions.innerHTML, /disabled/);
});

test('guest actions resolve directly to login; signed-in users keep their intended route', async () => {
  const h = harness();
  const destinations = [];
  h.context.window = { location: { assign: (url) => destinations.push(url) } };
  h.context.localStorage = { getItem: () => '', setItem() {}, removeItem() {} };
  let requests = 0;
  h.context.getCurrentUser = async () => { requests++; return {role: null, user: null}; };
  await h.run('navigateToClientPage(ROUTES.booking)');
  assert.deepEqual(destinations, ['/resources/views/auth/login.html']);
  assert.equal(requests, 1);
  h.run("psAuthState = {checked: true, role: 'user', user: {email: 'user@example.test'}}");
  await h.run('navigateToClientPage(ROUTES.booking)');
  assert.equal(destinations.at(-1), '/resources/views/booking/index.html');
  h.run("psAuthState.role = 'admin'");
  await h.run('navigateToClientPage(ROUTES.status)');
  assert.equal(destinations.at(-1), '/resources/views/admin/dashboard.html');
  await h.run("navigateToClientPage('https://untrusted.example')");
  assert.equal(destinations.length, 3);
});

test('a click during startup shares the pending session request and waits for its result', async () => {
  const h = harness();
  let requests = 0;
  let resolveSession;
  const destinations = [];
  h.context.window = { location: { assign: (url) => destinations.push(url) } };
  h.context.localStorage = { getItem: () => '', setItem() {}, removeItem() {} };
  h.context.getCurrentUser = () => { requests++; return new Promise((resolve) => { resolveSession = resolve; }); };
  const session = h.run('refreshAuthState()');
  const navigation = h.run('navigateToClientPage(ROUTES.booking)');
  const repeatClick = h.run('navigateToClientPage(ROUTES.booking)');
  assert.equal(requests, 1);
  assert.equal(destinations.length, 0);
  resolveSession({role: 'user', user: {email: 'user@example.test'}});
  await Promise.all([session, navigation, repeatClick]);
  assert.deepEqual(destinations, ['/resources/views/booking/index.html']);
});

test('unauthenticated protected pages stop initialization and replace the history entry', () => {
  const h = harness();
  h.element('booking');
  const replacements = [];
  h.context.window = { location: { replace: (url) => replacements.push(url) } };
  assert.equal(h.run('protectLoggedInPages()'), false);
  assert.deepEqual(replacements, ['/resources/views/auth/login.html']);
});

test('group animations retain rows until collapse finishes and survive rapid toggling', async () => {
  const h = harness();
  const row = h.element('groupChild');
  row.style = { removeProperty(name) { delete this[name]; } };
  const animations = [];
  const cell = {
    getBoundingClientRect: () => ({ height: row.classList.contains('is-visible') ? 180 : 0 }),
    animate(keyframes) {
      let finish, reject;
      const animation = {
        keyframes,
        finished: new Promise((resolve, fail) => { finish = resolve; reject = fail; }),
        finish: () => finish(), cancel: () => reject(new Error('cancelled')),
      };
      animations.push(animation);
      return animation;
    },
  };
  row.querySelectorAll = () => [cell];
  h.context.rows = [row];
  h.context.window = { matchMedia: () => ({matches: false}) };
  h.context.getComputedStyle = () => ({ opacity: row.classList.contains('is-visible') ? '1' : '0', paddingTop: row.classList.contains('is-visible') ? '14px' : '0px' });
  h.run('setBookingGroupExpanded(rows, true)');
  assert.equal(animations[0].keyframes[1].height, '180px'); // No old 120px clipping.
  assert.equal(row.inert, false);
  h.run('setBookingGroupExpanded(rows, false)');
  assert.equal(row.style.display, 'table-row');
  assert.equal(row.inert, true);
  h.run('setBookingGroupExpanded(rows, true)');
  animations[2].finish();
  await new Promise(setImmediate);
  assert.equal(row.classList.contains('is-visible'), true);
  assert.equal(row.inert, false);
  assert.equal(row.style.display, undefined);
  h.run('setBookingGroupExpanded(rows, false)');
  assert.equal(row.style.display, 'table-row');
  animations[3].finish();
  await new Promise(setImmediate);
  assert.equal(row.style.display, undefined);
  assert.equal(row.classList.contains('is-visible'), false);
  assert.equal(row.getAttribute('aria-hidden'), 'true');
  h.context.window.matchMedia = () => ({matches: true});
  h.run('setBookingGroupExpanded(rows, true)');
  assert.equal(animations.length, 4);
  assert.equal(row.style.display, undefined);
  assert.equal(row.inert, false);
});
