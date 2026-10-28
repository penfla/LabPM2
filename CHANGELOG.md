# Changelog

## 2.0.0-beta.2 (unreleased)
- New: **shared-folder mode**: the same `index.html` runs without any server on a shared network folder (Chrome/Edge): per-device operation logs merged per field (`shared/fold.js`), name-based identity, attachments, daily backups, import/export. Mode is detected automatically.
- Change: `logic.js` and `validate.js` moved to `shared/` and inlined into the page by `tools/inline.js` (`npm run inline`); a test guards against drift.
- New: zero-configuration start (`start.bat` / `start.sh`); single setting `dataDir` in `labpm.config.json`; LAN addresses printed at start; single-instance lock; rollback-journal SQLite (safe on network shares); automatic daily backup (14 kept).
- New: date cascade, automations, blocked-status check, timer stop on Done and overdue sweep run on the server in the mutation transaction (removed from the client; `notify` actions reach all sessions).
- New: backup list/create/restore in the UI (Admin), with automatic pre-restore copy.
- Docs: USER_GUIDE, SECURITY, CONTRIBUTING rewritten for v2; new `docs/MIGRATION.md`.
- New: attachments stored on the server (`attachments/`, 25 MB default limit, sanitised names, authenticated download, removed with the task).
- New: central server (Node 22, `node:sqlite` WAL, zero runtime dependencies).
- New: local accounts (scrypt), HttpOnly/SameSite=Strict session cookie, login throttling.
- New: role matrix enforced server-side (Admin / Project manager / Researcher / Viewer).
- New: REST CRUD for `users projects tasks fields rules goals docs files`, per-record `rev`, `If-Match` → 409 with current record, field-level `PATCH`.
- New: SSE change feed (`/api/events`, replay via `Last-Event-ID`), audit trail (`/api/audit`).
- New: v1 session import / full export (Admin).
- New: browser client wired to the server (login, live sync, field-level merge, Admin account/password management, server export/import). Removed: backup folder, browser snapshots, local attachments, user switcher, external Google Fonts.
- Client derived from LabPM v1.3.0 (https://github.com/penfla/LabPM); this repository is self-contained.

---
© Flavio Pendolino, 2026. This document is distributed under the CC BY-NC 4.0 license (https://creativecommons.org/licenses/by-nc/4.0).
