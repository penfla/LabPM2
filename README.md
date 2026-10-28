# LabPM 2

Multi-user project, task and request manager for chemical/polymer laboratories. Server: Node ≥ 22.13 + SQLite. Status: **2.0.0-alpha.1**. Self-contained repository; client derived from LabPM v1.3 (https://github.com/penfla/LabPM).

```bash
npm test                # API integration tests + Playwright two-browser test (needs `playwright`)
npm start               # http://localhost:8080 (data in ./data)
docker compose up -d    # same, data in volume labpm-data
```
First run: open the page and create the Admin; then add accounts in Settings. Details: `docs/ARCHITECTURE-v2.md`, `CHANGELOG.md`.

Author: Flavio Pendolino · License: PolyForm Noncommercial 1.0.0 (https://polyformproject.org/licenses/noncommercial/1.0.0) · Commercial use: penfla@me.com
Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).

© 2026 Flavio Pendolino | PolyForm Noncommercial 1.0.0
