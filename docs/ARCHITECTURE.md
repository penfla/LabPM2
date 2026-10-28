> **v2.0 status:** this text was written for v1.3 (standalone). Sections on browser storage, backup folder, snapshots, attachments in a local folder and simulated roles no longer apply; see `ARCHITECTURE-v2.md` and `CHANGELOG.md`.

# Architecture

Source of truth: [`index.html`](../index.html) (~135 kB, one IIFE, `'use strict'`).

## 1. Layout of the file

| Block | Content |
|---|---|
| Header comment | License identifier, info box, AI disclosure |
| `<meta http-equiv="Content-Security-Policy">` | `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; img-src data:; base-uri 'none'; form-action 'none'` |
| `<style>` | CSS custom properties (light + dark via `prefers-color-scheme` and `data-theme`), grid shell, components |
| `<script>` | Constants → date utils → state (`seed`, `normSession`, `load/save`) → domain logic → HTML builders per view → `A`/`H` handlers → event delegation → boot |

## 2. State and rendering

- Global `S` (single object) → `localStorage['labpm_v1']` on every mutation (`save()`).
- No virtual DOM: `render()` rebuilds the shell; `renderBody()` rebuilds `#vb`; `renderDrawer()` rebuilds the task drawer (preserving scroll). Views are pure string builders (`vDash`, `vTasks`, …).
- Event delegation on `document`: `click` → `A[data-act]`, `change` → `H[data-ch]`, `input` (search box only), `keydown` (Esc), HTML5 drag & drop for the board.
- Timers: `setInterval` 1 s (timer label), 60 s (overdue check).

## 3. Algorithms

### Working-day arithmetic
`normWD` (roll forward to Monday if Sat/Sun), `nextWD`, `addWD(s,n)`, `diffWD(a,b)` = number of `nextWD` steps from a to b (capped at 500). Dates are local `YYYY-MM-DD` strings; compared lexicographically. No holiday table.

### Finish-to-start cascade (`cascadeFrom`)
For predecessor *p* (not Done): for each non-Done successor *x* with `x.start ≤ p.due`: `dur = diffWD(x.start, x.due)`; `x.start = nextWD(p.due)`; `x.due = addWD(x.start, dur)`; recurse. A `seen` set prevents loops. Successors are only ever moved later, never pulled earlier. Cycle creation is prevented in the UI by `dependsOn()`.

### Blocking (`applyStatus`)
Moving to anything other than *Triage* / *To do* is refused if any predecessor is not Done, unless the change comes from an automation (`fromRule`).

### Workload (`workload(weeks)`)
For each non-Done task: `rem = max(est − logged, 0)`; working days from `normWD(start)` to `due` (≥ 1; capped at 400); `per = rem / days`; day *d* adds `per` to week index `max(0, floor((d − Monday₀)/7))` of the assignee (key `''` = unassigned); indices ≥ `weeks` are dropped. Consequence: working days that fall before the current Monday (past-due intervals) are all counted in week 0; hours are not redistributed over the remaining days of an overdue task.

### Instrument conflicts (`conflicts`)
O(n²) over open tasks whose *Instrument* field is set and ≠ *Other*: same value and `a.start ≤ b.due && b.start ≤ a.due`.

### Formula parser (`evalExpr`)
Recursive descent: `expr = term (('+'|'-') term)*`, `term = factor (('*'|'/') factor)*`, `factor = ['+'|'-'] (number | '(' expr ')')`. Variables are substituted as numeric literals first; any non-finite input aborts to `—`.

### Automations (`fire`)
Filter rules by `on`, trigger type/value and condition; run action; log. `set_status` re-enters `applyStatus` with depth+1; `create_task` fires `created` on the new task with depth+1; depth > 3 returns.

### Excel export (`buildXlsx`, `zipStore`)
No library. The workbook is generated as OOXML strings (`[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/styles.xml`, two worksheets; inline strings, dates as serial numbers with `yyyy-mm-dd` format, frozen header, autofilter) and packed with a minimal **store-only ZIP** writer (CRC-32 table, local headers, central directory, EOCD; UTF-8 names flag). Cell text is stripped of XML-illegal control characters and escaped. Verified to open with openpyxl and LibreOffice. Rows come from `filtered()`, the same function used by the five views, so export = what the filters select. Delivery: `showSaveFilePicker` if available (starts in the backup folder), else `<a download>`.

### Backup folder (File System Access API)
`showDirectoryPicker({mode:'readwrite'})` → handle stored in IndexedDB (`labpm_fs`/`h`/`dir`; structured-cloneable) so it survives reloads; permission is re-requested via `requestPermission` from a click (`Reconnect folder`). `save()` → `folderSchedule()` (800 ms debounce) → `folderNow()` appends to a promise queue `FS.q` that writes `labpm-autosave.json` via `createWritable()` (atomic replace on close). Connection writes `labpm-initial-<stamp>.json` first. Errors set `FS.err`, pause the feature and surface in the UI. Free-text fields additionally save on the `input` event (state only, no re-render, so caret/focus are preserved).

### Attachments
`attachFiles()` → `attPerm()` (query/request readwrite permission on the stored folder handle) → `getDirectoryHandle('attachments',{create})` → per-owner subfolder (`task-<slug(title)>-<id>` / `project-<slug(name)>-<id>`) → unique name check via `getFileHandle(name)` (NotFoundError = free) → `createWritable().write(File)`; record `{id,taskId,projectId,name,path,size,type,added,by}` pushed to `S.files`. The path is relative to the folder and stored in the database, so the folder is relocatable. `fileGet()` re-validates the path (must start with `attachments/`, no empty/`.`/`..` segments) before walking the directory handles, so a tampered session file cannot escape the folder. Files are never deleted by the app.

### Empty database
`emptySession()` builds the minimal valid session (also published as `empty-database/labpm-empty.json`). *Clear all project data* resets collections in place (users/fields/ui theme kept) after `autoSnap()` and, if connected, `folderNow(true)`.

## 4. Security model

See [SECURITY.md](../SECURITY.md). Key points: folder access only after explicit user gesture and browser permission prompt; files written are plain JSON; `esc()` on all dynamic HTML; `normSession()` as the single gate for any external JSON; no `eval`; CSP without `connect-src`.

## 5. Design decisions

| Decision | Rationale |
|---|---|
| Single file, no build | Archivable next to lab records; runs offline from disk; trivially auditable |
| `localStorage` + JSON export | No infrastructure; backups are plain files |
| Simulated roles | Workflow aid only; real RBAC needs a server |
| Deterministic project summary | Reproducible; no AI Act Art. 50 disclosure obligations |
| ES5-style code | Matches the original prototype; no transpilation required |

## 6. Extending

| Task | Where |
|---|---|
| Add a status | `STATUSES`, `SCOL`, CSS `--sN` (light and dark), `normSession` (automatic via `STATUSES`) |
| Add a template | `TPL` array: `{id,name,desc,tasks:[{t,d,est,tool?,after?:[indices]}]}` |
| Add an automation action | `AT` list in `normSession`, `fire()`, `ruleText()`, `vAuto()` option list |
| Add a custom-field type | `normSession` field types, `vSet` selector, `cfv()`, `renderDrawer()` |
| Add a view | `TVIEWS`, `tv()`, a `vXxx()` builder |
| Persist a new property | `seed()`, `normSession()`, [DATA_MODEL.md](DATA_MODEL.md) |

## 7. Out of scope (v1.x)

Multi-user sync, authentication, server-side storage, public holiday calendars, SS/FF/SF dependencies, resource levelling, file attachments, ELN integration.

---
© Flavio Pendolino, 2026. This document is distributed under the CC BY-NC 4.0 license (https://creativecommons.org/licenses/by-nc/4.0).
