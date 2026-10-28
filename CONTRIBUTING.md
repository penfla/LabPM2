# Contributing

Repository: https://github.com/penfla/labpm · Issues: https://github.com/penfla/labpm/issues

## Principles

1. **One file.** The app is `index.html` (HTML + CSS + JS). No bundler, no framework, no build step.
2. **No runtime network calls.** The only external resource is the optional Google Fonts stylesheet. The CSP meta forbids `connect-src`; keep it that way.
3. **Deterministic.** No generative-AI calls. If one is ever added, the AI-disclosure text (header, Info page, README) must switch to the Art. 50 AI Act wording.
4. **Escape everything.** User-controlled text goes through `esc()` before entering `innerHTML`. The markdown renderer `md()` escapes first, then adds tags.
5. **Validate imports.** Any new persisted field must be handled in `normSession()`.
6. **English UI**, ISO dates internally (`YYYY-MM-DD`), working days = Mon–Fri.

## Dev setup

```bash
git clone https://github.com/penfla/labpm.git && cd labpm
npm install
npx playwright install chromium
npm test            # smoke tests
npm start           # http://localhost:8080
```

## Conventions

- Match the surrounding style: ES5-style `var`/`function` expressions, terse helpers (`$`, `esc`, `opt`), section banners `/* ---------- name ---------- */`.
- Actions are registered in `A` (click, `data-act`) and `H` (change, `data-ch`). Mutate state → `save()` → `render*()`.
- Keep the license header and info box at the top of `index.html` and the footer in `render()`.
- Update `CHANGELOG.md` and the relevant `docs/` page.

## Licensing of contributions

LabPM is licensed under [PolyForm Noncommercial 1.0.0](LICENSE). By submitting a contribution you confirm you have the right to do so and license it to the project under the same terms, and you grant the author the right to relicense it for commercial licensing (penfla@me.com).

---
© Flavio Pendolino, 2026. This document is distributed under the CC BY-NC 4.0 license (https://creativecommons.org/licenses/by-nc/4.0).
