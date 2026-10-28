/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.1
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: Server-side date cascade, automations, overdue sweep and timer stop (moved from the v1.3 client)
 * Method: finish-to-start shift on working days; rules trigger status_to|created|overdue with depth limit 3; runs inside the mutation transaction
 * Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
 * Third-party components: none (Node.js built-ins only)
 * Scientific references: n/a
 * AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
 *
 * (c) 2026 Flavio Pendolino | PolyForm Noncommercial 1.0.0
 */
'use strict';

/* working-day date helpers (local calendar dates, YYYY-MM-DD; same rules as the v1.3 client) */
var pad = function (n) { return String(n).padStart(2, '0'); };
var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
var pd = function (s) { var a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); };
var addD = function (s, n) { var d = pd(s); d.setDate(d.getDate() + n); return iso(d); };
var isWE = function (d) { return d.getDay() === 0 || d.getDay() === 6; };
var normWD = function (s) { var d = pd(s); while (isWE(d)) d.setDate(d.getDate() + 1); return iso(d); };
var nextWD = function (s) { var d = pd(addD(s, 1)); while (isWE(d)) d.setDate(d.getDate() + 1); return iso(d); };
var addWD = function (s, n) { var c = normWD(s); for (var i = 0; i < n; i++) c = nextWD(c); return c; };
var diffWD = function (a, b) { var n = 0, c = a; while (c < b && n < 500) { c = nextWD(c); n++; } return n; };

/*
 * Engine: applies cascade, automations, overdue and timer-stop rules to an in-memory task list.
 * tasks: array of task objects (mutated in place); touched ids are collected in .touched.
 */
function Engine(tasks, rules, o) {
  this.tasks = tasks.slice();
  this.byId = {};
  var self = this;
  tasks.forEach(function (t) { self.byId[t.id] = t; });
  this.rules = rules || [];
  this.today = o.today;
  this.now = o.now;
  this.uid = o.uid;
  this.touched = {};
  this.created = {};
  this.notices = [];
}
Engine.prototype.touch = function (t) { this.touched[t.id] = true; };
Engine.prototype.blockers = function (t) {
  var by = this.byId;
  return t.deps.map(function (d) { return by[d]; }).filter(function (x) { return x && x.status !== 'Done'; });
};
Engine.prototype.cascadeFrom = function (p, seen) {
  seen = seen || {};
  if (seen[p.id] || p.status === 'Done') return;
  seen[p.id] = 1;
  var self = this;
  this.tasks.filter(function (x) { return x.deps.indexOf(p.id) >= 0 && x.status !== 'Done'; }).forEach(function (x) {
    if (x.start <= p.due) {
      var dur = diffWD(x.start, x.due), ns = nextWD(p.due);
      x.start = ns; x.due = addWD(ns, dur); x.ovFired = false; self.touch(x);
      self.cascadeFrom(x, seen);
    }
  });
};
Engine.prototype.condOK = function (c, t) {
  if (!c || c.type === 'none') return true;
  if (c.type === 'project') return t.projectId === c.value;
  if (c.type === 'priority') return t.priority === c.value;
  if (c.type === 'tag') return t.tags.indexOf(c.value) >= 0;
  return true;
};
Engine.prototype.statusChanged = function (t, depth) {
  if (t.status === 'Done' && t.timer) this.stopTimer(t);
  this.fire({ type: 'status_to', value: t.status }, t, depth);
};
Engine.prototype.stopTimer = function (t) {
  var h = Math.round((this.now - t.timer.start) / 36e5 * 100) / 100;
  if (h >= 0.01) t.log.push({ id: this.uid('l'), u: t.timer.user, date: this.today, h: h, note: 'Timer' });
  t.timer = null; this.touch(t);
};
Engine.prototype.fire = function (tr, t, depth) {
  depth = depth || 0;
  if (depth > 3) return;
  var self = this;
  this.rules.filter(function (r) {
    return r.on && r.trigger.type === tr.type && (tr.type !== 'status_to' || r.trigger.value === tr.value) && self.condOK(r.cond, t);
  }).forEach(function (r) {
    var a = r.action;
    if (a.type === 'set_assignee') { t.assignee = a.value || null; self.touch(t); }
    else if (a.type === 'set_priority') { t.priority = a.value; self.touch(t); }
    else if (a.type === 'set_status') {
      if (t.status !== a.value) { t.status = a.value; self.touch(t); self.statusChanged(t, depth + 1); }
    }
    else if (a.type === 'add_tag') { if (t.tags.indexOf(a.value) < 0) { t.tags.push(a.value); self.touch(t); } }
    else if (a.type === 'create_task') {
      var s = nextWD(self.today);
      var n = { id: self.uid('t'), projectId: t.projectId, title: a.value, notes: '', status: 'To do', priority: 'Medium', assignee: t.assignee, start: s, due: addWD(s, 2), est: 0, deps: [], tags: [], cf: {}, log: [], timer: null, created: self.now, ovFired: false };
      self.tasks.push(n); self.byId[n.id] = n; self.touch(n); self.created[n.id] = true;
      self.fire({ type: 'created' }, n, depth + 1);
    }
    else if (a.type === 'notify') self.notices.push({ rule: r.id, text: a.value + ' ("' + t.title + '")' });
  });
};
/* prev: task before the change (null if created); t: task after (already in the list) */
Engine.prototype.update = function (prev, t) {
  if (!prev) { this.fire({ type: 'created' }, t, 0); return; }
  if (prev.status !== t.status) this.statusChanged(t, 0);
  if (prev.start !== t.start || prev.due !== t.due) { t.ovFired = false; this.touch(t); this.cascadeFrom(t); }
  var self = this;
  t.deps.filter(function (d) { return prev.deps.indexOf(d) < 0; }).forEach(function (d) { if (self.byId[d]) self.cascadeFrom(self.byId[d]); });
};
Engine.prototype.checkOverdue = function () {
  var self = this;
  this.tasks.slice().forEach(function (t) {
    if (t.status !== 'Done' && t.due < self.today && !t.ovFired) { t.ovFired = true; self.touch(t); self.fire({ type: 'overdue' }, t, 0); }
  });
};

module.exports = { Engine: Engine, iso: iso, addWD: addWD, nextWD: nextWD, normWD: normWD, diffWD: diffWD };
