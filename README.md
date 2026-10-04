# PoliSpace

PoliSpace is a facility booking and management system for Politeknik Besut Terengganu, built on Laravel 13, PHP 8.3+, and MySQL/MariaDB. The current browser screens and database schema remain in place while requests are routed through Laravel.

## Current Status

The active project folder in this checkout is:

```text
C:\laragon\www\PoliSpace-master
```

Laravel views are in `resources/views/legacy/`, browser assets are served from `public/resources/`, and routes are in `routes/`. Previous `.html` URLs remain available through Laravel route aliases; root-level HTML redirect files are no longer needed. Existing API handlers remain in `backend/api/` behind Laravel's API router during migration.

## Documentation

- [Code Map](documentation/CODE_MAP.md)
- [Project Documentation](documentation/README.md)
- [Developer Handoff](documentation/HANDOFF.md)
- [Publishing and deployment](documentation/DEPLOYMENT.md)

## Framework and publishing

This project requires Laravel 13 and PHP 8.3 or newer. Install dependencies with `composer install`, configure `.env`, and generate an application key using `php artisan key:generate`. Run `npm install` and `npm run build` to copy browser assets into Laravel's public directory. Point Apache's document root to `public/`. See the [deployment guide](documentation/DEPLOYMENT.md) for Laragon, Docker, and shared-hosting setup.

## Quick Start

```text
C:\laragon\www\PoliSpace-master
http://localhost/
```

Start Laravel's local server after configuring `.env` and importing the database:

```powershell
php artisan serve
```

Import a fresh database:

```powershell
mysql -u root -p < database/polspace.sql
```

Update an existing database without dropping current data:

```powershell
mysql -u root -p < database/update_polspace.sql
```

The institution label, page transitions, calendar loading feedback, and facility-card layout are frontend changes. They do not require a schema migration or changes to existing facility and booking records. The institution label is currently maintained in the page templates, not in a database settings table.

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

PICs are stored independently and assigned to facilities. One PIC can manage several facilities, while each facility has at most one current PIC. Users still see the assigned PIC's full name and phone number. Admins can add, edit, delete, reassign, and send a manual trial email from the PIC page. Approving a pending booking, creating an already approved booking as an admin, and cancelling a previously approved booking notify the PIC inbox without rolling back the status change if mail delivery fails. Booking notifications for all facilities go to `PIC_NOTIFICATION_EMAIL` (currently `izzathanis2409@gmail.com`); clear this setting to use each facility PIC's email instead. Configure `MAIL_MAILER=smtp` and the SMTP host, port, username, password, and sender in the deployment `.env` for delivery. The `log` and `array` mailers do not count as sent.

Admins can open the dedicated `Urus Bilik` page from the `Asrama - Bilik` facility card to set normal male/female limits up to 30 rooms per block. An optional date-based `Mod Cuti Panjang` allows up to 100 rooms per block; the PIC remains responsible for actual room and floor allocation.
