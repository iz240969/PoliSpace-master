# Disposable API integration checks

Run the broad live API suite from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File documentation/checks/api-integration.ps1
```

The runner copies `backend`, `resources`, and the root HTML entry files into a uniquely named directory under the operating system temp folder. It creates a new MySQL database named `codex_polispace_audit_<timestamp>_<pid>`, imports a filtered copy of `database/polspace.sql`, seeds test-only accounts, binds PHP to an available `127.0.0.1` port, and runs `api-integration.test.js` with Node's built-in test runner.

Safety controls:

- The copied `.env` must contain the generated database name and a loopback `APP_URL` before any database is created.
- The generated database name must match the strict `codex_polispace_audit_...` pattern and must differ from the source `.env` database.
- MySQL credentials are read into a private temp option file and are never printed or passed to the Node tests.
- Native PHP `mail()` is disabled. An auto-prepended local stub records messages only in the temp mailbox; a probe must confirm the stub before the server starts.
- PHP sessions, uploaded receipts, logs, copied source, and the mailbox stay inside the verified task-prefixed temp directory.
- Cleanup stops only the PHP process started by the runner, drops only the exact generated database, and removes only the verified temp directory.

The suite covers authentication and roles, profile updates, customer administration and staff verification, facilities and PIC management, safe mail recording, contact messages, booking lifecycle and conflicts, receipt ownership, late receipt upload, public calendar and reports, and Asrama normal/holiday capacity boundaries.
