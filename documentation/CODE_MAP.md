# PoliSpace Code Map

Use this file when you want to know where to edit something.

## Main Rule

```text
resources/views/  = page HTML
resources/css/    = visual design
resources/js/     = browser behavior
backend/api/      = PHP API endpoints
database/         = MySQL schema and starter data
```

## Common Changes

```text
Landing page content        resources/views/welcome.html
Booking form fields         resources/views/booking/index.html
Booking form behavior       resources/js/features/booking.js
Booking form styling        resources/css/pages/booking.css

Client dashboard HTML       resources/views/dashboard/index.html
Client dashboard behavior   resources/js/features/dashboard.js
Client dashboard styling    resources/css/pages/dashboard.css

Status page HTML            resources/views/status/index.html
Status lookup behavior      resources/js/features/status.js
Status page styling         resources/css/pages/status.css

Admin dashboard HTML        resources/views/admin/dashboard.html
Admin dashboard behavior    resources/js/features/admin.js
Admin dashboard styling     resources/css/components/admin.css
Admin facility create form  resources/views/admin/dashboard.html, resources/js/features/admin.js, backend/api/facilities.php
Admin PIC management        resources/views/admin/dashboard.html, resources/js/features/admin.js, backend/api/pics.php

Login/signup behavior       resources/js/features/auth.js
Profile editor/menu         resources/js/core/navigation.js, resources/css/components/navigation.css
API helper functions        resources/js/core/api.js
Navigation/account menu     resources/js/core/navigation.js
Shared helper functions     resources/js/core/helpers.js
App startup logic           resources/js/core/init.js
```

## Backend API Files

```text
backend/api/auth.php        Role-aware login, signup, session check, self-profile update, logout
backend/api/bookings.php    Booking create/list/status/edit/cancel/receipt/calendar; DELETE is disabled
backend/api/receipts.php    Authenticated receipt delivery with admin/user ownership checks
backend/api/facilities.php  Facility list plus admin create/edit/availability/equipment/PIC assignment
backend/api/pics.php        Admin PIC CRUD, facility assignments, and trial PIC email
backend/api/asrama_rooms.php Admin Asrama quota settings plus public date-range capacity summary
backend/includes/booking_availability.php Shared date locks, normal facility conflicts, and Asrama quota calculations
backend/includes/pic_mail.php Shared PIC trial/approval/cancellation email composition
backend/api/messages.php    Contact admin messages
backend/api/users.php       Admin customer list/detail/password reset
```

## Configuration

```text
.env                        Database settings
backend/config.php          Loads .env and starts PHP session
backend/db.php              Creates the PDO database connection
```

## Booking Rules

```text
Only pending and approved bookings block availability. Normal facilities are exclusive for overlapping dates; Asrama sums requested rooms against male/female block quotas on every covered date.
Unpaid, rejected, and cancelled bookings remain as history but do not block availability.
Admin can reject pending bookings and cancel approved bookings with a required reason.
Users can cancel unpaid and pending bookings.
Booking deletion is intentionally disabled in the API.
Booking duration is a whole number. Normal bookings use hours; day-based bookings block every date in the duration.
Multiple equipment items and quantities are stored in equipment_required, and available options come from facilities.equipment_options.
```

Useful places for these rules:

```text
Backend conflict checks      backend/api/bookings.php
Date range lock helpers      backend/includes/booking_availability.php
Public calendar filtering    backend/api/bookings.php, resources/js/features/facilities.js
Receipt upload behavior      backend/api/bookings.php, resources/js/features/dashboard.js
Admin approve/reject/cancel UI resources/js/features/admin.js
Status label rendering       resources/js/core/helpers.js
```

## Current UI Touchpoints

```text
Locked booking account email resources/views/booking/index.html, resources/js/features/booking.js
Client booking table         resources/js/features/dashboard.js, resources/css/pages/dashboard.css
Cart group status lookup     backend/api/bookings.php, resources/js/features/status.js
Admin booking table          resources/views/admin/dashboard.html, resources/css/components/admin.css
User profile editor          resources/js/core/navigation.js, backend/api/auth.php
Landing heading and card layout resources/css/pages/landing.css, resources/js/features/facilities.js
Session transition            resources/css/components/motion.css, resources/js/core/init.js
Automatic request feedback    resources/js/core/api.js, resources/js/core/helpers.js
Static admin logo            resources/views/admin/dashboard.html, resources/css/components/navigation.css
```

## After Editing

Run these checks from the project folder:

```powershell
C:\laragon\bin\nodejs\node-v22\node.exe --check resources/js/script.js
Get-ChildItem -Recurse resources/js -Filter *.js | ForEach-Object { C:\laragon\bin\nodejs\node-v22\node.exe --check $_.FullName }
Get-ChildItem -Recurse backend -Filter *.php | ForEach-Object { C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe -l $_.FullName }
```
