# LabPM 2

Multi-user project, task and request manager for chemical/polymer laboratories. Server: Node ≥ 22.13 + SQLite. Status: **2.0.0-beta.2**. Self-contained repository; client derived from LabPM v1.3 (https://github.com/penfla/LabPM).

## Two ways to run it (same `index.html`)

| | A. HTML only, shared folder | B. Server |
|---|---|---|
| Install | none: copy `public/index.html` anywhere and open it in Chrome or Edge | Node.js ≥ 22.13 on one PC/server (IT approval once) |
| Users | pick their name (no passwords) | real accounts, roles enforced by the server |
| Data | files in a shared network folder | `labpm.sqlite` in the data folder |
| Updates seen by others | every ~4 s | immediately |
| Date cascade / automations | in each browser | on the server |
| Security | **none** beyond folder permissions | login, roles, audit |

The page detects the mode: if the LabPM server answers it uses the server, otherwise it asks for the shared folder.

### A. HTML only (no install, no admin rights)
1. Put `index.html` on the network drive (or open it from your PC) and open it in **Chrome or Edge** as a file (`file:///…` or a mapped drive) or from an https address.
2. Click *Select folder…* and choose the shared LabPM folder (create an empty one; everyone selects the same folder). The browser asks once for read/write permission, and again after a restart (*Reconnect folder*).
3. First PC: create the Admin (your name). Others: choose their name or *I am new here*.

The folder gets `log/` (one log file per PC), `attachments/`, `backups/` (daily JSON copy, last 14) and `meta.json`. Limits: Chrome/Edge only; no real access control (anyone with the folder can read and edit everything); latency ~4 s; two people changing the *same field* of the same record within seconds: the later one wins; do not edit the files by hand. Details: `docs/ARCHITECTURE.md`, `SECURITY.md`.

### B. Server (login, roles, instant updates)
1. Install Node.js ≥ 22.13 (https://nodejs.org) on one PC or server that stays on.
2. Optional: edit `labpm.config.json` and set `"dataDir"` to the folder that will hold everything (e.g. `"D:\\labpm-data"` or a LAN share `"\\\\NAS\\labpm"`). Empty = `./data`.
3. Run `start.bat` (Windows) or `./start.sh`. The console prints the addresses, e.g. `http://192.168.1.20:8080`: open it from any PC on the LAN.
4. First visit: create the Admin account; add colleagues in Settings → Users and roles.

The data folder holds `labpm.sqlite`, `attachments/` and `backups/` (automatic copy at every start and daily at 03:00, last 14 kept). Only one server may use a folder (lock file); everyone else connects with the browser. Other options: `PORT`, `MAX_UPLOAD_MB` (default 25), `docker compose up -d` with `LABPM_DATA=/path`.

```bash
npm test                # API, merge, start-up and browser tests (browser tests need `playwright`)
npm run inline          # after editing shared/*.js: re-embed them in public/index.html
```

 Details: `docs/USER_GUIDE.md`, `docs/ARCHITECTURE.md`, `docs/MIGRATION.md` (from v1.3), `SECURITY.md`, `CHANGELOG.md`.

Author: Flavio Pendolino · License: PolyForm Noncommercial 1.0.0 (https://polyformproject.org/licenses/noncommercial/1.0.0) · Commercial use: penfla@me.com
Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).

© 2026 Flavio Pendolino | PolyForm Noncommercial 1.0.0
