# Changelog

## 2.0.0-beta.5 (unreleased)
- Layout: brand subtitle is just the version; **Settings page** (gear icon in the top bar) with tabs *Settings*, *Data & sync*, *Templates*, *Info & license* replaces the System menu and the Templates entry; the rail is Dashboard · Team progress · Projects (submenu Tasks) · Files · Requests · Automations · Documents.
- Planning scheme **Project → Task → Activity**: *Portfolio* became **Projects**; click a project to open its tasks and activities (tick, add task, add activity inline); the Goals box was removed. Quick add: indented lines are activities (no subtasks, no `~hours`) and the new project opens afterwards.
- Task window: no estimated hours, subtasks, dependencies, time or template steps; activities offer a drop-down of previously used activities. Subtask creation was removed from the UI (existing subtasks still work).
- Files: each uploaded file gets a display name (`title`, empty = file name) chosen in a staging list before upload (page and task window; server and shared-folder mode).
- Team progress: *Progress by person* shows tasks, activities, open and overdue only (hours columns removed); the menu sits under Dashboard.

## 2.0.0-beta.4
- New: **subtasks** (`parent`, one level) and **activities** (`checklist`, tickable, records who/when). A task with subtasks follows them (dates span, status rolls up; closing it closes them) in the shared logic, so server and shared-folder mode behave the same. Subtasks are deleted with their parent and move with it between projects.
- New: tick boxes for tasks/subtasks in the list, task panel and **Team progress**; per-person progress (tasks, activities, hours, overdue) page and dashboard widget; tasks are counted at the lowest level in all indicators.
- New: **Quick add** outline (`# project`, tasks, indented subtasks, `- activities`, `@person #days ~hours !priority start: due:`) replaces the old “Create tasks from a list”; subtask / activity quick entry with Enter in the task panel.
- Permissions: Researchers tick activities and add/remove subtasks on their own tasks (server-enforced). Excel export gains *Parent* and *Activities* columns.
- Fix: server stores `parent`/`checklist` defaults for tasks created before this version (no revision change).

## 2.0.0-beta.3
- New: `tools/migrate-v1.js` (`npm run migrate -- …`): converts a v1.3 / Italian-prototype session file, validates it with the server rules and reports skipped records; with `--server` it imports into a running v2 server, matches people to accounts by display name and uploads attachments from the v1.3 backup folder. `docs/MIGRATION.md` rewritten as a full guide (routes, mapping table, checks, rollback, troubleshooting).
- **License: Apache License 2.0** (was PolyForm Noncommercial 1.0.0) for code and documentation of this repository, including commercial use. `LICENSE` is the Apache-2.0 text, `NOTICE` carries the attribution; file headers use `SPDX-License-Identifier: Apache-2.0`; contributions are accepted under the same terms. LabPM 1.3 (https://github.com/penfla/LabPM) is unaffected.
- New: **shared-folder mode**: the same `index.html` runs without any server on a shared network folder (Chrome/Edge): per-device operation logs merged per field (`shared/fold.js`), name-based identity, attachments, daily backups, import/export. Mode is detected automatically.
- New: Firefox and Safari: server mode works in any browser; shared-folder mode opens read-only there (no File System Access API). Browser e2e test now runs on Chromium, Firefox and WebKit when installed (CI installs all three).
- Fix: shared-folder mode re-checks an apparently empty folder (up to ~3 s) before offering to create the first Admin, and warns to reload if colleagues already use the folder (stale directory listings on network shares).
- New: templates are editable data (new collection `templates`): edit, duplicate, delete, create; the five built-ins are seeded once and can be changed or deleted. Templates can be applied to a new or existing project and to a single task (after / before / independent). Server, shared-folder mode and import/export handle the new collection.
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
© Flavio Pendolino, 2026. This document is licensed under the Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0).
