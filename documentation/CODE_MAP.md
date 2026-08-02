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
backend/api/facilities.php  Facility list and admin availability update
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
Only pending and approved bookings block facility/date/time availability.
Unpaid, rejected, and cancelled bookings remain as history but do not block availability.
Admin can reject unpaid, pending, and approved bookings.
Users can cancel unpaid and pending bookings.
Booking deletion is intentionally disabled in the API.
Booking duration is a whole number of hours with a minimum of 1.
Multiple equipment items and quantities are stored in equipment_required.
```

Useful places for these rules:

```text
Backend conflict checks      backend/api/bookings.php
Public calendar filtering    backend/api/bookings.php, resources/js/features/facilities.js
Receipt upload behavior      backend/api/bookings.php, resources/js/features/dashboard.js
Admin reject UI              resources/js/features/admin.js
Status label rendering       resources/js/core/helpers.js
```

## Current UI Touchpoints

```text
Locked booking account email resources/views/booking/index.html, resources/js/features/booking.js
Client booking table         resources/js/features/dashboard.js, resources/css/pages/dashboard.css
Admin booking table          resources/views/admin/dashboard.html, resources/css/components/admin.css
User profile editor          resources/js/core/navigation.js, backend/api/auth.php
Facility card typography     resources/css/pages/landing.css
Static admin logo            resources/views/admin/dashboard.html, resources/css/components/navigation.css
```

## After Editing

Run these checks from the project folder:

```powershell
C:\laragon\bin\nodejs\node-v22\node.exe --check resources/js/script.js
Get-ChildItem -Recurse resources/js -Filter *.js | ForEach-Object { C:\laragon\bin\nodejs\node-v22\node.exe --check $_.FullName }
Get-ChildItem -Recurse backend -Filter *.php | ForEach-Object { C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe -l $_.FullName }
```
