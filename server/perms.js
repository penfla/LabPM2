/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.2
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: Server-side role matrix (same as USER_GUIDE section 10)
 * Method: pure function can(user, op, kind, current, next) -> boolean
 * Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
 * AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
 *
 * (c) 2026 Flavio Pendolino | PolyForm Noncommercial 1.0.0
 */
'use strict';

var KINDS = ['users', 'projects', 'tasks', 'fields', 'rules', 'goals', 'docs', 'files', 'templates'];
// task fields a Researcher may change on a task assigned to them
var RESEARCHER_TASK_KEYS = ['status', 'notes', 'est', 'tags', 'cf', 'log', 'timer', 'ovFired', 'priority'];

function can(user, op, kind, cur, next) {
  var r = user.role;
  if (r === 'Admin') return true;
  if (r === 'Viewer') return false;
  if (kind === 'users') return false;
  if (r === 'Project manager') return true;
  // Researcher
  if (kind === 'docs' || kind === 'files') return op !== 'delete' || (kind === 'files' && cur && cur.by === user.id);
  if (kind === 'tasks') {
    if (op === 'create') return !!next && next.src === 'form' && next.status === 'Triage';
    if (op === 'delete') return false;
    if (!cur || cur.assignee !== user.id) return false;
    // update: only whitelisted keys may differ
    var keys = Object.keys(next || {});
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (RESEARCHER_TASK_KEYS.indexOf(k) < 0 && JSON.stringify(next[k]) !== JSON.stringify(cur[k])) return false;
    }
    return true;
  }
  return false; // projects, fields, rules, goals: Admin / Project manager only
}

module.exports = { can: can, KINDS: KINDS };
