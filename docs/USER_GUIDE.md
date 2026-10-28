> **v2.0 status:** this text was written for v1.3 (standalone). Sections on browser storage, backup folder, snapshots, attachments in a local folder and simulated roles no longer apply; see `ARCHITECTURE-v2.md` and `CHANGELOG.md`.

# User guide

Applies to LabPM 1.3.0. Live demo / source: https://github.com/penfla/labpm

## 1. Navigation

Left rail: **Work** (Dashboard, Tasks, Files, Requests) · **Planning** (Portfolio, Templates, Automations, Documents) · **System** (Session, Settings, Info & license). On screens ≤ 860 px the rail becomes a horizontal scroll bar.

Top bar: running-timer button (opens the task), theme (Light / Dark / Auto), **User** switcher (demo of roles; see §10).

## 2. Dashboard

Widgets can be toggled under *Visible widgets* (preference is saved).

| Widget | Definition |
|---|---|
| Indicators | Open tasks; overdue (due < today and not Done); blocked (any predecessor not Done); hours logged / estimated (open tasks only); projects *At risk*; instrument conflicts |
| Task status | Count per status |
| Hours per project | Grey = estimated, coloured = logged |
| 6-week workload | Per person, one bar per week from the current Monday; green ≤ 85 % of capacity, amber 85–100 %, red > 100 % |
| Deadlines within 7 days | Open tasks with due ≤ today + 7 (includes overdue) |
| Instrument conflicts | Pairs of open tasks with the same *Instrument* value (≠ *Other*) and overlapping start–due intervals |
| Project summary | Rule-based text (progress, overdue, blocked, delays blocking others, next unblocked task, hours). No generative AI |

## 3. Tasks

Toolbar: view switch, search (title + tags), filters (project, assignee, status, priority, due-date range *from / to*), *Clear filters*, grouping (List only), **Export Excel (n)**, **+ Task** (PM/Admin). Filters apply to all five views and persist across reloads.

| View | Notes |
|---|---|
| List | No column sorting; optional grouping (status, project, person, priority). Custom fields appear as extra columns. Click a row to open the detail drawer |
| Board | One column per status. Drag a card to change status (blocked tasks refuse *In progress / In review / Done*) |
| Timeline | Bars = start→due on working-day grid; dark fill = logged / estimated; arrows = dependencies; red line = today |
| Calendar | Month grid, cards on due date (max 3 per day + counter) |
| Workload | Hours per person per week for 6 weeks, vs capacity |

### Excel export

**Export Excel (n)** writes the *n* tasks currently matching the filters (all roles). Choose the filters first, then export; the button shows the live row count.

- Browsers with the File System Access API (Chrome, Edge) open a *Save as* dialog (starting in the backup folder if one is connected); others download `labpm-tasks-YYYY-MM-DD.xlsx`.
- Sheet **Tasks** (sorted by project, then start): Title, Project, Status, Assignee, Priority, Start, Due (real Excel dates), Estimated h, Logged h, Overdue, Blocked, Depends on, Tags, one column per custom field (number/date types preserved; formula fields as computed values), Requester, Notes. Header row styled and frozen, autofilter on.
- Sheet **Export info**: application version, timestamp, user and role, row count and the filter values used.
- Values are a snapshot: formulas are exported as numbers, not Excel formulas.

### Task drawer

Title, project, status, assignee (PM/Admin only), priority, start, due, estimated hours, tags, custom fields, dependencies, time tracking, notes, linked documents, delete (two-step confirm).

- **Dependencies (finish-to-start).** Tick predecessors. Circular links are prevented (candidates exclude tasks that already depend on the current one).
- **Cascade.** Changing a due date or adding a predecessor moves every non-Done successor whose start ≤ predecessor due: new start = next working day after the predecessor due, duration (in working days) preserved, recursively. A toast reports how many tasks moved.
- **Attachments.** Add one or more files from the drawer (needs a connected backup folder, see §11). Each file is copied to `<folder>/attachments/task-<title>-<id>/`; *Open* shows it in a new tab (falls back to download), *Save copy* downloads it, *Remove* drops the link only. Researchers can attach to their own tasks; PM/Admin to any; Viewer cannot.
- **Time.** *Start timer* (stops any other timer you have running); stopping logs hours (≥ 0.01 h, rounded to 0.01) with note "Timer". Manual entry: hours + note → today. Last 8 entries shown.
- **Overdue flag.** Computed live; also fires *overdue* automations once per task (re-armed when dates change).

## 3b. Files

Side-menu page for attachments across projects.

1. Connect a backup folder first (*Session → Backup folder*). Without it the page only explains this: attachments are stored **inside the folder that holds the database**.
2. Choose *Project*; optionally a *Task* (otherwise the file is project-level) and pick files (multiple). The destination path is shown: `<folder>/attachments/task-<slug>-<taskId>/` or `<folder>/attachments/project-<slug>-<projectId>/`.
3. Files are copied, never moved. If the name already exists in that subfolder a suffix is added (`name (2).ext`); characters illegal in file names become `_`.
4. *All attachments* lists everything (filter by project) with size, date, user and relative path. The *Attachments* column of the Excel export lists the file names per task.

The relative path is stored in the database, so moving the whole folder (database + `attachments/`) to another computer keeps the links valid after you reconnect it. Deleting a task removes its links (a toast says so); files stay on disk. After a restart the browser asks permission again (*Reconnect folder*). Not supported without the File System Access API (Chromium).

## 4. Requests (intake)

Form → creates a task in project **Internal requests** (created if missing) with status **Triage**, tag `request`, `src=form`. Delivery date is moved to the next working day and cannot be in the past. Fields mapped to custom fields when present: Instrument, No. of samples, Lot.

Triage queue: PM/Admin choose an assignee and **Accept** → status *To do*. Viewer cannot submit.

External users cannot reach the form: data is local to the browser.

## 5. Portfolio and goals

- Project status: *Auto* (Done if all tasks Done; *At risk* if any open task is overdue; else *On track*) or manual override (*On track, At risk, On hold, Done*).
- Progress = Σ estimated hours of Done tasks / Σ estimated hours (tasks with 0 h count as 1).
- Goal progress = mean progress of linked projects; flagged *past due* when target < today and < 100 %.
- *Notes* opens (or creates) the project's note document.

## 6. Templates

| Template | Tasks | Standards |
|---|---|---|
| DSC characterization | 5 | ASTM D3418, ISO 11357-3 |
| Compound extrusion campaign | 6 | ISO 1133-1 (MFR) |
| PE/EVOH/PE multilayer film | 6 | ASTM D3985 (OTR), ISO 527-3 (tensile) |
| Instrument calibration and verification | 4 | – |
| Analytical method validation | 5 | – |

*Use template* → name + start date → creates a project with dependent tasks scheduled forward on working days (each task starts after its latest predecessor), jumps to Tasks → Timeline. Estimated hours and *Instrument* values are pre-filled; assignees are not.

Standards: https://www.astm.org · https://www.iso.org. Templates only cite the standard number; verify method parameters against the current edition.

### Bulk task entry

Templates → *Create tasks from a list*, one task per line:

```
Weigh samples @Bianchi #1 ~3h
FTIR on 8 films @Neri #2 ~6h
```

| Token | Meaning | Default |
|---|---|---|
| `@name` | Assignee: first user whose name contains the text (case-insensitive) | unassigned |
| `#N` | Duration in working days | 2 |
| `~Nh` | Estimated hours (`~1.5h` or `~1,5h`) | 0 |

Tokens are removed from the title. Tasks start today (next working day if weekend).

## 7. Automations

Rule = **When** (trigger) · optional **Condition** · **Action**.

| Trigger | Value |
|---|---|
| status becomes… | a status |
| a task is created | – |
| a task is overdue | – (evaluated at load and every 60 s) |

| Condition | |
|---|---|
| project is… / priority is… / has the tag… | single value; none = always |

| Action | Value |
|---|---|
| notify | text (toast) |
| assign to | person |
| set priority / set status | enum |
| add tag | text |
| create a task | title (same project and assignee, starts next working day, 3 working days) |

Chains stop at depth 3. Seeded examples: *Sample archive* (Done + tag `to-archive` → create "Archive residual samples"), *Flag overdue tasks* (overdue → tag `overdue`), *New requests to triage* (created in Internal requests → status Triage). Rule-driven status changes bypass the dependency block.

Only PM/Admin can create, toggle or remove rules.

## 8. Documents

Markdown-lite: `# / ## / ###` headings, `- ` lists, `**bold**`, `` `code` ``, bare `http(s)` links. Linked to a project and optionally a task (a task link overrides the project). Preview is live. Viewer is read-only.

## 9. Settings

- **Users and roles**, weekly capacity (h/week) — Admin only.
- **Custom fields** — PM/Admin. Types: text, number, select (comma-separated options), date, checkbox, formula.
  - Formula: `+ − × ÷`, parentheses, decimals; variables `{est}`, `{logged}`, and the name of any *number* field, e.g. `{est}/{No. of samples}`. Missing/non-numeric input → `—`.
  - The fields named *Instrument*, *No. of samples*, *Lot* are used by conflicts, workload views and the intake form; renaming or deleting them disables those features.
- **Integrations and backup** — *Copy ICS calendar* (all-day VEVENT on due date, open tasks), *Copy JSON backup*, *Import from field*, *Restore sample data*.
- **Activity log** — last 40 of 300 events.

## 10. Roles

| Capability | Admin | Project manager | Researcher | Viewer |
|---|:-:|:-:|:-:|:-:|
| View everything | ✓ | ✓ | ✓ | ✓ |
| Create / delete tasks, change assignee | ✓ | ✓ | – | – |
| Edit task fields, timer, hours | ✓ | ✓ | own tasks | – |
| Projects, goals, templates, bulk entry, fields, rules | ✓ | ✓ | – | – |
| Accept requests | ✓ | ✓ | – | – |
| Submit requests | ✓ | ✓ | ✓ | – |
| Edit documents | ✓ | ✓ | ✓ | – |
| Users & roles, import, restore snapshot, open file, reset | ✓ | – | – | – |

Roles are a UI convention (see [SECURITY.md](../SECURITY.md)).

## 11. Autosave, backup folder and sessions

| Action | Where | Notes |
|---|---|---|
| Autosave (browser) | automatic | `localStorage`, on every change and on every keystroke in notes / document title / document text; message in the rail footer |
| **Backup folder** | Session | See below |
| Save in browser | Session | Named snapshot, max 12 (oldest dropped); includes `ui` state but not running timers |
| Save to file | Session | `labpm-session-YYYY-MM-DD.json` download |
| Restore snapshot / open file | Session | Admin; two-step confirm; automatic snapshot first; ≤ 5 MB |
| Copy / paste JSON | Session, Settings | Clipboard fallback writes into the text field |

### Empty database and clearing

- **Download empty database file** (*Session → Empty database*) saves `labpm-empty.json`: no projects/tasks, one Admin user, the four default custom fields. A ready-made copy is in the repository at `empty-database/labpm-empty.json`. Load with *Open from file* (Admin).
- **Clear all project data** (Admin; two clicks): deletes projects, tasks, hours, goals, documents, rules, attachment links and the activity log; keeps users, roles and custom fields. First an automatic browser snapshot (restorable under *Sessions saved in the browser*) and, if a folder is connected, a `labpm-copy-<date>.json` are written. Attachment files in the folder are not deleted.
- With an empty database, create a project in *Portfolio* (or from *Templates*) before adding tasks.

### Backup folder (recommended before you start entering data)

*Session → Backup folder → Choose folder…* (Chromium browsers: Chrome, Edge).

1. Pick any folder (local, network share, cloud-synced folder). The browser asks for read/write permission.
2. LabPM immediately writes `labpm-initial-YYYYMMDD-HHMMSS.json` — the database **as it was before further editing** — and `labpm-autosave.json`.
3. From then on `labpm-autosave.json` is rewritten ~0.8 s after every change (writes are queued, so it is always the latest consistent state). The rail footer shows the last folder write time.
4. *Save timestamped copy now* adds `labpm-copy-YYYYMMDD-HHMMSS.json`; *Pause autosave* / *Resume*, *Change folder…*, *Disconnect* are available.
5. After closing the browser, LabPM remembers the folder but Chrome asks permission again: use **Reconnect folder**. Until then browser-only autosave continues.

If a write fails (folder removed, disk full, permission revoked) autosave stops, a message is shown and the Session page reports the error; fix the cause and *Resume*. Restore from any of the files with *Open from file* (Admin).

Files (database and attachments) are unencrypted. Not supported in Firefox/Safari (use *Save to file*; attachments unavailable).

## 12. Keyboard and accessibility

`Esc` closes the drawer. Focus rings on all controls; status is always text + colour; `prefers-reduced-motion` respected; light/dark follow the system in *Auto*.

---
© Flavio Pendolino, 2026. This document is distributed under the CC BY-NC 4.0 license (https://creativecommons.org/licenses/by-nc/4.0).
