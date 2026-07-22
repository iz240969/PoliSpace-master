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
API helper functions        resources/js/core/api.js
Shared helper functions     resources/js/core/helpers.js
App startup logic           resources/js/core/init.js
```

## Backend API Files

```text
backend/api/auth.php        Login, signup, logout
backend/api/bookings.php    Booking create/list/status/cancel
backend/api/facilities.php  Facility list and availability
backend/api/messages.php    Contact admin messages
backend/api/users.php       Admin customer list/detail
```

## Configuration

```text
.env                        Database settings
backend/config.php          Loads .env and starts PHP session
backend/db.php              Creates the PDO database connection
```

## After Editing

Run these checks from the project folder:

```powershell
C:\laragon\bin\nodejs\node-v22\node.exe --check resources/js/script.js
Get-ChildItem -Recurse resources/js -Filter *.js | ForEach-Object { C:\laragon\bin\nodejs\node-v22\node.exe --check $_.FullName }
Get-ChildItem -Recurse backend -Filter *.php | ForEach-Object { C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe -l $_.FullName }
```
