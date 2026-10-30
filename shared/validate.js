/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.2
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: Entity validation/normalisation (schema v1 of docs/DATA_MODEL.md)
 * Method: whitelist of enumerations, ISO dates, id regex; invalid structure throws, invalid values are coerced
 * Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
 * AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
 *
 * (c) 2026 Flavio Pendolino | PolyForm Noncommercial 1.0.0
 */
'use strict';

var ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
var ROLES = ['Admin', 'Project manager', 'Researcher', 'Viewer'];
var STATUS = ['Triage', 'To do', 'In progress', 'In review', 'Done'];
var PRIO = ['Low', 'Medium', 'High', 'Critical'];
var PSTATUS = ['auto', 'On track', 'At risk', 'On hold', 'Done'];

function bad(m) { var e = new Error(m); e.status = 400; throw e; }
function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 2000) : ''; }
function num(v, d) { v = +v; return isFinite(v) && v >= 0 ? v : d; }
function pick(v, list, d) { return list.indexOf(v) >= 0 ? v : d; }
function strArr(a, max) { return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string'; }).slice(0, max || 200).map(function (x) { return x.slice(0, 80); }) : []; }
function idOrNull(v) { return typeof v === 'string' && ID_RE.test(v) ? v : null; }
function isDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  var d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

var N = {
  users: function (o) { return { id: o.id, name: str(o.name, 120) || 'User', role: pick(o.role, ROLES, 'Viewer'), cap: num(o.cap, 40) }; },
  projects: function (o) { return { id: o.id, name: str(o.name, 160) || 'Project', c: (num(o.c, 0) | 0) % 6, status: pick(o.status, PSTATUS, 'auto') }; },
  tasks: function (o) {
    if (!isDate(o.start) || !isDate(o.due)) bad('start/due must be valid YYYY-MM-DD');
    var t = {
      id: o.id, projectId: idOrNull(o.projectId), title: str(o.title, 300) || 'Untitled', notes: str(o.notes, 20000),
      status: pick(o.status, STATUS, 'To do'), priority: pick(o.priority, PRIO, 'Medium'), assignee: idOrNull(o.assignee),
      start: o.start, due: o.due, est: num(o.est, 0), deps: Array.isArray(o.deps) ? o.deps.filter(function (x) { return idOrNull(x) && x !== o.id; }).slice(0, 100) : [],
      tags: strArr(o.tags), cf: o.cf && typeof o.cf === 'object' && !Array.isArray(o.cf) ? o.cf : {},
      log: Array.isArray(o.log) ? o.log.slice(0, 2000).map(function (l) { return { id: str(l && l.id, 40), u: idOrNull(l && l.u), date: isDate(l && l.date) ? l.date : o.start, h: num(l && l.h, 0), note: str(l && l.note, 500) }; }) : [],
      timer: o.timer && idOrNull(o.timer.user) && isFinite(+o.timer.start) ? { user: o.timer.user, start: +o.timer.start } : null,
      created: isFinite(+o.created) ? +o.created : Date.now(), ovFired: !!o.ovFired
    };
    if (o.src === 'form') { t.src = 'form'; t.requester = str(o.requester, 120); }
    if (o.start > o.due) bad('start after due');
    return t;
  },
  fields: function (o) {
    var f = { id: o.id, name: str(o.name, 80) || 'Field', type: pick(o.type, ['text', 'number', 'select', 'date', 'checkbox', 'formula'], 'text') };
    if (f.type === 'select') f.options = strArr(o.options, 100);
    if (f.type === 'formula') f.formula = str(o.formula, 500);
    return f;
  },
  rules: function (o) {
    var tr = o.trigger || {}, cd = o.cond || {}, ac = o.action || {};
    if (['status_to', 'created', 'overdue'].indexOf(tr.type) < 0) bad('unknown trigger');
    if (['notify', 'set_assignee', 'set_priority', 'set_status', 'add_tag', 'create_task'].indexOf(ac.type) < 0) bad('unknown action');
    return { id: o.id, name: str(o.name, 120), on: o.on !== false,
      trigger: { type: tr.type, value: str(tr.value, 120) },
      cond: { type: pick(cd.type, ['none', 'project', 'priority', 'tag'], 'none'), value: str(cd.value, 120) },
      action: { type: ac.type, value: str(ac.value, 300) } };
  },
  goals: function (o) { return { id: o.id, name: str(o.name, 160), target: isDate(o.target) ? o.target : '', pids: Array.isArray(o.pids) ? o.pids.filter(idOrNull) : [] }; },
  docs: function (o) { return { id: o.id, title: str(o.title, 200), body: str(o.body, 200000), projectId: idOrNull(o.projectId), taskId: idOrNull(o.taskId), updated: isFinite(+o.updated) ? +o.updated : Date.now() }; },
  templates: function (o) {
    var steps = Array.isArray(o.tasks) ? o.tasks.slice(0, 60) : [];
    if (!steps.length) bad('a template needs at least one step');
    return { id: o.id, name: str(o.name, 120) || 'Template', desc: str(o.desc, 500), tasks: steps.map(function (x, i) {
      x = x && typeof x === 'object' ? x : {};
      var after = Array.isArray(x.after) ? x.after.filter(function (k, j, a) { return Number.isInteger(k) && k >= 0 && k < i && a.indexOf(k) === j; }) : [];
      var s = { t: str(x.t, 300) || 'Step ' + (i + 1), d: Math.min(60, Math.max(1, Math.round(num(x.d, 1)))), est: num(x.est, 0) };
      var tool = str(x.tool, 40); if (tool) s.tool = tool;
      if (after.length) s.after = after;
      return s;
    }) };
  },
  files: function (o) { return { id: o.id, taskId: idOrNull(o.taskId), projectId: idOrNull(o.projectId), name: str(o.name, 255), path: str(o.path, 400), size: num(o.size, 0), type: str(o.type, 120), added: isFinite(+o.added) ? +o.added : Date.now(), by: idOrNull(o.by) }; }
};

function normalize(kind, o) {
  if (!N[kind]) bad('unknown collection');
  if (!o || typeof o !== 'object' || Array.isArray(o)) bad('object expected');
  if (typeof o.id !== 'string' || !ID_RE.test(o.id)) bad('invalid id');
  return N[kind](o);
}

module.exports = { normalize: normalize, ID_RE: ID_RE, ROLES: ROLES, isDate: isDate };
