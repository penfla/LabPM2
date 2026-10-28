# User guide

Applies to LabPM 2.0.0-beta.1. Source: https://github.com/penfla/LabPM2

## 1. Navigation

Left rail: **Work** (Dashboard, Tasks, Files, Requests) · **Planning** (Portfolio, Templates, Automations, Documents) · **System** (Data & sync, Settings, Info & license). On screens ≤ 860 px the rail becomes a horizontal scroll bar.

Top bar: running-timer button (opens the task), theme (Light / Dark / Auto), your name and role with **Sign out** (roles are enforced by the server; see §10).

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

Attachments are stored on the server, in `attachments/` inside the data folder, and are visible to everyone who can see the task or project.

1. Choose *Project*; optionally a *Task* (otherwise the file is project-level) and pick files (multiple). Limit 25 MB per file (server setting `MAX_UPLOAD_MB`). The same upload control is in the task drawer.
2. *Files* lists everything (filter by project) with size, date and user. Clicking a name downloads it; the download requires login and is always served as an attachment (never rendered in the page). Treat files as untrusted (macro-enabled Office files, etc.).
3. Admin and Project manager can attach to any task and delete any file; a Researcher can attach to tasks assigned to them and delete files they added. Deleting a task deletes its files from the server.
4. File names are sanitised (characters illegal in file names become `_`). The *Attachments* column of the Excel export lists the file names per task.

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
- **Integrations** — *Copy ICS calendar* (all-day VEVENT on due date, open tasks), *Copy JSON backup* (clipboard).
- **Activity log** — changes received in this browser session (last 40 of 300); the full trail is kept by the server (Admin / Project manager: `GET /api/audit`).
- **Create account** (Admin): name, username (3+ characters), password (10+), role. *Reset password* signs that user out.

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
| Users & accounts, import / export, backups and restore, clear data | ✓ | – | – | – |
| Attach files | ✓ | ✓ | own tasks | – |

Roles are enforced by the server on every request (see [SECURITY.md](../SECURITY.md)). A Researcher may change status, notes, estimate, tags, custom fields, hours, timer and priority on own tasks, not title, dates, project or assignee.

## 11. Data, sync and backups

Every change is sent to the server within ~0.3 s and appears in the other open sessions within seconds. The status line (side rail) shows *Synced hh:mm:ss*, *Syncing…* or *Offline: retrying*. While offline, edits stay in the open page and are retried; closing the page loses them (the browser warns).

**Conflicts.** Each record has a revision. If someone saved the same record first, LabPM merges field by field: your changed fields win, everything else comes from the server (a toast says so). Dates, statuses, dependencies and automations are applied by the server: when you move a task, successors are shifted and rules fire for everyone, once.

**Blocked tasks.** A task with open predecessors cannot move past *To do* (the server answers *Blocked by: …*).

| Action | Where | Notes |
|---|---|---|
| Change password | Data & sync | Any user |
| Download full database | Data & sync | Admin; `labpm-database-YYYY-MM-DD.json` (schema v1) |
| Import a session file | Data & sync | Admin; adds/overwrites by id, deletes nothing; optional people as placeholders (no login); timers dropped; ≤ 5 MB |
| Backups | Data & sync | Admin; *Create backup now*, *Restore* (replaces all data and accounts, signs everyone out, saves a `pre-restore` copy first) |
| Empty database file | Data & sync | `labpm-empty.json` for a fresh import |
| Clear all project data | Data & sync | Admin; two clicks; deletes projects, tasks, hours, goals, documents, rules for everyone; keeps people, roles, custom fields. Download the database first |

Automatic backups: at every server start and daily at 03:00, last 14, in `backups/` of the data folder. They contain the database and accounts, not attachment files: copy the whole data folder for a complete backup.

## 12. Keyboard and accessibility

`Esc` closes the drawer. Focus rings on all controls; status is always text + colour; `prefers-reduced-motion` respected; light/dark follow the system in *Auto*.

---
© Flavio Pendolino, 2026. This document is distributed under the CC BY-NC 4.0 license (https://creativecommons.org/licenses/by-nc/4.0).
