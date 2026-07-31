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
backend/api/auth.php        Admin login, auto login, client signup/login
backend/api/bookings.php    Booking create/list/status/edit/cancel/delete/calendar endpoints
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
4. User fills booking details and can upload payment proof immediately or later from Dashboard.
5. Booking is inserted into MySQL through `backend/api/bookings.php`.
6. The booking page shows the reference number and links to Dashboard.
7. User can view their bookings in the client dashboard.
8. User can upload a receipt while the booking is `unpaid`.
9. User can edit or cancel a booking while it is `unpaid` or `pending`.

Payment proof upload is optional on the booking form. If no receipt is uploaded, the booking starts as `unpaid`; uploading a receipt changes it to `pending` for admin review.

## Admin Flow

1. Admin logs in from the same login page as clients.
2. The system detects role by email/password through `auth.php?action=auto`.
3. Admin dashboard loads bookings, facilities, calendar, and customers.
4. Admin can approve or reject bookings.
5. Admin can open the `Pelanggan` page and view customer details plus customer bookings.
6. Admin can set or reset a client password from the customer management flow.

Default admin credentials:

```text
admin@polspace.com
admin123
```

## Facilities

Current required facilities:

```text
Dewan Utama         RM450  800 orang  Econ, PA system, projector
Dewan Syarahan      RM400  120 orang  Econ, PA system, projector
Bilik Persidangan   RM350  60 orang   LCD, projector, econ
Bilik Seminar       RM250  45 orang   TV besar, econ
```

For all four facilities, the setup option is only `Pakej Lengkap`.

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
POST backend/api/auth.php?action=logout        Logout

GET  backend/api/bookings.php                  Admin booking list
GET  backend/api/bookings.php?status=pending   Admin filtered booking list
GET  backend/api/bookings.php?status=unpaid    Admin unpaid booking list
POST backend/api/bookings.php                  Client booking create
POST backend/api/bookings.php?action=receipt&id=PS...
GET  backend/api/bookings.php?action=user&email=user@example.com
GET  backend/api/bookings.php?action=ref&ref=PS...
GET  backend/api/bookings.php?action=calendar&year=2026&month=7
GET  backend/api/bookings.php?action=public-stats
GET  backend/api/bookings.php?action=stats     Admin dashboard stats
PUT  backend/api/bookings.php?action=status&id=PS...
PUT  backend/api/bookings.php?action=user-update&id=PS...
DELETE backend/api/bookings.php?id=PS...

GET  backend/api/facilities.php
PUT  backend/api/facilities.php?id=1
GET  backend/api/users.php
GET  backend/api/users.php?action=detail&id=1
PUT  backend/api/users.php?id=1
GET  backend/api/messages.php
POST backend/api/messages.php
```

Admin-only endpoints call `requireAdmin()`. Client booking actions rely on the PHP session and ownership checks in `bookings.php`.

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


