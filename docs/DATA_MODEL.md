# Data model

Session object (`localStorage['labpm_v1']`, snapshot entries in `labpm_snaps_v1`, exported `.json` files). Schema version `v: 1`. All input is passed through `normSession()` (see `index.html`); invalid structure → rejected, invalid values → coerced.

## Top level

| Key | Type | Notes |
|---|---|---|
| `v` | `1` | Required; other values rejected |
| `me` | id | Current user; falls back to first user |
| `files` | attachment records | Optional (older sessions: `[]`); ≤ 5000 |
| `users` `projects` `tasks` `fields` `rules` `goals` `docs` | arrays | ≤ 5000 items each; every item needs `id` matching `^[A-Za-z0-9_-]{1,40}$` |
| `activity` | `{t:number,u:id,m:string}[]` | ≤ 300 (newest first) |
| `ui` | object | View, filters, theme, widgets… (drawer and confirmation flags reset on load) |
| `demo` | boolean | Marks seeded data |

## Entities

### user
`{id, name, role, cap}` — `role ∈ Admin | Project manager | Researcher | Viewer` (unknown → Viewer); `cap` = capacity h/week (≥ 0).

### project
`{id, name, c, status}` — `c` colour index (mod 6); `status ∈ auto | On track | At risk | On hold | Done`.

### task
| Field | Type | Notes |
|---|---|---|
| `id`, `projectId` | string | |
| `title`, `notes` | string | |
| `status` | `Triage | To do | In progress | In review | Done` | unknown → To do |
| `priority` | `Low | Medium | High | Critical` | unknown → Medium |
| `assignee` | id \| null | |
| `start`, `due` | `YYYY-MM-DD` | **Required**; invalid → whole session rejected |
| `est` | number ≥ 0 | estimated hours |
| `deps` | id[] | predecessors (finish-to-start) |
| `tags` | string[] | |
| `cf` | `{[fieldId]: value}` | custom-field values |
| `log` | `{id, u, date, h, note}[]` | time entries |
| `timer` | `{user,start}` \| null | **Never imported** (forced to null) |
| `created` | epoch ms | |
| `src`, `requester` | string | Set for intake requests (`src:"form"`) |
| `ovFired` | boolean | Overdue automation already fired |

### field (custom)
`{id, name, type, options?, formula?}` — `type ∈ text | number | select | date | checkbox | formula`. Conventional names used by features: `Instrument` (select), `No. of samples` (number), `Lot` (text).

### rule
```json
{ "id":"r1","name":"Sample archive","on":true,
  "trigger":{"type":"status_to","value":"Done"},
  "cond":{"type":"tag","value":"to-archive"},
  "action":{"type":"create_task","value":"Archive residual samples"} }
```
`trigger.type ∈ status_to | created | overdue`; `cond.type ∈ none | project | priority | tag`; `action.type ∈ notify | set_assignee | set_priority | set_status | add_tag | create_task`. Rules with unknown types are dropped.

### file (attachment record)
`{id, taskId, projectId, name, path, size, type, added, by}` — `path` is relative to the backup folder (`attachments/<owner-folder>/<name>`); `taskId` empty = project-level; `added` epoch ms; `by` user id. The binary lives only in the folder, never in the JSON.

### goal
`{id, name, target:"YYYY-MM-DD", pids:id[]}`

### doc
`{id, title, body, projectId, taskId, updated}`

## Example (minimal valid session)

```json
{
  "v": 1,
  "me": "u1",
  "users":   [{"id":"u1","name":"A. Rossi","role":"Admin","cap":40}],
  "projects":[{"id":"p1","name":"Demo","c":0,"status":"auto"}],
  "tasks":   [{"id":"t1","projectId":"p1","title":"DSC run","status":"To do","assignee":"u1",
               "priority":"Medium","start":"2026-11-02","due":"2026-11-03","est":4,
               "deps":[],"tags":[],"cf":{},"notes":"","log":[]}],
  "fields":[], "rules":[], "goals":[], "docs":[], "activity":[]
}
```

## Compatibility

- Sessions from the Italian prototype use Italian enumerations (`Da fare`, `Ricercatore`, …). They load, but statuses become *To do* and roles *Viewer*. To migrate, find-and-replace the enumeration values in the JSON before importing: `Da triare→Triage`, `Da fare→To do`, `In corso→In progress`, `In revisione→In review`, `Completato→Done`, `Bassa→Low`, `Media→Medium`, `Alta→High`, `Critica→Critical`, `Ricercatore→Researcher`, `Visualizzatore→Viewer`, `In linea→On track`, `A rischio→At risk`, `Sospeso→On hold`; field names `Strumento→Instrument`, `N. campioni→No. of samples`, `Lotto→Lot`; formula variable `{registrate}→{logged}`.
- Changing `v` is reserved for breaking schema changes; a migration step will be added in `normSession`.

---
© Flavio Pendolino, 2026. This document is distributed under the CC BY-NC 4.0 license (https://creativecommons.org/licenses/by-nc/4.0).
