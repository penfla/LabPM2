# Security

Author: Flavio Pendolino · Version: 2.0.0-beta.1 · License: PolyForm Noncommercial 1.0.0 · Commercial use: penfla@me.com

## Scope

LabPM 2 is a Node.js server (built-ins only, no npm runtime dependencies) with a single-page client. The server makes no outbound connections; the page loads nothing from third parties (system fonts, CSP `connect-src 'self'`).

| Surface | Mitigation |
|---|---|
| Authentication | Local accounts; scrypt (N=32768, 16-byte salt, constant-time compare); session token 256-bit random, stored server-side only as SHA-256, cookie `HttpOnly; SameSite=Strict` (+`Secure` with `COOKIE_SECURE=1`), 12 h lifetime; password ≥ 10 characters; login throttling 10 failures / 15 min per IP+username; password reset by Admin revokes that user's sessions |
| Authorisation | Role matrix enforced in `server/perms.js` on every write (Researcher limited to a whitelist of fields on own tasks); Viewer read-only; users, import/export, backups and restore Admin only; the last Admin cannot be deleted or demoted |
| CSRF | SameSite=Strict cookie, JSON-only mutations (`Content-Type: application/json` required), no CORS headers |
| Input validation | `server/validate.js` whitelists enumerations, ISO dates, id pattern `^[A-Za-z0-9_-]{1,40}$`, string lengths, array sizes; bodies ≤ 5 MB (import ≤ 50 MB); parameters bound in SQL, no string-built queries |
| Stored XSS | All dynamic strings pass through `esc()` in the client; Markdown-lite emits only a fixed tag set; `http(s)` links only with `rel="noopener"`; CSP `default-src 'none'` in the page, `default-src 'self'` header on static files, `frame-ancestors 'none'` |
| Formula fields | Recursive-descent arithmetic parser; no `eval` / `Function` |
| Attachments | Streamed to `attachments/<random id>` (the user-supplied name is only metadata, sanitised); size cap; downloads authenticated and always `application/octet-stream` + `Content-Disposition: attachment` + `nosniff`; Researcher uploads only to own tasks |
| Backups / restore | Backup names validated against a fixed pattern (no path traversal); restore opens the copy read-only, saves a `pre-restore` copy first, replaces data in one transaction and revokes all sessions |
| Concurrency | Per-record revisions (`If-Match` → 409); every mutation (including cascade and automations) is one SQLite transaction; single server per data folder (lock file) |
| Audit | `events` table: user, collection, id, operation, revision, timestamp (`/api/audit`, Admin / Project manager) |

## What it is not

- **No transport encryption by default.** On a LAN the server speaks HTTP: passwords and data cross the network in clear text. For sensitive or NDA data put a TLS reverse proxy in front (Caddy https://caddyserver.com, nginx) and set `COOKIE_SECURE=1`, or restrict access with a VPN.
- **No encryption at rest.** `labpm.sqlite`, `attachments/` and `backups/` are plain files: protect the data folder with operating-system or share permissions. Anyone who can read the folder can read all data and the password hashes.
- **Not a GxP/21 CFR Part 11 system.** There are no electronic signatures and the audit trail is not tamper-evident; the Admin can restore or edit data.
- Run exactly one server per data folder on storage that honours file locking.

## Reporting a vulnerability

Email penfla@me.com with subject `LabPM security`, including version, steps and a minimal example. Please do not open a public issue for exploitable findings. Expect an acknowledgement within 7 days.

---
© Flavio Pendolino, 2026. This document is distributed under the CC BY-NC 4.0 license (https://creativecommons.org/licenses/by-nc/4.0).
