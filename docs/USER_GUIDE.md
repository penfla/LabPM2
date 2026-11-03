# User guide

Applies to LabPM 2.0.0-beta.5. Source: https://github.com/penfla/LabPM2

## 1. Navigation

Planning follows one scheme: **Project → Task → Activity.** A project has several tasks, a task has several activities (checklist items).

Left rail: **Work** — Dashboard · Team progress · Projects (with the submenu **Tasks**) · Files · Requests; **Planning** — Automations · Documents. On screens ≤ 860 px the rail becomes a horizontal scroll bar. The footer of the rail shows the sync status.

Top bar: the **gear icon** opens the Settings page (people and roles, custom fields, *Data & sync*, *Templates*, *Info & license*, see §9), theme (Light / Dark / Auto), your name and role with **Sign out** (roles are enforced by the server; see §10).

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

## 3. Tasks (submenu of Projects)

All tasks of all projects in five views. To work project by project use **Projects** (§5): open a project to see its tasks and their activities.

Toolbar: view switch, **Quick add** (PM/Admin, §3c), search (title + tags), filters (project, assignee, status, priority, due-date range *from / to*), *Clear filters*, grouping (List only), **Export Excel (n)**, **+ Task** (PM/Admin). Filters apply to all five views and persist across reloads.

| View | Notes |
|---|---|
| List | First column is a **tick box** (done / not done); subtasks are indented under their task with chips for subtasks and activities done. No column sorting; optional grouping (status, project, person, priority). Custom fields appear as extra columns. Click a row to open the detail drawer |
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

### Task window

Opens when you click a task or **+ Task**. Fields: title, project, status, assignee (PM/Admin only), priority, start, due, tags, custom fields, **activities**, attachments, notes, linked documents, delete (two-step confirm). There are no estimated-hours, subtask, dependency, time-tracking or template-step sections any more (planning is Project → Task → Activity); existing values of those kinds stay in the data and in the Excel export.

- **Activities (checklist).** Things to do inside the task. Tick the box when done (it records who and when). Type in the field and press **Enter** to add one (paste several lines to add many); the drop-down **Add a previous activity…** offers every activity already used in any task (most frequent first) so repeated work is one click; ✕ removes. Activities do not close the task.
- **Cascade.** Changing a due date moves every non-Done successor of tasks that still have dependencies (older data): new start = next working day after the predecessor due, duration preserved, recursively; a toast reports how many moved.
- **Attachments.** Choose files, give each a name (empty = file name) and *Upload*; see §3b.
- **Overdue flag.** Computed live; also fires *overdue* automations once per task (re-armed when dates change).

## 3b. Files

Attachments are stored on the server, in `attachments/` inside the data folder, and are visible to everyone who can see the task or project.

1. Choose *Project*; optionally a *Task* (otherwise the file is project-level), pick files (multiple), then **give each file a name** in the list that appears (leave it empty to use the file name) and press *Upload*. Limit 25 MB per file (server setting `MAX_UPLOAD_MB`). The same upload control is in the task drawer.
2. *Files* lists everything (filter by project) with size, date and user. Clicking a name downloads it; the download requires login and is always served as an attachment (never rendered in the page). Treat files as untrusted (macro-enabled Office files, etc.).
3. Admin and Project manager can attach to any task and delete any file; a Researcher can attach to tasks assigned to them and delete files they added. Deleting a task deletes its files from the server.
4. The name you give is only a display name; the download keeps the original file name (shown in brackets when it differs). File names are sanitised (characters illegal in file names become `_`). The *Attachments* column of the Excel export lists the file names per task.

## 4. Requests (intake)

Form → creates a task in project **Internal requests** (created if missing) with status **Triage**, tag `request`, `src=form`. Delivery date is moved to the next working day and cannot be in the past. Fields mapped to custom fields when present: Instrument, No. of samples, Lot.

Triage queue: PM/Admin choose an assignee and **Accept** → status *To do*. Viewer cannot submit.

External users cannot reach the form: data is local to the browser.

## 5. Projects

Work → **Projects** lists all projects: status, progress, period, tasks done and activities done. **Click a project** to open it: its tasks with their activities, tick boxes for tasks and activities, a field to add a task (`Run DSC @Rossi #3 !high due:2026-12-18`, Enter) and, under each task, a field to add an activity (Enter). *← All projects* goes back; *show completed tasks* shows finished ones.

- Add a project with *+ Project* or build everything at once with **Quick add** (§3c).
- Project status: *Auto* (Done if all tasks Done; *At risk* if any open task is overdue; else *On track*) or manual override (*On track, At risk, On hold, Done*).
- Progress = Done tasks / tasks (weighted by estimated hours where they exist, otherwise each task counts 1).
- *Notes* opens (or creates) the project's note document.
- The *Goals* box of earlier versions was removed (existing goals stay in the data).

## 6. Templates (Settings → Templates)

Templates live in the Settings page (gear icon → *Templates*) and are not part of the daily workflow for now.

A template is a named list of steps: title, duration in working days, estimated hours, optional *Instrument*, and the earlier steps each one must wait for (finish-to-start). Five laboratory templates are provided the first time a database is created; afterwards they are ordinary records that Admin and Project manager can edit, duplicate and delete (they are not restored automatically once deleted).

| Provided template | Steps | Standards cited |
|---|---|---|
| DSC characterization | 5 | ASTM D3418, ISO 11357-3 |
| Compound extrusion campaign | 6 | ISO 1133-1 (MFR) |
| PE/EVOH/PE multilayer film | 6 | ASTM D3985 (OTR), ISO 527-3 (tensile) |
| Instrument calibration and verification | 4 | – |
| Analytical method validation | 5 | – |

**Manage (Templates page, Admin / Project manager)**
- *New template*, *Duplicate*, *Edit*, *Delete* (two clicks). In the editor change name and description, edit each step, *Add step*, remove a step with ✕ (links to later steps are renumbered). *After steps* takes earlier step numbers, e.g. `1,2`; 1–60 steps, 1–60 days per step.
- Edits apply to templates used from then on. Tasks already created from a template are not changed.

**Use**
- *To a project* (Templates page → *Use template*): choose *New project* (name) or an *Existing* project, and the start date. The steps become dependent tasks scheduled forward on working days (each starts after its latest predecessor), then Tasks → Timeline opens. Estimated hours and *Instrument* values are pre-filled; assignees are not.

Standards: https://www.astm.org · https://www.iso.org. Templates only cite the standard number; verify method parameters against the current edition.

## 3c. Quick add, ticking and team progress

**Quick add** (Projects or Tasks page → *Quick add*, Admin / Project manager) creates projects, tasks and activities in one go from an outline. Fill the project name (an existing one is reused, a new name creates it) and a start date, then type or paste:

```
# DSC campaign
Prepare samples @Rossi #2 !high
  Weigh 8 specimens
  Condition 48 h
  - [x] Label vials
Run DSC @Rossi #3 due:2026-12-18
  Calibrate In/Zn
```

| Line | Result |
|---|---|
| `# Name` | starts / selects a project (several allowed; optional if the Project field is filled) |
| normal line | a **task** |
| indented line under a task, or `- text`, `* text`, `[ ] text` | an **activity** of the task above (`[x]` = already done) |
| `@name` | assignee: first user whose name contains the text |
| `#N` | duration in working days (default 1) |
| `!low` `!med` `!high` `!crit` | priority (default Medium) |
| `start:YYYY-MM-DD` `due:YYYY-MM-DD` | explicit dates |

Tokens are removed from the title. Without `start:` tasks begin on the start date (next working day if weekend). Nothing is created when a line cannot be placed (for example a task before any project name); activity lines without a task are skipped and counted in the message. The project opens afterwards. Other ways to enter work: *+ Project*, the add-task field in a project, *+ Task*, and the add-activity fields (Researchers can add activities to their own tasks).

**Ticking done.** Tick a task in the project, the task list, the task window or *Team progress*; tick activities in the project, the task window or *Team progress*. Allowed to Admin, Project manager and the assignee; Viewers cannot.

**Team progress** (Work → Team progress, right under Dashboard) shows, per person and optionally per project: tasks done / total, activities done / total, open and overdue tasks, each with a progress bar, followed by one card per person listing their open tasks (completed ones on request) with tick boxes and activities. A dashboard widget *Progress by person* summarises the same figures.

*Subtasks* introduced in 2.0.0-beta.5 are no longer offered: use activities. Subtasks that already exist keep working (indented in the list; the task follows them).

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

## 9. Settings page

The gear icon in the top bar opens one page with four tabs:

- **Settings** — *Users and roles* and weekly capacity (Admin only; create accounts, reset passwords); *Custom fields* (PM/Admin; types text, number, select, date, checkbox, formula — variables `{est}`, `{logged}` and number fields); *Integrations* (copy ICS calendar, copy JSON); *Activity log* (changes received in this browser session; the full trail is in the server audit).
- **Data & sync** — status, account, export / import, backups, empty database (§11).
- **Templates** — edit, duplicate, delete, create and apply templates (§6).
- **Info & license** — author, license, references.

## 10. Roles

| Capability | Admin | Project manager | Researcher | Viewer |
|---|:-:|:-:|:-:|:-:|
| View everything | ✓ | ✓ | ✓ | ✓ |
| Create / delete tasks, change assignee | ✓ | ✓ | – | – |
| Edit task fields, timer, hours, tick activities / subtasks | ✓ | ✓ | own tasks | – |
| Add subtasks and activities | ✓ | ✓ | on own tasks (subtask assigned to themselves) | – |
| Projects, goals, templates, bulk entry, fields, rules | ✓ | ✓ | – | – |
| Accept requests | ✓ | ✓ | – | – |
| Submit requests | ✓ | ✓ | ✓ | – |
| Edit documents | ✓ | ✓ | ✓ | – |
| Users & accounts, import / export, backups and restore, clear data | ✓ | – | – | – |
| Attach files | ✓ | ✓ | own tasks | – |

Roles are enforced by the server on every request (see [SECURITY.md](../SECURITY.md)). A Researcher may change status, notes, estimate, tags, custom fields, hours, timer, priority and activities on own tasks, not title, dates, project or assignee (on a *subtask* assigned to them also title and dates); they can add subtasks under their own tasks (assigned to themselves) and delete those.

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

## 11b. Shared-folder mode (no server)

If no LabPM server answers, the page asks for the shared folder (README, option A). Differences:

- **Who are you?** instead of a login: pick your name, or *I am new here*. *Switch user* in the top bar changes identity. Settings → *Add person* creates colleagues (no passwords). Roles shape the interface but are **not** access control.
- Changes of other PCs appear after ~4 s. The status line reads *Shared folder · synced hh:mm:ss*.
- Date cascade, automations and the overdue check run in your browser. The first PC to notice an overdue task fires its rule.
- Files are copied to `attachments/` in the folder; backups are daily JSON copies in `backups/` (Settings → Data & sync → Backups, Admin; restore replaces all records).
- Import / export work on JSON files as in server mode; there is no audit page.
- Editing needs Chrome or Edge; after a browser restart use *Reconnect folder*.
- **Firefox and Safari:** *Open folder read-only…* shows projects, tasks, documents and files as they were when you opened the folder (everything is view-only, whatever your role; *Reload folder* in Data & sync re-reads it). Creating the first Admin or adding people needs Chrome/Edge or the server. With the LabPM server all browsers can edit.

## 12. Keyboard and accessibility

`Esc` closes the drawer. Focus rings on all controls; status is always text + colour; `prefers-reduced-motion` respected; light/dark follow the system in *Auto*.

---
© Flavio Pendolino, 2026. This document is licensed under the Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0).
