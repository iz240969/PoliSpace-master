# PoliSpace Handoff

This file is for the next developer or Codex agent continuing the PoliSpace project.

## Current Project State

The project is located at:

```text
C:\laragon\www\PoliSpace-master
```

It is now organized with a cleaner frontend structure:

```text
resources/
  css/
    style.css
    base/
    components/
    pages/
  js/
    script.js
    core/
      config.js
      navigation.js
      api.js
      fallback.js
      helpers.js
      init.js
    features/
  views/
    welcome.html
    admin/
      dashboard.html
      login.html
    auth/
      login.html
      signup.html
    booking/
      index.html
    dashboard/
      index.html
    status/
      index.html
```

Root files such as `index.html`, `booking.html`, `login.html`, and `dashboard.html` are redirect wrappers only. They exist so old Laragon URLs continue to work.

## Backend

```text
backend/config.php          Loads .env and session/config values
backend/db.php              PDO connection helper
backend/api/auth.php        Login/signup/session plus current-user profile update
backend/api/bookings.php    Booking create/list/status/edit/cancel/receipt/calendar endpoints
backend/api/receipts.php    Secure receipt viewing for authenticated admins and receipt owners
backend/api/facilities.php  Facility list/admin create/admin availability update endpoint
backend/api/pics.php        Admin PIC CRUD, facility assignment, and trial-email endpoint
backend/includes/pic_mail.php Shared PIC booking notification email helper
backend/api/messages.php    Contact message endpoint
backend/api/users.php       Admin customer list/detail/password reset endpoint
```

The app uses MySQL database `polspace`. Configuration should come from `.env`. Trial PIC emails use PHP `mail()` with optional `MAIL_FROM_ADDRESS` and `MAIL_FROM_NAME` values; a real SMTP/mail setup is still required for actual delivery.

## Important Frontend Notes

`resources/js/script.js` is the frontend entry file. It loads the split JS files in order with `document.write`, so pages only need one script tag.

`resources/js/core/config.js` defines:

```js
const APP_ROOT = '';
const API_BASE = `${APP_ROOT}/backend/api`;
```

If the project folder name changes, update `APP_ROOT`.

All main pages load:

```html
<link rel="stylesheet" href="/resources/css/style.css">
<script src="/resources/js/script.js"></script>
```

`resources/css/style.css` is the CSS entry file and imports smaller files from `base/`, `components/`, and `pages/`.

## User Flow

1. User opens the landing page.
2. User signs up or logs in with a client account.
3. User clicks `Buat Tempahan`.
4. User fills booking details. The booking form email is locked to the registered account email from the active session.
5. Booking is inserted into MySQL through `backend/api/bookings.php`.
6. The booking page shows the reference number and links to Dashboard.
7. User can view their bookings in the client dashboard.
8. User can upload a receipt while the booking is `unpaid`.
9. User can edit or cancel a booking while it is `unpaid` or `pending`.
10. User can open `Edit Profil` from the account menu and update their name or phone number.

Payment proof upload is optional on the booking form. If no receipt is uploaded, the booking starts as `unpaid`; uploading a receipt changes it to `pending` for admin review.

The booking form accepts a whole-number duration. Normal facilities use hours; `Asrama - Bilik` uses days. The form supports multiple equipment requests with per-item quantities. Equipment choices come from the selected facility's `facilities.equipment_options` and are serialized into `bookings.equipment_required`, for example `Mikrofon x 2, Projektor x 1`.

## Booking Status Rules

The database stores status values in English and the UI displays Malay labels:

```text
unpaid     Belum Bayar
pending    Menunggu
approved   Diluluskan
rejected   Ditolak
cancelled  Dibatalkan
```

Availability is intentionally status-based:

```text
Blocks slot availability:
pending, approved

Does not block slot availability:
unpaid, rejected, cancelled
```

Important behavior:

- `unpaid` bookings are history records only until payment is made. They do not reserve the facility.
- Uploading a receipt changes `unpaid` to `pending`. Normal facilities reserve the selected date range exclusively. Asrama bookings reserve their requested male/female room quantities against the quota on every covered date.
- A reservation never disables a different facility on the same date.
- Day-based Asrama bookings consume capacity on every date in their duration.
- `approved` bookings remain reserved.
- Admin can reject pending bookings. Admins can cancel an approved booking with a required cancellation reason; the cancelled record remains in history and releases the slot.
- A successful `pending -> approved` transition emails the assigned facility PIC. A successful admin `approved -> cancelled` transition sends the PIC a cancellation email. Missing PIC contact details or mail delivery failure never roll back the booking status.
- User cancellation changes `unpaid` or `pending` bookings to `cancelled` and releases the slot.
- Booking records must be preserved for history and reporting. The DELETE endpoint returns 405 and does not delete rows.

## Admin Flow

1. Admin logs in from the same login page as clients.
2. The system detects role by email/password through `auth.php?action=auto`.
3. Admin dashboard loads bookings, facilities, calendar, and customers.
4. `Tambah Tempahan` opens a dedicated, spacious admin page. Admin must choose `Muat Naik Resit` or `Bayaran Fizikal`; physical payment generates a printable acknowledgement after the booking reference is created.
5. Admin can approve pending bookings, reject pending bookings, and cancel approved bookings with a required reason.
6. Admin can open the `Pelanggan` page and view customer details plus customer bookings.
7. Admin can set or reset a client password from the customer management flow.
8. Admin can read customer messages and open an email reply from the message table.
9. Admin can add and edit facilities from the `Fasiliti` page without editing SQL manually, including facility-specific equipment options.
10. The `Asrama - Bilik` facility card has an `Urus Bilik` button for male/female booking quotas. Normal limits are 0–30 rooms per block. `Mod Cuti Panjang` adds a configurable date range with limits up to 100 per block. The PIC handles actual room and floor allocation outside PoliSpace.
11. The admin `Laporan` section includes all five booking statuses and can be limited to the current month or year by application date. Money is labelled as estimated booking value, uploaded files are labelled as payment evidence rather than official receipts, and `Cetak Laporan` prints the current report view.

Default admin credentials:

```text
admin@polspace.com
Use the seeded local setup password, then change it before production use.
```

## Facilities

Current required facilities:

```text
Dewan Utama         RM450  800 orang  Econ, PA system, projector
Dewan Syarahan      RM400  120 orang  Econ, PA system, projector
Bilik Persidangan   RM350  60 orang   LCD, projector, econ
Bilik Seminar       RM250  45 orang   TV besar, econ
Makmal Komputer - ILL 1  RM100  50 orang   ILL 1
Asrama - Bilik           RM10   2 orang - 1 bilik    Harga untuk satu bilik
```

For Dewan Utama, Dewan Syarahan, Bilik Persidangan, and Bilik Seminar, the setup option is forced to `Pakej Lengkap` by the backend.

Admins can add custom facilities from the dashboard `Fasiliti` panel. The form writes to `POST backend/api/facilities.php` with `name`, `icon`, `capacity`, `price_per_hour`, `description`, optional `pic_id`, `equipment_options`, and `is_available`. Existing cards can be edited with `PUT backend/api/facilities.php?id=...`.

## Current UI Notes

- Global display headings use `Arial Black` through `--display-font`.
- Facility cards also use `Arial Black` for the facility name and capacity emphasis.
- Client dashboard bookings are rendered as a table like the admin booking table and can be sorted by `Permohonan Terkini` or `Tarikh Terdekat`.
- Client dashboard filtering is by search text plus status chips.
- Cart submissions are grouped under `TR...` references. Status lookup accepts both individual `PS...` references and grouped `TR...` references.
- Admin dashboard logo is static and does not navigate to the public site when clicked.
- Navigation access is session-aware. Protected tabs are disabled until the session check completes and confirms login.
- The signed-in customer account menu contains only `Edit Profil` and `Log Keluar`; the admin menu contains only `Log Keluar`.
- Booking form name, phone, and email are read-only and always come from the active user profile. Name and phone updates use `PUT auth.php?action=profile`.
- The admin sidebar is fixed below the navbar and remains visible while content scrolls.
- Booking/customer tables use table-specific widths and horizontal scrolling instead of compressing action buttons.
- Client actions are ordered `Muat Naik Resit`, `Batal`, `Edit`, `Lihat` when all actions are available.
- Admin pending-booking actions are ordered `Terima`, `Tolak`, `Lihat` with no reserved empty slots.

## Verification Commands

Run these after changes:

```powershell
Get-ChildItem -Recurse resources/js -Filter *.js | ForEach-Object { node --check $_.FullName }
Get-ChildItem -Recurse backend -Filter *.php | ForEach-Object { php -l $_.FullName }
```

The consolidated smoke suite also checks key pages, public APIs, JavaScript/PHP syntax, cross-origin mutation rejection, and HTTP method enforcement:

```powershell
powershell -ExecutionPolicy Bypass -File documentation/checks/smoke.ps1
```

Quick Laragon checks:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost/
Invoke-WebRequest -UseBasicParsing http://localhost/resources/views/welcome.html
Invoke-WebRequest -UseBasicParsing http://localhost/backend/api/facilities.php
```

## API Notes

Important current endpoints:

```text
POST backend/api/auth.php?action=auto          Role-aware login
POST backend/api/auth.php?action=login         Admin login
POST backend/api/auth.php?action=signup        Client signup
POST backend/api/auth.php?action=user          Client login
GET  backend/api/auth.php?action=me            Current session
PUT  backend/api/auth.php?action=profile       Update current customer's name/phone
POST backend/api/auth.php?action=logout        Logout

GET  backend/api/bookings.php                  Admin booking list
GET  backend/api/bookings.php?status=pending   Admin filtered booking list
GET  backend/api/bookings.php?status=unpaid    Admin unpaid booking list
POST backend/api/bookings.php                  Client booking create
POST backend/api/bookings.php?action=receipt&id=PS...
GET  backend/api/bookings.php?action=user              Current user's bookings from session
GET  backend/api/bookings.php?action=user&email=user@example.com  Legacy-compatible; must match session email
GET  backend/api/bookings.php?action=ref&ref=PS...    Individual booking status
GET  backend/api/bookings.php?action=ref&ref=TR...    Cart group status
GET  backend/api/bookings.php?action=calendar&year=2026&month=7
GET  backend/api/bookings.php?action=public-stats
GET  backend/api/bookings.php?action=stats     Admin dashboard stats
PUT  backend/api/bookings.php?action=status&id=PS...
PUT  backend/api/bookings.php?action=user-update&id=PS...
DELETE backend/api/bookings.php?id=PS...        Disabled: returns 405 to preserve history

GET  backend/api/facilities.php                          Includes PIC full name and phone; includes PIC email only for admin sessions
POST backend/api/facilities.php                 Admin create facility
PUT  backend/api/facilities.php?id=1            Admin edit facility, equipment, or availability
PUT  backend/api/facilities.php?action=pic&id=1 Admin change/unassign the facility PIC
GET  backend/api/pics.php                       Admin PIC list with assigned facilities
POST backend/api/pics.php                      Admin create PIC and assignments
PUT  backend/api/pics.php?id=1                 Admin edit PIC and replace assignments
DELETE backend/api/pics.php?id=1               Admin delete PIC and safely unassign facilities
POST backend/api/pics.php?action=test-email&id=1 Admin send trial email to PIC
GET  backend/api/users.php
GET  backend/api/users.php?action=detail&id=1
PUT  backend/api/users.php?id=1
GET  backend/api/messages.php
POST backend/api/messages.php
```

Admin-only endpoints call `requireAdmin()`. Client booking actions rely on the PHP session and ownership checks in `bookings.php`. Booking creation ignores any submitted email and uses the registered account email from the session.

## Database Compatibility

No new migration is required when the database already matches `database/polspace.sql` or the current `database/update_polspace.sql`. The update script is idempotent and preserves existing admin passwords, bookings, custom facilities, availability settings, and legacy PIC contacts. PIC details live in `pics`; `facilities.pic_id` is a nullable foreign key with `ON DELETE SET NULL`. Existing facility PIC columns are migrated before removal. Admin cancellation reasons use `bookings.cancellation_reason` so existing `admin_note` values remain intact.

For an older database, check `equipment_required` with `information_schema.COLUMNS`. Add it only when missing:

```sql
ALTER TABLE bookings
  ADD COLUMN equipment_required TEXT NULL AFTER setup_required;
```

Use `database/facility_equipment_defaults.sql` to add/backfill default equipment options on an existing database. Use `database/clear_bookings.sql` to clear only booking rows for a fresh test cycle.

## Git Notes

The working tree may contain uncommitted feature work. Do not reset or revert unrelated files.

Expected changed areas from recent work:

```text
  CODE_MAP.md
  README.md
documentation/README.md
documentation/HANDOFF.md
backend/api/auth.php
backend/api/users.php
resources/css/style.css
resources/js/script.js
resources/css/base/**
resources/css/components/**
resources/css/pages/**
resources/js/core/**
resources/js/features/**
resources/views/**
root redirect HTML files
```

## Known Caveats

- `resources/js/core/fallback.js` reads legacy local booking data only for public calendar fallbacks. Mutating and authenticated workflows never report local-only data as successfully saved.
- `APP_ROOT` is hardcoded to ''.
- There is no `.env.example` in this checkout; keep local database settings in `.env`.
- State-changing browser requests enforce same-origin checks. Production hardening still needs HTTPS-only cookies, changing default admin credentials, and optional synchronizer CSRF tokens for defense-in-depth.
- MySQL named locks plus backend date-range conflict checks protect simultaneous paid bookings for the same facility/date range. The `uniq_blocking_facility_date` index still protects duplicate starts for the same facility/date.


