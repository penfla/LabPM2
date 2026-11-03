# Migrating from LabPM v1.3 (standalone) to v2

Author: Flavio Pendolino · Version: 2.0.0-beta.5 · License: Apache License 2.0 · Commercial use: permitted under the Apache License 2.0
Purpose: move the data of a v1.3 browser database (projects, tasks, hours, documents, rules, attachments) into LabPM v2. Method: export the session file in v1.3, convert and validate it with `tools/migrate-v1.js` (or import it in the page), check the report. Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
Third-party components: none. Reference: v1.3 source and documentation at https://github.com/penfla/LabPM; v2 at https://github.com/penfla/LabPM2.
AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).

## 1. Choose the route

| | A. Command line → server (recommended) | B. Page import → server | C. Page import → shared folder |
|---|---|---|---|
| Needs | Node.js ≥ 22.13 where you run the tool, Admin account | Admin account in the browser | Chrome / Edge, shared folder |
| People | matched to existing accounts **by display name**; others optional placeholders | placeholders only (no matching) | placeholders only |
| Attachments | uploaded automatically from the v1.3 backup folder | re-attach by hand | re-attach by hand |
| Report | full text report, dry run | counts in a toast | counts in a toast |
| Invalid records | skipped and listed with the reason | the **whole import is rejected** with the error (nothing is imported) | skipped, only the number is shown |
| Italian prototype files | translated | not translated: use the converted file | not translated: use the converted file |

If you can run Node.js once (any PC is enough, it does not have to be the server), use route A.

## 2. Before you start (v1.3 side)

1. Open v1.3 in the browser that holds the data. *Session → Save to file* → `labpm-session-YYYY-MM-DD.json`. Keep this file: it is your rollback.
2. If you used the **backup folder** in v1.3, note its location: it contains `attachments/…` (the files) and `labpm-autosave.json` (the same JSON format as a session file; use the newest one if the browser data is gone).
3. Snapshots saved *in the browser* are not exported by step 1. Restore the ones you still need in v1.3 and save each as a file; they can be migrated one by one (ids are preserved, so later files overwrite earlier ones).
4. Stop running timers if you want the hours: v2 drops running timers (they cannot be attributed to a session). Hours already logged are kept.
5. Sessions from the Italian prototype work too: the tool translates the Italian enumerations (`Da fare → To do`, `Alta → High`, `Ricercatore → Researcher`, `In linea → On track`, field names `Strumento / N. campioni / Lotto`, formula variable `{registrate}`).

## 3. Prepare v2

1. Install and start v2 (README, *Two ways to run it*). Create the Admin on first visit.
2. For route A create the **accounts of your colleagues first** (Settings → Users and roles → *Create account*), using the **same display names as in v1.3** (comparison ignores case and surrounding spaces). Tasks, hours and goals of a matched person are attached to the real account.

## 4. Route A: command line

Dry run first (logs in, matches people, converts, writes nothing). A password on the command line is visible to other users of the PC; set `LABPM_PASSWORD` instead and omit `--password` if that matters.

```bash
node tools/migrate-v1.js labpm-session-2026-10-30.json \
  --server http://192.168.1.20:8080 --user admin --password '…' \
  --people placeholders --dry-run
```

Then the real run, with attachments:

```bash
node tools/migrate-v1.js labpm-session-2026-10-30.json \
  --server http://192.168.1.20:8080 --user admin --password '…' \
  --people placeholders --attachments "D:\labpm-v1-backup" --out migrated.v2.json
```

| Option | Meaning |
|---|---|
| `<session.json>` | v1.3 session file (`"v": 1`) |
| `--out FILE` | converted file (default `<input>.v2.json`); can also be imported in the page |
| `--people skip` (default) / `placeholders` | `skip`: people without an account are dropped and their assignments cleared (no dangling references). `placeholders`: they are created as role-bearing records **without login** (an Admin becomes Viewer) so assignments and hour logs stay readable; give them a login later or remove them |
| `--server URL --user NAME --password PW` | import into a running v2 server (Admin only; or set `LABPM_PASSWORD`). Without `--server` the tool only converts the file |
| `--attachments DIR` | the v1.3 backup folder; file records are resolved relative to it (`attachments/<folder>/<name>`) and uploaded (25 MB limit per file). Paths that point outside `DIR` are never read |
| `--dry-run` | report only |

Without `--server` (no network, e.g. to prepare the file at home): `node tools/migrate-v1.js session.json --people placeholders` → `session.v2.json`, then route B or C.

Example report (illustrative numbers):

```
LabPM v1.3 -> v2 migration report
  users: 1
  projects: 6
  fields: 4
  rules: 3
  goals: 2
  tasks: 148
  docs: 9
  enumeration/field renames (Italian prototype): 0
  running timers dropped: 1
  dependencies removed (target missing): 0
  assignees remapped to existing accounts: 131, cleared: 0
  attachment records in the file: 23
  converted file: migrated.v2.json
  imported into http://192.168.1.20:8080: 169 records
  attachments uploaded: 22, not found or rejected: 1
    missing: dsc-run-12.xlsx
```

Read it line by line: **every `SKIPPED` line is a record that was not migrated** (the reason is given, usually an invalid date), and every `missing:` is an attachment that stays in the old folder.

## 5. Routes B and C: import in the page

1. *Settings (gear icon) → Data & sync → Import a session file* (Admin). Prefer the converted file (`*.v2.json`, from `node tools/migrate-v1.js session.json`): it is validated and reported, and it is required for Italian prototype files. A plain v1.3 file also works if it contains no invalid record.
2. Tick *Import people as placeholders* only if assignments and hour logs must stay readable (same meaning as above). Without it, people in the file are ignored and assignments show “—”.
3. A toast reports the number of records (shared-folder mode also the number skipped). In server mode a single invalid record rejects the whole file with an error message: convert it with the tool to see which one.
4. Re-attach files you still need (*Files* page or the task panel). v1.3 attachment records point to a local folder and are not imported.

## 6. What happens to each part

| v1.3 | v2 | Notes |
|---|---|---|
| Users, roles, weekly capacity | placeholders or matched accounts | passwords never existed in v1.3 |
| Projects (colour, status) | kept, ids preserved | |
| Tasks, dates, estimate, priority, tags, notes | kept, ids preserved | dates must be valid `YYYY-MM-DD`, start ≤ due |
| Dependencies | kept (and still drive the date cascade) but the task window no longer shows or edits them; links to missing tasks removed | the date cascade is **not** re-run on import; it runs on the next change of a predecessor |
| Hours (log entries), estimates | kept in the data and Excel export; the task window no longer edits them in v2 | author mapped like assignees |
| Running timers | dropped | |
| Custom fields, formulas, values | kept (`cf` values are keyed by field id) | formulas keep working; the variable `{registrate}` becomes `{logged}` |
| Automations (rules) | kept, ids preserved | they run on the server from now on and do **not** fire on import |
| Subtasks, activities | do not exist in v1.3: nothing to migrate; add them in v2 (Quick add, task panel) |
| Goals | kept in the data; the Goals box was removed from the interface in v2 |
| Documents | kept | |
| Built-in templates | the same five are provided as editable templates | edit or delete them on the Templates page |
| Attachments (files + records) | uploaded by route A, otherwise by hand | |
| Activity log | not migrated | v2 keeps its own audit trail from the first change |
| UI settings (view, filters, theme), snapshots, “User” switcher | not migrated | |

## 7. Check the result

1. Compare the counts in the report with v1.3 (Dashboard KPIs, number of tasks per project).
2. Open the Timeline and Workload of one project in both versions; open 3–5 tasks with dependencies and logged hours.
3. Export the task list to Excel from both (Tasks → Export) and compare hours and dates.
4. Create a throw-away task, move its due date and delete it, to see the live updates and the cascade on the new system.
5. Look at *Settings → Data & sync → Backups*: make a backup now, so that the migrated state is the first restore point.

## 8. Roll back and repeat

- v1.3 is never modified by the migration: the browser data and the session file are intact.
- Importing again overwrites records with the same id and deletes nothing. To start from a clean database use *Clear all project data* (Admin; keeps people, fields, templates) or point the server to a new, empty data folder.
- Server mode: *Data & sync → Backups → Restore* returns to any earlier copy (a `pre-restore` copy is made first). Shared-folder mode: restore a daily copy from the same page.

## 9. Troubleshooting

| Message | Cause / fix |
|---|---|
| `not a LabPM session file (schema "v": 1 expected)` | wrong file; use *Session → Save to file* of v1.3, or `labpm-autosave.json` |
| `login failed (401)` / `the account must be an Admin` | check user and password; only Admin can import |
| `login failed (429)` | too many failed logins from this PC; wait 15 minutes |
| `import failed (400)` | a collection has more than 5000 records, the file is not schema v1, or (page import) a record is invalid; the message names the cause |
| `SKIPPED tasks …: start/due must be valid YYYY-MM-DD` | the task has an invalid date in the source; fix it in v1.3 and export again, or add the task by hand |
| Assignments show “—” | the person had no account and `--people skip` was used; re-run with `--people placeholders` (re-import overwrites) |
| `missing: <file>` | the file is not in the `--attachments` folder or its path escapes it; copy it there or attach by hand |

---
© Flavio Pendolino, 2026. This document is licensed under the Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0).
