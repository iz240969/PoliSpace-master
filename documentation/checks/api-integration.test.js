// Executed only by api-integration.ps1 against its disposable PHP/MySQL sandbox.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const baseUrl = process.env.POLISPACE_TEST_BASE_URL;
const dbName = process.env.POLISPACE_TEST_DB_NAME;
const mysqlExe = process.env.POLISPACE_TEST_MYSQL_EXE;
const mysqlDefaults = process.env.POLISPACE_TEST_MYSQL_DEFAULTS;
const mailboxPath = process.env.POLISPACE_TEST_MAILBOX;
const password = process.env.POLISPACE_TEST_PASSWORD;

if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl || '')) throw new Error('Disposable loopback URL is required');
if (!/^codex_polispace_audit_\d{14}_\d+$/.test(dbName || '')) throw new Error('Disposable database name is invalid');
if (!mysqlExe || !mysqlDefaults || !mailboxPath || !password) throw new Error('Disposable test environment is incomplete');

class ApiClient {
  constructor() { this.cookies = new Map(); }

  async request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (this.cookies.size) {
      headers.set('Cookie', [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '));
    }
    let body;
    if (options.json !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.json);
    } else if (options.form) {
      body = options.form;
    }
    const response = await fetch(`${baseUrl}${path}`, { method: options.method || 'GET', headers, body, redirect: 'manual' });
    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);
    for (const header of setCookies) {
      const [pair] = header.split(';', 1);
      const separator = pair.indexOf('=');
      if (separator > 0) this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return { status: response.status, headers: response.headers, data };
  }
}

async function expectStatus(client, path, status, options = {}) {
  const response = await client.request(path, options);
  assert.equal(response.status, status, `${options.method || 'GET'} ${path}: ${JSON.stringify(response.data)}`);
  return response.data;
}

function json(client, path, method, payload, status = 200) {
  return expectStatus(client, path, status, { method, json: payload });
}

function datePlus(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function bookingPayload(overrides = {}) {
  return {
    full_name: 'Ignored Session Name', email: 'ignored@example.test', phone: '0111111111', organization: '',
    facility_id: '1', booking_date: datePlus(7), start_time: '09:00', end_time: '11:00',
    duration: '2', duration_unit: 'hour', purpose: 'API integration audit', participant_count: 20,
    setup_required: 'full', equipment_required: 'Mikrofon x 1', room_count: 1,
    asrama_type: '', asrama_lelaki_rooms: 0, asrama_perempuan_rooms: 0,
    ...overrides,
  };
}

function receiptForm(payload = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) form.set(key, String(value));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  form.set('payment_file', new Blob([png], { type: 'image/png' }), 'audit-receipt.png');
  return form;
}

function moveOwnBooking(ref, date) {
  assert.match(ref, /^PS[A-Za-z0-9]+$/);
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  execFileSync(mysqlExe, [
    `--defaults-extra-file=${mysqlDefaults}`,
    `--database=${dbName}`,
    '--batch', '--skip-column-names',
    '--execute', `UPDATE bookings SET booking_date='${date}' WHERE booking_ref='${ref}' LIMIT 1`,
  ], { stdio: 'pipe', windowsHide: true });
}

const anonymous = new ApiClient();
const admin = new ApiClient();
const publicUser = new ApiClient();
const otherUser = new ApiClient();
const staffUser = new ApiClient();
const state = {};

test('isolated PoliSpace live API workflow', { timeout: 120000 }, async (t) => {
  await t.test('public endpoints and role gates', async () => {
    const facilities = await expectStatus(anonymous, '/backend/api/facilities.php', 200);
    assert.ok(facilities.data.length >= 6);
    await expectStatus(anonymous, '/backend/api/users.php', 401);
    await expectStatus(anonymous, '/backend/api/bookings.php?action=user', 401);
    await expectStatus(anonymous, '/backend/api/bookings.php?action=calendar&year=2026&month=13', 400);
  });

  await t.test('signup, session, profile, strict login roles and logout', async () => {
    const signup = await json(otherUser, '/backend/api/auth.php?action=signup', 'POST', {
      email: 'signup.audit@example.test', password, password_confirm: password,
      full_name: 'Signup Audit', phone: '0123456788', account_type: 'public',
    });
    assert.equal(signup.role, 'user');
    const me = await expectStatus(otherUser, '/backend/api/auth.php?action=me', 200);
    assert.equal(me.user.email, 'signup.audit@example.test');
    const profile = await json(otherUser, '/backend/api/auth.php?action=profile', 'PUT', {
      full_name: 'Signup Audit Updated', phone: '0198765432',
    });
    assert.equal(profile.user.name, 'Signup Audit Updated');
    await json(otherUser, '/backend/api/auth.php?action=logout', 'POST', {});
    await expectStatus(otherUser, '/backend/api/auth.php?action=me', 401);
    await json(otherUser, '/backend/api/auth.php?action=user', 'POST', { email: 'signup.audit@example.test', password });
    await expectStatus(otherUser, '/backend/api/auth.php?action=login', 401, {
      method: 'POST', json: { email: 'signup.audit@example.test', password },
    });
    await json(admin, '/backend/api/auth.php?action=login', 'POST', { email: 'admin.audit@example.test', password });
    await expectStatus(admin, '/backend/api/auth.php?action=user', 401, {
      method: 'POST', json: { email: 'admin.audit@example.test', password },
    });
    await json(publicUser, '/backend/api/auth.php?action=user', 'POST', { email: 'public.audit@example.test', password });
    await json(staffUser, '/backend/api/auth.php?action=user', 'POST', { email: 'staff.audit@example.test', password });
  });

  await t.test('customer administration and staff verification', async () => {
    const users = await expectStatus(admin, '/backend/api/users.php', 200);
    const staff = users.data.find((user) => user.email === 'staff.audit@example.test');
    const signup = users.data.find((user) => user.email === 'signup.audit@example.test');
    assert.ok(staff && signup);
    await json(admin, `/backend/api/users.php?action=staff-verification&id=${staff.id}`, 'PUT', { status: 'verified' });
    await json(admin, `/backend/api/users.php?id=${signup.id}`, 'PUT', { password: `${password}X` });
    const detail = await expectStatus(admin, `/backend/api/users.php?action=detail&id=${staff.id}`, 200);
    assert.equal(detail.data.user.staff_verification_status, 'verified');
    const refreshed = await expectStatus(staffUser, '/backend/api/auth.php?action=me', 200);
    assert.equal(refreshed.user.paymentExempt, true);
  });

  await t.test('facility and PIC CRUD, assignment, validation and mail stub', async () => {
    const malformed = await json(admin, '/backend/api/facilities.php', 'POST', {
      name: 'Bad Numeric Facility', capacity: '1.5', price_per_hour: 'not-a-price', is_available: true,
    }, 422);
    assert.ok(malformed.errors.capacity && malformed.errors.price_per_hour);
    const created = await json(admin, '/backend/api/facilities.php', 'POST', {
      name: 'Audit Facility', icon: 'bi-building', capacity: 25, price_per_hour: 75.5,
      description: 'Disposable integration facility', equipment_options: ['Screen'], is_available: true,
    }, 201);
    state.facilityId = Number(created.data.id);
    const updated = await json(admin, `/backend/api/facilities.php?id=${state.facilityId}`, 'PUT', {
      capacity: 30, price_per_hour: 80, is_available: false,
    });
    assert.equal(Number(updated.data.is_available), 0);
    await json(admin, `/backend/api/facilities.php?id=${state.facilityId}`, 'PUT', { is_available: true });

    const pic = await json(admin, '/backend/api/pics.php', 'POST', {
      full_name: 'Audit PIC', phone: '0123456700', email: 'audit.pic@example.test', facility_ids: [state.facilityId],
    }, 201);
    state.picId = Number(pic.data.id);
    await json(admin, `/backend/api/facilities.php?action=pic&id=${state.facilityId}`, 'PUT', { pic_id: state.picId });
    await json(admin, `/backend/api/pics.php?id=${state.picId}`, 'PUT', {
      full_name: 'Audit PIC Updated', phone: '0123456701', email: 'audit.pic@example.test', facility_ids: [state.facilityId],
    });
    await json(admin, `/backend/api/pics.php?action=test-email&id=${state.picId}`, 'POST', {});
    assert.match(readFileSync(mailboxPath, 'utf8'), /audit\.pic@example\.test/);
  });

  await t.test('messages create, list and reply remain account scoped', async () => {
    await json(publicUser, '/backend/api/messages.php', 'POST', { subject: 'Audit question', message: 'Please verify this test message.' });
    const own = await expectStatus(publicUser, '/backend/api/messages.php?action=my', 200);
    assert.equal(own.data.length, 1);
    const all = await expectStatus(admin, '/backend/api/messages.php', 200);
    const message = all.data.find((item) => item.subject === 'Audit question');
    assert.ok(message);
    await json(admin, `/backend/api/messages.php?action=reply&id=${message.id}`, 'PUT', { reply: 'Audit reply recorded.' });
    const replied = await expectStatus(publicUser, '/backend/api/messages.php?action=my', 200);
    assert.equal(replied.data[0].admin_reply, 'Audit reply recorded.');
  });

  await t.test('normal booking lifecycle, late receipt and receipt ownership', async () => {
    const unpaid = await json(publicUser, '/backend/api/bookings.php', 'POST', bookingPayload({ facility_id: '1', booking_date: datePlus(7) }));
    state.lateRef = unpaid.booking_ref;
    await json(publicUser, `/backend/api/bookings.php?action=user-update&id=${state.lateRef}`, 'PUT', {
      booking_date: datePlus(8), start_time: '10:00', end_time: '12:00', duration: '2', duration_unit: 'hour',
      purpose: 'Edited audit booking', equipment_required: '', participant_count: 15,
    });
    moveOwnBooking(state.lateRef, datePlus(1));
    await expectStatus(otherUser, `/backend/api/bookings.php?action=receipt&id=${state.lateRef}`, 403, {
      method: 'POST', form: receiptForm(),
    });
    const upload = await expectStatus(publicUser, `/backend/api/bookings.php?action=receipt&id=${state.lateRef}`, 200, {
      method: 'POST', form: receiptForm(),
    });
    assert.equal(upload.status, 'pending');
    const detail = await expectStatus(publicUser, `/backend/api/bookings.php?action=ref&ref=${state.lateRef}`, 200);
    state.receiptFile = detail.data.paymentFile;
    await expectStatus(publicUser, `/backend/api/receipts.php?file=${encodeURIComponent(state.receiptFile)}`, 200);
    await expectStatus(otherUser, `/backend/api/receipts.php?file=${encodeURIComponent(state.receiptFile)}`, 404);
    await expectStatus(admin, `/backend/api/receipts.php?file=${encodeURIComponent(state.receiptFile)}`, 200);

    await json(admin, `/backend/api/bookings.php?action=status&id=${state.lateRef}`, 'PUT', { status: 'approved', admin_note: 'Approved in audit' });
    await json(admin, `/backend/api/bookings.php?action=status&id=${state.lateRef}`, 'PUT', { status: 'rejected', admin_note: 'Invalid transition audit' }, 409);
    await json(admin, `/backend/api/bookings.php?action=status&id=${state.lateRef}`, 'PUT', {
      status: 'cancelled', cancellation_reason: 'Disposable integration cancellation',
    });
  });

  await t.test('blocking conflicts, rejection, public calendar, stats and report', async () => {
    const targetDate = datePlus(10);
    const first = await json(publicUser, '/backend/api/bookings.php', 'POST', bookingPayload({ facility_id: '2', booking_date: targetDate }));
    const second = await json(publicUser, '/backend/api/bookings.php', 'POST', bookingPayload({ facility_id: '2', booking_date: targetDate, start_time: '13:00', end_time: '15:00' }));
    await expectStatus(publicUser, `/backend/api/bookings.php?action=receipt&id=${first.booking_ref}`, 200, { method: 'POST', form: receiptForm() });
    await expectStatus(publicUser, `/backend/api/bookings.php?action=receipt&id=${second.booking_ref}`, 409, { method: 'POST', form: receiptForm() });
    await json(admin, `/backend/api/bookings.php?action=status&id=${first.booking_ref}`, 'PUT', { status: 'rejected', admin_note: 'Conflict release audit' });
    await expectStatus(publicUser, `/backend/api/bookings.php?action=receipt&id=${second.booking_ref}`, 200, { method: 'POST', form: receiptForm() });
    const [year, month] = targetDate.split('-');
    const calendar = await expectStatus(anonymous, `/backend/api/bookings.php?action=calendar&year=${year}&month=${Number(month)}&facility_id=2`, 200);
    assert.ok(calendar.data.some((item) => item.id === second.booking_ref));
    await expectStatus(anonymous, '/backend/api/bookings.php?action=public-stats', 200);
    const stats = await expectStatus(admin, '/backend/api/bookings.php?action=stats', 200);
    assert.ok(stats.data.pending >= 1);
    const report = await expectStatus(admin, '/backend/api/bookings.php?action=report&period=all', 200);
    assert.ok(report.data.bookings.length >= 3);
  });

  await t.test('Asrama normal and holiday capacity boundaries plus malformed room values', async () => {
    const holidayStart = datePlus(14);
    const holidayEnd = datePlus(16);
    await json(admin, '/backend/api/asrama_rooms.php', 'PUT', {
      normal_male_limit: 1, normal_female_limit: 1, holiday_enabled: true,
      holiday_start_date: holidayStart, holiday_end_date: holidayEnd,
      holiday_male_limit: 3, holiday_female_limit: 2,
    });
    await expectStatus(publicUser, '/backend/api/bookings.php', 200, { method: 'POST', form: receiptForm(bookingPayload({
      facility_id: '6', booking_date: holidayStart, start_time: '00:00', end_time: '', duration: '1', duration_unit: 'day',
      participant_count: 4, room_count: 2, asrama_type: 'lelaki', asrama_lelaki_rooms: 2, asrama_perempuan_rooms: 0,
    })) });
    const malformed = await json(publicUser, '/backend/api/bookings.php', 'POST', bookingPayload({
      facility_id: '6', booking_date: datePlus(18), start_time: '00:00', end_time: '', duration: '1', duration_unit: 'day',
      room_count: '1.5', asrama_type: 'lelaki', asrama_lelaki_rooms: '1.5', asrama_perempuan_rooms: 0,
    }), 400);
    assert.match(malformed.error, /nombor bulat/i);
    const snapshot = await expectStatus(anonymous, `/backend/api/asrama_rooms.php?action=availability&date=${holidayStart}&duration=1`, 200);
    assert.equal(snapshot.data.dates[holidayStart].limits.male, 3);
    const normalDate = datePlus(13);
    const normalSnapshot = await expectStatus(anonymous, `/backend/api/asrama_rooms.php?action=availability&date=${normalDate}&duration=1`, 200);
    assert.equal(normalSnapshot.data.dates[normalDate].limits.male, 1);
    await expectStatus(publicUser, '/backend/api/bookings.php', 409, { method: 'POST', form: receiptForm(bookingPayload({
      facility_id: '6', booking_date: normalDate, start_time: '00:00', end_time: '', duration: '1', duration_unit: 'day',
      participant_count: 4, room_count: 2, asrama_type: 'lelaki', asrama_lelaki_rooms: 2, asrama_perempuan_rooms: 0,
    })) });
  });

  await t.test('cleanup-visible resources are disposable and mail never leaves the stub', async () => {
    await json(admin, `/backend/api/pics.php?id=${state.picId}`, 'DELETE', {});
    const mailbox = readFileSync(mailboxPath, 'utf8');
    assert.match(mailbox, /PoliSpace/);
    assert.ok(!mailbox.includes(password));
  });
});
