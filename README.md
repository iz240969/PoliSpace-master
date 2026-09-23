# PoliSpace

PoliSpace is a Laragon-based facility booking system for Politeknik Besut. It uses HTML, CSS, JavaScript, PHP APIs, and MySQL.

## Current Status

The active project folder in this checkout is:

```text
C:\laragon\www\PoliSpace-master
```

Root HTML files are compatibility redirects. The maintained pages live in `resources/views/`, with shared browser code in `resources/js/` and PHP API endpoints in `backend/api/`.

## Documentation

- [Code Map](documentation/CODE_MAP.md)
- [Project Documentation](documentation/README.md)
- [Developer Handoff](documentation/HANDOFF.md)

## Quick Start

```text
C:\laragon\www\PoliSpace-master
http://localhost/
```

Run verification after changes:

```powershell
Get-ChildItem -Recurse resources/js -Filter *.js | ForEach-Object { node --check $_.FullName }
Get-ChildItem -Recurse backend -Filter *.php | ForEach-Object { php -l $_.FullName }
```

Run the repeatable application smoke checks while Laragon is active:

```powershell
powershell -ExecutionPolicy Bypass -File tests/smoke.ps1
```

Import a fresh database:

```powershell
mysql -u root -p < database/polspace.sql
```

Update an existing database without dropping current data:

```powershell
mysql -u root -p < database/update_polspace.sql
```

## Current Booking Rules

PoliSpace keeps all booking records for history. Bookings are never permanently deleted by the API.

Only these statuses block facility availability:

```text
pending   = Menunggu
approved  = Diluluskan
```

These statuses do not block availability:

```text
unpaid     = Belum Bayar
rejected   = Ditolak
cancelled  = Dibatalkan
```

An unpaid booking does not reserve the date. The date is secured only when a receipt is uploaded and the booking becomes `pending`, unless another `pending` or `approved` booking already reserves that same facility and date range. Other facilities remain available on that date.

Day-based Asrama bookings consume the requested male/female room quantities on every date in their selected duration. Only `pending` and `approved` bookings count toward this quota.

PICs are stored independently and assigned to facilities. One PIC can manage several facilities, while each facility has at most one current PIC. Users still see the assigned PIC's full name and phone number. Admins can add, edit, delete, reassign, and send a manual trial email from the PIC page. Approving a pending booking and cancelling a previously approved booking also notify the assigned PIC without rolling back the status change if mail delivery fails.

Admins can open the dedicated `Urus Bilik` page from the `Asrama - Bilik` facility card to set normal male/female limits up to 30 rooms per block. An optional date-based `Mod Cuti Panjang` allows up to 100 rooms per block; the PIC remains responsible for actual room and floor allocation.
