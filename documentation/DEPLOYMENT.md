# Deploy PoliSpace (Laravel 13)

PoliSpace runs on Laravel 13 and PHP 8.3 or newer. The existing MySQL schema and browser screens are retained while the API handlers are moved behind Laravel routing. The Laravel web root is `public/`; keep `.env`, `backend/`, `database/`, `storage/`, and `vendor/` outside the public document root.

## Local setup with Laragon

1. Start Apache and MySQL in Laragon, then open a terminal in the project folder.
2. Install dependencies with `composer install`.
3. Run `npm install` and `npm run build` to copy the existing CSS, JavaScript, image, and favicon files into `public/resources/`.
4. Copy `.env.example` to `.env`. Set `APP_URL` to the local project URL and set `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASS` for your Laragon database. The Laravel `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` settings are already mapped from those legacy names when `.env` is first created; keep both sets in sync if you change credentials.
5. Generate the Laravel encryption key with `php artisan key:generate`.
6. Import `database/polspace.sql` for a new database, or apply the reviewed update script to an existing installation.
7. Set the Apache virtual host document root to this project's `public/` directory. The root `.htaccess` forwards requests into Laravel as a convenience for Laragon's default project-root host; use `public/` directly for production.

The legacy API URLs remain available through Laravel's API router so the current browser code and native PHP session behavior continue to work during the migration. Uploaded receipts remain under `uploads/payments/`.

## Docker on a VPS

1. Copy `.env.example` to `.env`. Set a public HTTPS `APP_URL`, unique strong `DB_PASS` and `MYSQL_ROOT_PASSWORD` values, and `APP_DEBUG=false`.
2. Generate a unique Laravel key with `php artisan key:generate` before building the container. Keep that same `APP_KEY` for later releases so encrypted application data remains readable.
3. Start with `docker compose up -d --build`. The app container serves Laravel from `public/` and binds to `127.0.0.1:8080` by default; the database is not published to the internet.
4. Put an HTTPS reverse proxy in front of the local app port and forward the public host and `X-Forwarded-Proto: https`.
5. Create an admin account or promote a trusted account in the database, then confirm sign-in, bookings, and receipt downloads.

The first database initialization imports `database/polspace.sql`. Initialization scripts run only while the database volume is empty. Back up the `database_data` and `payment_uploads` volumes before upgrades.

## Apache or cPanel

Use PHP 8.3 or newer with `pdo_mysql`, the Laravel-required extensions, Composer 2, Node.js/npm, and MySQL/MariaDB. Configure the site's document root to `public/`; do not point it at the repository root. Upload the application, install production Composer dependencies, run `npm install` and `npm run build`, and create `.env` outside the public folder. For shared hosting, set `DB_CONNECTION=mysql`, `DB_HOST` to the database host shown by Ryze, and the full account-prefixed `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` values shown in cPanel's MySQL section. The legacy API also accepts `DB_NAME`, `DB_USER`, and `DB_PASS`; no secret values should be added to source control. Keep `CACHE_STORE=file` (the project pins Laravel's default cache store to files, because the existing schema has no Laravel cache table). Import the existing SQL schema before using the application. Keep `APP_DEBUG=false`, use HTTPS, and ensure `storage/`, `bootstrap/cache/`, and `uploads/payments/` are writable by PHP.

To deliver booking confirmations to the PIC inbox, set `PIC_NOTIFICATION_EMAIL=izzathanis2409@gmail.com` and configure `MAIL_MAILER=smtp`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_SCHEME`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`, and `MAIL_FROM_NAME` in the server's private `.env`. Use a sender address authorized by the SMTP provider. Run `php artisan config:clear` after changing mail settings if the deployment caches Laravel configuration. A successful admin approval or direct approved booking then sends to the PIC inbox; a failed send leaves the booking approved and shows an admin warning.

## Release checklist

### Booking checks on Ryaze

The published API can return HTTP 404 with a valid JSON body even for successful GET requests. Check the JSON `success` value as well as the HTTP status. Ryaze can pass browser POST requests to Laravel as GET and omit multipart form fields. The shared API client sends `X-HTTP-Method-Override`; booking creation and receipt uploads send JSON, with receipts base64 encoded and validated server side. Deploy updated `backend/`, `public/resources/js/`, and matching page templates together. The host must accept request bodies of at least 7 MB for the allowed 5 MB receipt size.

Before importing SQL into an existing site, check the connected database with `SHOW TABLES LIKE 'bookings';` and inspect the server error log. A working `bookings.php?action=public-stats` response confirms the booking handler can query its table; a failed booking submission alone does not show that the table is missing. Back up production data before applying `database/update_polspace.sql`.

- Run `composer install --no-dev --optimize-autoloader` for production.
- Run `npm install` and `npm run build` after changing frontend assets.
- If an older deployment has cached the previous database cache setting, run `php artisan config:clear` before `php artisan cache:clear`; then refresh it with `php artisan config:cache` if your release process uses cached configuration.
- Keep the current `APP_KEY` and production database credentials private.
- Back up the database and receipt uploads before applying schema updates.
- Verify the web server's document root is `public/` and that receipt uploads cannot execute as scripts.
- Configure outbound mail if booking notifications are required.
