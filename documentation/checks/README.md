# Project checks

These development scripts detect regressions. They are not loaded by PoliSpace and do not add a frontend build step.

Run all checks from the project root while Laragon is running:

```powershell
powershell -ExecutionPolicy Bypass -File documentation/checks/smoke.ps1
```

- `smoke.ps1` checks PHP/JavaScript syntax, local page/API availability, access restrictions, runs all JavaScript behaviour tests, and exercises backend booking validation using isolated fixtures.
- The JavaScript tests cover navigation, grouped-table animations, filtering, report updates, booking forms, authentication helpers, async refreshes and keyboard behaviour. They use isolated fixtures and do not change real bookings or send notifications.
- `backend_booking_regression.php` exercises booking, status-transition, facility and room validation without connecting to the application database.
- `api-integration.ps1` runs the broader live API suite against a uniquely named disposable database and local PHP server. It is kept separate from `smoke.ps1` because it provisions its own isolated database.

To run only the JavaScript tests (no server required):

```powershell
node --test documentation/checks/workspace.test.js documentation/checks/accounts-functions.test.js documentation/checks/admin-functions.test.js documentation/checks/customer-functions.test.js
```
