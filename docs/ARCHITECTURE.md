# LabPM v2 — architecture (alpha)

Author: Flavio Pendolino · Version: 2.0.0-beta.1 · License: PolyForm Noncommercial 1.0.0 · Commercial use: penfla@me.com
Purpose: central multi-user server for LabPM (option C). Method: Node.js built-ins + SQLite. Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
Third-party components: none at runtime (Node.js ≥ 22.13: `node:http`, `node:sqlite`, `node:crypto`). Reference baseline: https://github.com/penfla/LabPM (v1.3.0).

## Decisions (confirmed)
| Topic | Decision |
|---|---|
| Scale / host | ≤ 20 concurrent users, one lab server, Docker Compose + TLS reverse proxy (Caddy https://caddyserver.com / nginx) |
| DB | SQLite WAL, one `entities(kind,id,data JSON,rev)` table keeps schema v1 of `DATA_MODEL.md`; PostgreSQL out of scope |
| Auth | local users, scrypt (N=32768) from `node:crypto`; OIDC deferred (v2.1). Deviation from the argon2id proposal: avoids a native dependency |
| Logic | cascade, automations, blocked-status check, timer stop and overdue sweep run server-side in the mutation transaction (`server/logic.js`); derived events carry no client id so the originating client applies them |
| Standalone | v1.3 stays in https://github.com/penfla/LabPM; this repo is server-only |

## API (all JSON, cookie `labpm_sid`; mutations require `Content-Type: application/json`)
| Endpoint | Role | Notes |
|---|---|---|
| `GET /api/status` | public | `{setup}`: true until first Admin exists |
| `POST /api/setup` | public, once | creates first Admin |
| `POST /api/login` `/logout` `/password`, `GET /api/me` | any | 10 failures / 15 min / IP+user → 429 |
| `POST /api/accounts` | Admin | `{username,password≥10,name,role,cap}` |
| `GET /api/state` | any | `{state(v1 shape), revs, seq}` |
| `GET /api/events` | any | SSE `change` events `{seq,user,kind,id,op,rev,data}`; replay with `Last-Event-ID` |
| `POST /api/{kind}` · `GET/PUT/PATCH/DELETE /api/{kind}/{id}` | per matrix | `If-Match: <rev>` → 409 + `current`; PATCH without it merges per field |
| `POST /api/files?name=&taskId=&projectId=` · `GET /api/files/{id}/download` | per matrix | raw body upload (≤ 25 MB), authenticated download; record via `GET/DELETE /api/files/{id}` |
| `GET/POST /api/backups`, `POST /api/backups/restore` | Admin | list / create now / restore `{name}` (saves a pre-restore copy, revokes all sessions) |
| `GET /api/audit` | Admin, PM | who/what/when |
| `GET /api/export`, `POST /api/import` | Admin | v1 JSON; imported users have no login; imported Admins become Viewer; timers dropped |

Researcher on own tasks may change: `status notes est tags cf log timer priority`; may submit intake requests (`src:"form"`, `Triage`).

## Roadmap
1. ✅ server, auth, RBAC, rev/409, SSE, import/export, tests
2. ✅ client sync layer (`public/index.html`): login/first-run screens, `GET /api/state`, diff-based push of local edits, 409 → per-field merge + retry, SSE with replay, deferred re-render while typing, Playwright two-browser test
3. ✅ server-side cascade, automations, overdue sweep (`server/logic.js`)
4. ✅ attachments on disk, ✅ daily backup
5. ✅ backup restore from the UI, v1→v2 guide (`MIGRATION.md`), USER_GUIDE and SECURITY rewritten

## Known limitations (beta.1)
- No offline mode: edits made while the server is unreachable stay in the open page and are retried; closing the page loses them (the browser warns).
- Activity log shows only changes received during the session; the authoritative trail is `/api/audit`.
- HTTP only on the LAN by default; for HTTPS put Caddy/nginx in front and set `COOKIE_SECURE=1`.
- Backups contain the database and accounts, not attachment files: copy the whole data folder for a complete backup.
- Keep the data folder on storage that honours file locking; run exactly one server per folder.

---
© Flavio Pendolino, 2026. This document is distributed under the CC BY-NC 4.0 license (https://creativecommons.org/licenses/by-nc/4.0).
