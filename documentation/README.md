# PoliSpace Project Documentation

PoliSpace is a facility booking system for Politeknik Besut. It is built with plain HTML, CSS, JavaScript, PHP API endpoints, and MySQL.

## Structure

```text
resources/views/      Maintained HTML pages
resources/css/        Base, component, and page CSS
resources/js/         Browser behavior split into core and feature modules
backend/api/          PHP API endpoints
backend/includes/     Shared PHP helpers and validation
database/             Fresh install and update SQL files
uploads/payments/     Uploaded receipt files
```

Root files such as `index.html`, `booking.html`, `dashboard.html`, `login.html`, and `signup.html` are compatibility redirect wrappers. The maintained pages live under `resources/views/`.

## Frontend Entry Points

Every main page loads the shared entry files:

```html
<link rel="stylesheet" href="/resources/css/style.css?v=...">
<script src="/resources/js/script.js?v=..."></script>
```

The query value is a cache-busting version and should stay consistent across pages after a UI update. `resources/js/script.js` loads the plain browser-global JavaScript modules in order. `resources/css/style.css` imports the base, component, and page CSS files.

## Authentication

Authentication is session-based through `backend/api/auth.php`.

```text
POST auth.php?action=auto     Role-aware login for admin or user
POST auth.php?action=signup   User signup
POST auth.php?action=user     User login
POST auth.php?action=login    Admin-only login
GET  auth.php?action=me       Current session
PUT  auth.php?action=profile  Update the current user's name and phone
POST auth.php?action=logout   Logout
```

Navigation uses `resources/js/core/navigation.js` to check the session before enabling protected tabs. The first-load navigation state should come from `auth.php?action=me`, not only from localStorage.

For a signed-in customer, the account menu contains only `Edit Profil` and `Log Keluar`. `Edit Profil` updates the current customer's full name and phone number. The account email is read-only so login identity and historical booking ownership remain stable. Admin accounts see only `Log Keluar`.

## Booking Statuses

The database stores English status values. The UI displays Malay labels.

```text
unpaid     Belum Bayar
pending    Menunggu
approved   Diluluskan
rejected   Ditolak
cancelled  Dibatalkan
```

Availability rules:

```text
Blocks availability:
pending, approved

Does not block availability:
unpaid, rejected, cancelled
```

Business behavior:

- A new booking without a receipt starts as `unpaid` and does not reserve the date.
- A booking with a receipt starts as `pending`, unless another `pending` or `approved` booking already reserves the same facility and date range.
- A reserved date applies only to that facility. Every other available facility can still be booked on the same date.
- Day-based bookings block every date in their selected duration. A 2-day Asrama booking blocks both dates for Asrama only.
- Uploading a receipt from the dashboard changes an `unpaid` booking to `pending` and performs the same conflict check.
- `approved` bookings remain reserved.
- Admin can reject pending bookings. Admins can cancel approved bookings with a required cancellation reason.
- Approval and approved-booking cancellation automatically attempt to notify the assigned facility PIC. Mail problems do not roll back the status change.
- User cancellation changes an `unpaid` or `pending` booking to `cancelled`.
- `rejected` and `cancelled` bookings release the slot but remain in history.
- The API does not permanently delete bookings. `DELETE backend/api/bookings.php?id=...` returns 405.

## Booking Form

The booking form is maintained in:

```text
resources/views/booking/index.html
resources/js/features/booking.js
resources/css/pages/booking.css
```

Name, phone, and email are read-only in the booking form and are filled from the logged-in user profile. The backend ignores submitted identity fields and uses the registered profile values from the session.

Required booking fields include name, email, phone, facility, date, start time, purpose, and participant count. Participant count must be at least 1.

Additional form behavior:

- Start time uses the browser's native time picker with a right-side icon.
- Duration is entered as a whole number with minus/plus controls. Normal facilities use hours; Asrama uses days.
- Duration is placed below start time and participant count uses the full available width.
- Users can add multiple equipment requests and set a quantity for each item.
- Equipment choices are loaded from the selected facility's `equipment_options`, so each facility can expose a different equipment list.
- The selected facility's PIC full name and phone number are shown in the form and remain available in the user dashboard and status details.
- Equipment is stored in `equipment_required` as readable text, for example `Mikrofon x 2, Projektor x 1`.

Receipt uploads accept JPG, PNG, GIF, or PDF up to 5MB.

## Dashboard

The client dashboard is maintained in:

```text
resources/views/dashboard/index.html
resources/js/features/dashboard.js
resources/css/pages/dashboard.css
```

User bookings are loaded from the current session through:

```text
GET backend/api/bookings.php?action=user
```

The list is shown as a table. Users can sort by `Permohonan Terkini` or `Tarikh Terdekat`, search, and filter by status chips. Users can view details, upload receipts for `unpaid` bookings, edit `unpaid` or `pending` bookings, and cancel `unpaid` or `pending` bookings.

Cart submissions are grouped under `TR...` references in the dashboard. Those group references work on the status page and show all bookings in the group.

When all actions are available, the user action order from left to right is:

```text
Muat Naik Resit, Batal, Edit, Lihat
```

Unavailable actions are removed without leaving empty layout slots.

## Admin

The admin dashboard is maintained in:

```text
resources/views/admin/dashboard.html
resources/js/features/admin.js
resources/css/components/admin.css
```

Admin can:

- View recent and all bookings.
- Filter bookings by status.
- Approve `pending` bookings.
- Reject `unpaid`, `pending`, and `approved` bookings.
- View customers and customer booking history.
- Reset/set customer passwords.
- Read customer messages and reply through their email client.
- Add new facilities from the dashboard.
- Add and edit facility-specific equipment options from the facility management panel.
- Add, edit, delete, and assign independent PIC records from the separate `PIC` admin section.
- Assign one PIC to several facilities and change a facility's PIC later.
- Send a manual trial email to a PIC.
- Toggle facility availability.
- View the booking calendar.

The admin sidebar remains pinned while the main content scrolls. Admin booking tables use fixed, readable column widths and horizontally scroll on smaller viewports. Visible actions are grouped without empty slots; pending rows display `Terima`, `Tolak`, then `Lihat`, with `Lihat` on the right.

The admin navbar logo is static and does not navigate to the public site.

## Facilities

Default facilities:

```text
Dewan Utama              RM450  800 orang
Dewan Syarahan           RM400  120 orang
Bilik Persidangan        RM350  60 orang
Bilik Seminar            RM250  45 orang
Makmal Komputer - ILL 1  RM100  50 orang
Asrama - Bilik           RM10   2 orang - 1 bilik
```

Facility cards use `Arial Black` for the facility name. The Asrama capacity label is rendered as `2 orang - 1 bilik`.

For Dewan Utama, Dewan Syarahan, Bilik Persidangan, and Bilik Seminar, the backend forces `setup_required` to `full`.

Admins can add facilities from `Pengurusan Fasiliti` using the dashboard form. Facility cards can also be edited, including their optional `pic_id` assignment and facility-specific equipment options. PIC contact details are stored in the separate `pics` table and managed from the PIC page. The create action calls:

```text
POST backend/api/facilities.php
```

Required facility fields are facility name, capacity, and price. Optional fields include Bootstrap icon class, description, `pic_id`, equipment options, and initial availability. PIC CRUD and multi-facility assignments use `backend/api/pics.php`; trial email calls `POST backend/api/pics.php?action=test-email&id=...`.

## Database

Fresh install:

```powershell
mysql -u root -p < database/polspace.sql
```

Update existing database:

```powershell
mysql -u root -p < database/update_polspace.sql
```

Important booking columns:

```text
booking_ref
user_id
facility_id
booking_date
start_time
end_time
duration
duration_unit
equipment_required
payment_file
status
admin_note
created_at
updated_at
```

Generated columns expose the facility/start-date pair only for `pending` and `approved` rows. Backend range checks prevent overlapping multi-day bookings for the same facility, while any number of `unpaid`, `rejected`, or `cancelled` history rows remain allowed.

Running `database/update_polspace.sql` preserves existing admin passwords, custom facilities, and each facility's current availability setting.

The current UI requires no additional columns beyond `database/polspace.sql` or the current `database/update_polspace.sql`. For an older installation, verify that `bookings.equipment_required` and `facilities.equipment_options` exist before using facility-specific equipment:

```sql
USE polspace;

SELECT COUNT(*) AS equipment_column_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'bookings'
  AND COLUMN_NAME = 'equipment_required';
```

If the result is `0`, run:

```sql
ALTER TABLE bookings
  ADD COLUMN equipment_required TEXT NULL AFTER setup_required;
```

Default facility equipment can be backfilled with:

```powershell
mysql -u root -p < database/facility_equipment_defaults.sql
```

All booking rows can be cleared for a fresh test cycle with:

```powershell
mysql -u root -p < database/clear_bookings.sql
```

## Verification

Run these after changes when PHP and Node are available:

```powershell
Get-ChildItem -Recurse resources/js -Filter *.js | ForEach-Object { node --check $_.FullName }
Get-ChildItem -Recurse backend -Filter *.php | ForEach-Object { php -l $_.FullName }
```

Quick local checks:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost/
Invoke-WebRequest -UseBasicParsing http://localhost/resources/views/welcome.html
Invoke-WebRequest -UseBasicParsing http://localhost/backend/api/facilities.php
```

## Production Notes

Before production use:

- Change the default admin password.
- Same-origin checks protect state-changing browser requests; consider synchronizer CSRF tokens as additional production defense-in-depth.
- Use HTTPS-only cookies.
