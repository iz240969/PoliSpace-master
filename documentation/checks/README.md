# Project checks

These development scripts detect regressions. They are not loaded by PoliSpace and do not add a frontend build step.

Run all checks from the project root while Laragon is running:

```powershell
powershell -ExecutionPolicy Bypass -File documentation/checks/smoke.ps1
```

- `smoke.ps1` checks PHP/JavaScript syntax, local page/API availability, access restrictions, and runs the JavaScript behaviour tests.
- `workspace.test.js` tests navigation, grouped-table animations, filtering, report updates and keyboard behaviour using isolated fixtures. It does not change real bookings or send notifications.

To run only the JavaScript tests (no server required):

```powershell
node --test documentation/checks/workspace.test.js
```
