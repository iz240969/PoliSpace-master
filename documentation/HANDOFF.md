# PoliSpace Handoff

This file is for the next developer or Codex agent continuing the PoliSpace project.

## Current Project State

The project is located at:

```text
C:\laragon\www\PoliSpace
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
backend/api/auth.php        Admin login, auto login, client signup
backend/api/bookings.php    Booking CRUD/status/calendar endpoints
backend/api/facilities.php  Facility list/update endpoint
backend/api/messages.php    Contact message endpoint
backend/api/users.php       Admin customer list/detail endpoint
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
2. User clicks `Buat Tempahan`.
3. User fills booking details.
4. Booking is inserted into MySQL through `backend/api/bookings.php`.
5. User is redirected to signup with booking details in the URL.
6. User creates a password on `resources/views/auth/signup.html`.
7. User can log in and view their dashboard.

Payment proof upload was removed from the booking form. Payment is intended to happen after admin approval.

## Admin Flow

1. Admin logs in from the same login page as clients.
2. The system detects role by email/password through `auth.php?action=auto`.
3. Admin dashboard loads bookings, facilities, calendar, and customers.
4. Admin can approve or reject bookings.
5. Admin can open the `Pelanggan` page and view customer details plus customer bookings.

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
- Production hardening is still needed: CSRF protection, restricted CORS, HTTPS-only cookies, and changing default admin credentials.


