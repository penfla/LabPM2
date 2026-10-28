# Contributing

Repository: https://github.com/penfla/labpm · Issues: https://github.com/penfla/labpm/issues

## Principles

1. **No build step, no runtime dependencies.** Server: Node ≥ 22.13 built-ins only (`node:http`, `node:sqlite`, `node:crypto`). Client: one `public/index.html` (HTML + CSS + JS), no bundler or framework.
2. **The server is authoritative.** Permissions (`server/perms.js`), validation (`server/validate.js`) and derived changes — date cascade, automations, overdue (`server/logic.js`) — live on the server; the client only edits fields and renders.
3. **No third-party requests.** The page CSP is `connect-src 'self'`; no CDN fonts or scripts. The server makes no outbound calls.
4. **Deterministic.** No generative-AI calls. If one is ever added, the AI-disclosure text (headers, Info page, README) must switch to the Art. 50 AI Act wording.
5. **Escape everything.** User-controlled text goes through `esc()` before entering `innerHTML`. The markdown renderer `md()` escapes first, then adds tags.
6. **Validate on the server.** Any new persisted field must be added to `server/validate.js` and `docs/DATA_MODEL.md`, and to the Researcher whitelist in `perms.js` if Researchers may edit it.
7. **English UI**, ISO dates internally (`YYYY-MM-DD`), working days = Mon–Fri.

## Dev setup

```bash
git clone https://github.com/penfla/LabPM2.git && cd LabPM2
npm install --no-save playwright   # only for the two-browser test
npx playwright install chromium
npm test            # API, start-up and browser tests
npm start           # http://localhost:8080, data in ./data
```

## Conventions

- Match the surrounding style: ES5-style `var`/`function` in the client and server, terse helpers (`$`, `esc`, `opt`), section banners `/* ---------- name ---------- */`.
- Client actions are registered in `A` (click, `data-act`) and `H` (change, `data-ch`). Mutate state → `save()` → `render*()`; `save()` pushes the diff to the server.
- Keep the license header and info box at the top of every file and the footer in `render()`.
- Add a test for every server rule (`tests/api.test.js`); update `CHANGELOG.md` and the relevant `docs/` page.

## Licensing of contributions

LabPM is licensed under [PolyForm Noncommercial 1.0.0](LICENSE). By submitting a contribution you confirm you have the right to do so and license it to the project under the same terms, and you grant the author the right to relicense it for commercial licensing (penfla@me.com).

---
© Flavio Pendolino, 2026. This document is distributed under the CC BY-NC 4.0 license (https://creativecommons.org/licenses/by-nc/4.0).
