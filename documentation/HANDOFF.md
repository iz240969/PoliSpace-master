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
backend/api/facilities.php  Facility list/admin availability update endpoint
backend/api/messages.php    Contact message endpoint
backend/api/users.php       Admin customer list/detail/password reset endpoint
```

The app uses MySQL database `polspace`. Configuration should come from `.env`.

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

The booking form accepts a whole-number duration in hours and supports multiple equipment requests with per-item quantities. Equipment is serialized into `bookings.equipment_required`, for example `Mikrofon x 2, Projektor x 1`.

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
- Uploading a receipt changes `unpaid` to `pending`. This is the point where the slot becomes reserved, unless another `pending` or `approved` booking already overlaps it.
- `approved` bookings remain reserved.
- Admin can reject `unpaid`, `pending`, or `approved` bookings. Rejection requires an admin note and releases the slot.
- User cancellation changes `unpaid` or `pending` bookings to `cancelled` and releases the slot.
- Booking records must be preserved for history and reporting. The DELETE endpoint returns 405 and does not delete rows.

## Admin Flow

1. Admin logs in from the same login page as clients.
2. The system detects role by email/password through `auth.php?action=auto`.
3. Admin dashboard loads bookings, facilities, calendar, and customers.
4. Admin can approve pending bookings and reject unpaid, pending, or approved bookings.
5. Admin can open the `Pelanggan` page and view customer details plus customer bookings.
6. Admin can set or reset a client password from the customer management flow.

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

## Current UI Notes

- Global display headings use `Arial Black` through `--display-font`.
- Facility cards also use `Arial Black` for the facility name and capacity emphasis.
- Client dashboard bookings are rendered as a table like the admin booking table, sorted by most recent.
- Client dashboard filtering is by search text plus status chips.
- Admin dashboard logo is static and does not navigate to the public site when clicked.
- Navigation access is session-aware. Protected tabs are disabled until the session check completes and confirms login.
- The signed-in customer account menu contains only `Edit Profil` and `Log Keluar`; the admin menu contains only `Log Keluar`.
- Customer profile email is read-only. Name and phone updates use `PUT auth.php?action=profile` and are restricted to the active user session.
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
GET  backend/api/bookings.php?action=ref&ref=PS...
GET  backend/api/bookings.php?action=calendar&year=2026&month=7
GET  backend/api/bookings.php?action=public-stats
GET  backend/api/bookings.php?action=stats     Admin dashboard stats
PUT  backend/api/bookings.php?action=status&id=PS...
PUT  backend/api/bookings.php?action=user-update&id=PS...
DELETE backend/api/bookings.php?id=PS...        Disabled: returns 405 to preserve history

GET  backend/api/facilities.php
PUT  backend/api/facilities.php?id=1
GET  backend/api/users.php
GET  backend/api/users.php?action=detail&id=1
PUT  backend/api/users.php?id=1
GET  backend/api/messages.php
POST backend/api/messages.php
```

Admin-only endpoints call `requireAdmin()`. Client booking actions rely on the PHP session and ownership checks in `bookings.php`. Booking creation ignores any submitted email and uses the registered account email from the session.

## Database Compatibility

No new migration is required when the database already matches `database/polspace.sql` or the current `database/update_polspace.sql`. Profile editing uses the existing `users.full_name` and `users.phone` columns. Multi-equipment requests use the existing `bookings.equipment_required` `TEXT` column, and whole-hour durations remain compatible with `bookings.duration VARCHAR(20)`.

For an older database, check `equipment_required` with `information_schema.COLUMNS`. Add it only when missing:

```sql
ALTER TABLE bookings
  ADD COLUMN equipment_required TEXT NULL AFTER setup_required;
```

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

- `resources/js/core/fallback.js` still has localStorage fallback logic for preview mode.
- `APP_ROOT` is hardcoded to ''.
- There is no `.env.example` in this checkout; keep local database settings in `.env`.
- Production hardening is still needed: CSRF protection, restricted CORS, HTTPS-only cookies, and changing default admin credentials.
- Race-condition hardening for simultaneous receipt uploads would need database-level locking or transactions; current conflict checks enforce the rules for normal request flow.


