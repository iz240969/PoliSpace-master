# PoliSpace

PoliSpace is a Laragon-based facility booking system for Politeknik Besut. It uses HTML, CSS, JavaScript, PHP APIs, and MySQL.

## Features

- Public landing page with facility overview and booking calendar.
- Booking form for four facilities:
  - Dewan Utama
  - Dewan Syarahan
  - Bilik Persidangan
  - Bilik Seminar
- Client signup after booking submission.
- Client login and dashboard.
- Admin login and dashboard.
- Admin booking approval/rejection.
- Admin customer management page.
- MySQL-backed data with localStorage fallback for preview.
- `.env` support for database and app configuration.

## Project Structure

```text
PoliSpace/
  index.html                  Redirect to resources/views/welcome.html
  booking.html                Redirect to booking view
  status.html                 Redirect to status view
  dashboard.html              Redirect to client dashboard view
  login.html                  Redirect to login view
  signup.html                 Redirect to signup view
  admin-login.html            Redirect to admin login view
  admin-dashboard.html        Redirect to admin dashboard view

  resources/
    css/
      style.css
      base/
        base.css
        responsive.css
      components/
        admin.css
        buttons.css
        calendar.css
        navigation.css
        success.css
      pages/
        booking.css
        landing.css
        status.css
    js/
      script.js
      core/
        api.js
        config.js
        fallback.js
        helpers.js
        init.js
      features/
        admin.js
        auth.js
        booking.js
        dashboard.js
        facilities.js
        status.js
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

  backend/
    config.php
    db.php
    api/
      auth.php
      bookings.php
      facilities.php
      messages.php
      users.php
    includes/
      functions.php
      validation.php

  database/
    polspace.sql

  uploads/
    payments/
```

## Local Setup

1. Place the project in Laragon:

```text
C:\laragon\www\PoliSpace
```

2. Import the database:

```bash
mysql -u root -p polspace < database/polspace.sql
```

3. Copy `.env.example` to `.env`.

4. Update `.env` if your MySQL credentials are different:

```env
DB_HOST=127.0.0.1
DB_NAME=polspace
DB_USER=root
DB_PASS=
APP_ENV=local
APP_DEBUG=true
```

5. Open the app:

```text
http://localhost/
```

The root HTML files are kept as redirects so old URLs still work.

## Default Login

```text
Admin email: admin@polspace.com
Admin password: admin123
```

Client accounts are created from the signup page after a booking is submitted.

## Main Pages

```text
Home:             /resources/views/welcome.html
Booking:          /resources/views/booking/index.html
Check Status:     /resources/views/status/index.html
Login:            /resources/views/auth/login.html
Signup:           /resources/views/auth/signup.html
Client Dashboard: /resources/views/dashboard/index.html
Admin Dashboard:  /resources/views/admin/dashboard.html
```

## API Endpoints

```text
POST backend/api/auth.php?action=auto
POST backend/api/auth.php?action=login
POST backend/api/auth.php?action=signup
GET  backend/api/facilities.php
GET  backend/api/bookings.php
POST backend/api/bookings.php
GET  backend/api/bookings.php?action=calendar
GET  backend/api/bookings.php?action=ref&ref=PS...
GET  backend/api/bookings.php?action=user&email=user@example.com
PUT  backend/api/bookings.php?action=status&id=PS...
GET  backend/api/users.php
GET  backend/api/users.php?action=detail&id=1
```

## Verification

```powershell
Get-ChildItem -Recurse resources/js -Filter *.js | ForEach-Object { node --check $_.FullName }
Get-ChildItem -Recurse backend -Filter *.php | ForEach-Object { php -l $_.FullName }
```

## Notes

- Do not commit `.env`.
- Store real secrets only in `.env`, not `.env.example`.
- Payment proof upload is not part of the current booking form because payment is handled after admin approval.
- Change the default admin password before production use.
