/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.6
 * License: Apache License 2.0
 * Commercial use: permitted under the Apache License 2.0
 * Purpose: Server-side role matrix (same as USER_GUIDE section 10)
 * Method: pure function can(user, op, kind, current, next) -> boolean
 * Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
 * AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
 *
 * (c) 2026 Flavio Pendolino | Apache License 2.0
 */
'use strict';

var KINDS = ['users', 'projects', 'tasks', 'fields', 'rules', 'goals', 'docs', 'files', 'templates'];
// task fields a Researcher may change on a task assigned to them
var RESEARCHER_TASK_KEYS = ['status', 'notes', 'est', 'tags', 'cf', 'log', 'timer', 'ovFired', 'priority', 'checklist'];
// extra keys on a subtask the Researcher is assigned to
var RESEARCHER_SUBTASK_KEYS = ['title', 'start', 'due'];

function can(user, op, kind, cur, next, ctx) {
  var r = user.role;
  if (r === 'Admin') return true;
  if (r === 'Viewer') return false;
  if (kind === 'users') return false;
  if (r === 'Project manager') return true;
  // Researcher
  if (kind === 'docs' || kind === 'files') return op !== 'delete' || (kind === 'files' && cur && cur.by === user.id);
  if (kind === 'tasks') {
    var parentOf = function (t) { return t && t.parent && ctx && ctx.task ? ctx.task(t.parent) : null; };
    if (op === 'create') {
      if (!next) return false;
      if (next.src === 'form' && next.status === 'Triage') return true;
      // a subtask under a task assigned to them, assigned to them
      var par = parentOf(next);
      return !!par && par.assignee === user.id && next.assignee === user.id;
    }
    if (op === 'delete') { var pp = parentOf(cur); return !!cur && !!pp && cur.assignee === user.id && pp.assignee === user.id; }
    if (!cur || cur.assignee !== user.id) return false;
    // update: only whitelisted keys may differ
    var keys = Object.keys(next || {}), extra = cur.parent ? RESEARCHER_SUBTASK_KEYS : [];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (RESEARCHER_TASK_KEYS.indexOf(k) < 0 && extra.indexOf(k) < 0 && JSON.stringify(next[k]) !== JSON.stringify(cur[k])) return false;
    }
    return true;
  }
  return false; // projects, fields, rules, goals: Admin / Project manager only
}

module.exports = { can: can, KINDS: KINDS };
