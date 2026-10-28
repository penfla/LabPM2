> **v2.0 status:** this text was written for v1.3 (standalone). Sections on browser storage, backup folder, snapshots, attachments in a local folder and simulated roles no longer apply; see `ARCHITECTURE-v2.md` and `CHANGELOG.md`.

# Security

## Scope

LabPM is a client-side single-page app. It has no server, no accounts, no network connections of its own (CSP `default-src 'none'`; only Google Fonts CSS/fonts are allowed).

| Surface | Mitigation |
|---|---|
| Stored XSS via task titles, notes, documents, field values | All dynamic strings pass through `esc()`; Markdown-lite renderer escapes first and only emits `<h3–h5>, <p>, <ul>/<li>, <b>, <code>, <a>`; links are limited to `http(s)://` with `rel="noopener"` |
| Malicious session file / pasted JSON | `normSession()` validates schema version, array sizes (≤ 5000), ID pattern `^[A-Za-z0-9_-]{1,40}$`, ISO dates, enumerations; coerces all strings; file size ≤ 5 MB; automatic snapshot before replacement |
| Formula fields | Recursive-descent arithmetic parser (`+ - * / ()`, numbers); no `eval` / `Function` |
| Backup folder | Requires a user gesture and the browser's own read/write permission prompt; the app only creates/overwrites files with its own fixed names (`labpm-*.json`) and never reads or lists the folder; handle kept in IndexedDB |
| Attachments | Stored paths are re-validated (`attachments/` prefix, no `.`/`..`/empty segments) before any folder access; names are sanitised; files are only created, never overwritten or deleted by the app. Opened via blob URL in a new tab or downloaded; no content is parsed or executed by LabPM. Treat attachments as untrusted files (macro-enabled Office files, etc.) |
| Exfiltration | CSP blocks `connect-src`, images (except `data:`), frames, forms |

## What it is not

- **Roles are not access control.** The user switcher is a UI aid. Anyone with access to the browser profile can read/modify all data, and can edit `localStorage` directly.
- Data is stored unencrypted in the browser. Do not store confidential/NDA data on shared machines. Session files and backup-folder files (`labpm-initial-*`, `labpm-autosave.json`, `labpm-copy-*`) are plain JSON: choose a folder with appropriate access control; for cloud-synced folders check your NDA/data-transfer rules.

## Reporting a vulnerability

Email penfla@me.com with subject `LabPM security`, including browser, steps and a minimal session file. Please do not open a public issue for exploitable findings. Expect an acknowledgement within 7 days.

---
© Flavio Pendolino, 2026. This document is distributed under the CC BY-NC 4.0 license (https://creativecommons.org/licenses/by-nc/4.0).
