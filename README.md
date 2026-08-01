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

An unpaid booking does not reserve the slot. The slot is secured only when a receipt is uploaded and the booking becomes `pending`, unless another `pending` or `approved` booking already overlaps the same facility/date/time.
