# PoliSpace

PoliSpace is a Laragon-based facility booking system for Politeknik Besut. It uses HTML, CSS, JavaScript, PHP APIs, and MySQL.

## Current Status

The active project folder in this checkout is:

```text
C:\laragon\www\PoliSpace-master
```

Root HTML files are compatibility redirects. The maintained pages live in `resources/views/`, with shared browser code in `resources/js/` and PHP API endpoints in `backend/api/`.

## Documentation

- [Code Map](CODE_MAP.md)
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
