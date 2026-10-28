# Migrating from LabPM v1.3 (standalone) to v2

Author: Flavio Pendolino · Version: 2.0.0-beta.1 · License: PolyForm Noncommercial 1.0.0 · Commercial use: penfla@me.com
Purpose: move the data of a v1.3 browser database into the v2 server. Method: export JSON in v1.3, import in v2. Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).

## Steps

1. **In v1.3** (https://github.com/penfla/LabPM): *Session → Save to file* → `labpm-session-YYYY-MM-DD.json`. Sessions from the Italian prototype need the enumeration rename listed in `docs/DATA_MODEL.md` first.
2. **Install v2** (README, Quick start) and create the Admin on first visit; add the colleagues' accounts in *Settings → Users and roles*.
3. **In v2**: *Data & sync → Import a session file*, pick the file.
   - Tick *Import people as placeholders* only if the tasks must keep their assignees and hour logs. Placeholders have **no login** and an Admin becomes Viewer; afterwards give each colleague a real account and reassign their tasks, or delete the placeholders. Without the tick, people in the file are ignored and assignments show *—*.
   - Records with the same id are overwritten; nothing is deleted. Running timers are dropped.
4. **Attachments** of v1.3 live in `<backup folder>/attachments/…` and are not part of the JSON: re-attach the files you still need (*Files* page). Links in the imported records point to the old local folder and are not imported.
5. Check *Tasks*, *Portfolio* and *Automations*. Date cascade and automations now run on the server: the first change to a task may shift successors that were inconsistent in the old data.
6. Keep the v1.3 file and the old backup folder until you have verified the import.

## What is different

| v1.3 | v2 |
|---|---|
| Data in the browser (`localStorage`), per PC | One shared database on the server, live updates |
| Backup folder / snapshots / save to file | Automatic daily server backups, restore in the UI, full JSON export |
| User switcher, roles only in the UI | Real login, roles enforced by the server |
| Attachments copied into a local folder | Attachments stored on the server |
| Automations and cascade in each browser | Run once on the server |
| Google Fonts | None (no third-party requests) |

---
© Flavio Pendolino, 2026. This document is distributed under the CC BY-NC 4.0 license (https://creativecommons.org/licenses/by-nc/4.0).
