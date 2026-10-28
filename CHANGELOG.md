# Changelog

## 2.0.0-alpha.1 (unreleased)
- New: central server (Node 22, `node:sqlite` WAL, zero runtime dependencies).
- New: local accounts (scrypt), HttpOnly/SameSite=Strict session cookie, login throttling.
- New: role matrix enforced server-side (Admin / Project manager / Researcher / Viewer).
- New: REST CRUD for `users projects tasks fields rules goals docs files`, per-record `rev`, `If-Match` → 409 with current record, field-level `PATCH`.
- New: SSE change feed (`/api/events`, replay via `Last-Event-ID`), audit trail (`/api/audit`).
- New: v1 session import / full export (Admin).
- Not yet: client sync layer, server-side cascade/automations, attachments, scheduled backup. See `docs/ARCHITECTURE-v2.md`.
- Client in `public/index.html` is still the v1.3.0 standalone page (baseline from https://github.com/penfla/LabPM).

---
© Flavio Pendolino, 2026. This document is distributed under the CC BY-NC 4.0 license (https://creativecommons.org/licenses/by-nc/4.0).
