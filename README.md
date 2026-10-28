# LabPM 2

Multi-user project, task and request manager for chemical/polymer laboratories. Server: Node ≥ 22.13 + SQLite. Status: **2.0.0-beta.1**. Self-contained repository; client derived from LabPM v1.3 (https://github.com/penfla/LabPM).

## Quick start (no configuration beyond the data folder)
1. Install Node.js ≥ 22.13 (https://nodejs.org) on one PC or server that stays on.
2. Optional: edit `labpm.config.json` and set `"dataDir"` to the folder that will hold everything (e.g. `"D:\\labpm-data"` or a LAN share `"\\\\NAS\\labpm"`). Empty = `./data`.
3. Run `start.bat` (Windows) or `./start.sh`. The console prints the addresses, e.g. `http://192.168.1.20:8080`: open it from any PC on the LAN.
4. First visit: create the Admin account; add colleagues in Settings → Users and roles.

The data folder holds `labpm.sqlite`, `attachments/` and `backups/` (automatic copy at every start and daily at 03:00, last 14 kept). Only one server may use a folder (lock file); everyone else connects with the browser. Other options: `PORT`, `MAX_UPLOAD_MB` (default 25), `docker compose up -d` with `LABPM_DATA=/path`.

```bash
npm test                # API, start-up and two-browser tests (browser test needs `playwright`)
```

 Details: `docs/ARCHITECTURE-v2.md`, `CHANGELOG.md`.

Author: Flavio Pendolino · License: PolyForm Noncommercial 1.0.0 (https://polyformproject.org/licenses/noncommercial/1.0.0) · Commercial use: penfla@me.com
Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).

© 2026 Flavio Pendolino | PolyForm Noncommercial 1.0.0
