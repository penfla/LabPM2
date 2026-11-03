#!/usr/bin/env node
/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.6
 * License: Apache License 2.0
 * Commercial use: permitted under the Apache License 2.0
 * Purpose: Convert a LabPM v1.3 session file to v2 and optionally import it (with attachments) into a v2 server
 * Method: enumeration renames, validation with shared/validate.js, people matched to accounts by display name, upload via the REST API
 * Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
 * Third-party components: none (Node.js built-ins only)
 * Scientific references: n/a
 * AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
 *
 * (c) 2026 Flavio Pendolino | Apache License 2.0
 */
'use strict';
var fs = require('node:fs');
var path = require('node:path');
var V = require('../shared/validate');

/* Italian prototype -> English enumerations (see docs/DATA_MODEL.md "Compatibility") */
var ENUM = {
  'Da triare': 'Triage', 'Da fare': 'To do', 'In corso': 'In progress', 'In revisione': 'In review', 'Completato': 'Done',
  'Bassa': 'Low', 'Media': 'Medium', 'Alta': 'High', 'Critica': 'Critical',
  'Ricercatore': 'Researcher', 'Visualizzatore': 'Viewer',
  'In linea': 'On track', 'A rischio': 'At risk', 'Sospeso': 'On hold'
};
var FIELD = { 'Strumento': 'Instrument', 'N. campioni': 'No. of samples', 'Lotto': 'Lot' };
var COLLECTIONS = ['users', 'projects', 'fields', 'rules', 'goals', 'tasks', 'docs'];

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function tr(v, rep) { if (typeof v === 'string' && Object.prototype.hasOwnProperty.call(ENUM, v)) { rep.translated++; return ENUM[v]; } return v; }
function fixFormula(f, rep) {
  if (typeof f !== 'string') return f;
  return f.replace(/\{([^}]+)\}/g, function (m, n) {
    n = n.trim();
    var to = n === 'registrate' ? 'logged' : FIELD[n];
    if (to) { rep.translated++; return '{' + to + '}'; }
    return m;
  });
}

/*
 * migrate(session, opts): pure conversion. opts.people = 'skip' | 'placeholders'; opts.userMap = {v1UserId: v2UserId} for people that already exist.
 * Returns { session, report }.
 */
function migrate(input, opts) {
  opts = opts || {};
  var rep = { translated: 0, kept: {}, skipped: [], depsRemoved: 0, assigneesCleared: 0, assigneesRemapped: 0, timersDropped: 0, attachmentRecords: [], warnings: [] };
  if (!input || typeof input !== 'object' || input.v !== 1) throw new Error('not a LabPM session file (schema "v": 1 expected)');
  var o = clone(input), userMap = opts.userMap || {}, keepPeople = opts.people === 'placeholders';
  (o.users || []).forEach(function (u) { u.role = tr(u.role, rep); });
  (o.projects || []).forEach(function (p) { p.status = tr(p.status, rep); });
  (o.fields || []).forEach(function (f) {
    if (f && typeof f.name === 'string' && FIELD[f.name]) { f.name = FIELD[f.name]; rep.translated++; }
    if (f && f.formula) f.formula = fixFormula(f.formula, rep);
    if (f && Array.isArray(f.options)) f.options = f.options.map(function (x) { return tr(x, rep); });
  });
  (o.rules || []).forEach(function (r) {
    if (!r || typeof r !== 'object') return;
    if (r.trigger && r.trigger.type === 'status_to') r.trigger.value = tr(r.trigger.value, rep);
    if (r.cond && r.cond.type === 'priority') r.cond.value = tr(r.cond.value, rep);
    if (r.action && (r.action.type === 'set_status' || r.action.type === 'set_priority')) r.action.value = tr(r.action.value, rep);
  });
  (o.tasks || []).forEach(function (t) { t.status = tr(t.status, rep); t.priority = tr(t.priority, rep); if (t.timer) { rep.timersDropped++; t.timer = null; } });

  /* people: map to existing accounts, keep as placeholders, or clear */
  var v1Users = (o.users || []).filter(function (u) { return u && typeof u.id === 'string'; });
  var known = {};
  v1Users.forEach(function (u) { known[u.id] = userMap[u.id] || (keepPeople ? u.id : null); });
  var origAssignee = {};
  var mapUser = function (id) { if (id == null) return null; if (!(id in known)) return null; return known[id]; };
  (o.tasks || []).forEach(function (t) {
    if (t.assignee != null) { origAssignee[t.id] = t.assignee; t.assignee = mapUser(t.assignee); }
    if (Array.isArray(t.log)) t.log.forEach(function (l) { if (l) l.u = mapUser(l.u); });
  });
  var people = keepPeople ? v1Users.filter(function (u) { return !userMap[u.id]; }) : [];

  var out = { v: 1 };
  var ids = {};
  COLLECTIONS.forEach(function (k) {
    var src = k === 'users' ? people : (o[k] || []);
    out[k] = []; ids[k] = {};
    src.forEach(function (r) {
      try {
        var d = V.normalize(k, r);
        if (ids[k][d.id]) throw new Error('duplicate id');
        ids[k][d.id] = 1; out[k].push(d);
      } catch (e) { rep.skipped.push({ kind: k, id: r && r.id, reason: e.message }); }
    });
    rep.kept[k] = out[k].length;
  });
  /* references that would dangle after skipped records */
  out.tasks.forEach(function (t) {
    if (origAssignee[t.id] != null) { if (t.assignee === null) rep.assigneesCleared++; else if (t.assignee !== origAssignee[t.id]) rep.assigneesRemapped++; }
    var n = t.deps.length;
    t.deps = t.deps.filter(function (d) { return ids.tasks[d]; });
    rep.depsRemoved += n - t.deps.length;
    if (t.projectId && !ids.projects[t.projectId]) { rep.warnings.push('task "' + t.title + '" refers to a missing project'); }
  });
  rep.attachmentRecords = (Array.isArray(o.files) ? o.files : []).filter(function (f) { return f && typeof f === 'object'; });
  out.files = []; // binaries are re-attached by upload (see --attachments) or by hand; records without files would be dead links
  return { session: out, report: rep };
}

function formatReport(rep, extra) {
  var l = ['LabPM v1.3 -> v2 migration report'];
  Object.keys(rep.kept).forEach(function (k) { l.push('  ' + k + ': ' + rep.kept[k]); });
  l.push('  enumeration/field renames (Italian prototype): ' + rep.translated);
  l.push('  running timers dropped: ' + rep.timersDropped);
  l.push('  dependencies removed (target missing): ' + rep.depsRemoved);
  l.push('  assignees remapped to existing accounts: ' + rep.assigneesRemapped + ', cleared: ' + rep.assigneesCleared);
  l.push('  attachment records in the file: ' + rep.attachmentRecords.length);
  if (extra) extra.forEach(function (x) { l.push('  ' + x); });
  rep.skipped.forEach(function (s) { l.push('  SKIPPED ' + s.kind + ' ' + s.id + ': ' + s.reason); });
  rep.warnings.forEach(function (w) { l.push('  WARNING ' + w); });
  return l.join('\n');
}

/* ---- server import ---- */
function http(base, cookie) {
  return function (method, p, body, headers) {
    var h = Object.assign({}, headers || {});
    if (cookie.v) h.cookie = cookie.v;
    if (body !== undefined && !Buffer.isBuffer(body)) { h['content-type'] = 'application/json'; body = JSON.stringify(body); }
    return fetch(base + p, { method: method, headers: h, body: body }).then(function (r) {
      var sc = r.headers.get('set-cookie');
      if (sc) cookie.v = sc.split(';')[0];
      return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; });
    });
  };
}
function safeJoin(root, rel) {
  var f = path.resolve(root, String(rel || '').replace(/^[\\/]+/, '')), r = path.resolve(root);
  return f.indexOf(r + path.sep) === 0 ? f : null;
}

async function run(argv) {
  var a = { _: [] };
  for (var i = 0; i < argv.length; i++) {
    var x = argv[i];
    if (x === '--dry-run') a.dry = true;
    else if (/^--(out|attachments|server|user|password|people)$/.test(x)) a[x.slice(2)] = argv[++i];
    else a._.push(x);
  }
  if (!a._[0]) throw new Error('usage: node tools/migrate-v1.js <session.json> [--out file] [--people skip|placeholders] [--server URL --user NAME [--password PW]] [--attachments <v1 backup folder>] [--dry-run]');
  var people = a.people || 'skip';
  if (people !== 'skip' && people !== 'placeholders') throw new Error('--people must be skip or placeholders');
  var input = JSON.parse(fs.readFileSync(a._[0], 'utf8'));
  var extra = [], userMap = {}, call = null, existing = [];
  if (a.server) {
    call = http(a.server.replace(/\/+$/, ''), {});
    var pw = a.password || process.env.LABPM_PASSWORD;
    if (!a.user || !pw) throw new Error('--server needs --user and --password (or LABPM_PASSWORD)');
    var lg = await call('POST', '/api/login', { username: a.user, password: pw });
    if (lg.s !== 200) throw new Error('login failed (' + lg.s + ')');
    if (lg.j.user.role !== 'Admin') throw new Error('the account must be an Admin');
    existing = (await call('GET', '/api/state')).j.state.users;
    var byName = {};
    existing.forEach(function (u) { byName[u.name.trim().toLowerCase()] = u.id; });
    (input.users || []).forEach(function (u) { var m = u && typeof u.name === 'string' && byName[u.name.trim().toLowerCase()]; if (m) userMap[u.id] = m; });
    extra.push('people matched to existing accounts by display name: ' + Object.keys(userMap).length + ' of ' + (input.users || []).length);
  }
  var res = migrate(input, { people: people, userMap: userMap });
  if (a.server) { // placeholders must not collide with existing ids
    var taken = {}; existing.forEach(function (u) { taken[u.id] = 1; });
    res.session.users.forEach(function (u) {
      if (!taken[u.id]) return;
      var nid = 'm' + Math.random().toString(36).slice(2, 10);
      res.session.tasks.forEach(function (t) { if (t.assignee === u.id) t.assignee = nid; t.log.forEach(function (l) { if (l.u === u.id) l.u = nid; }); });
      u.id = nid;
    });
  }
  var out = a.out || a._[0].replace(/\.json$/i, '') + '.v2.json';
  if (!a.dry) fs.writeFileSync(out, JSON.stringify(res.session, null, 1));
  extra.push(a.dry ? 'dry run: nothing written' : 'converted file: ' + out);
  var uploaded = 0, missing = [];
  if (a.server && !a.dry) {
    var imp = await call('POST', '/api/import' + (res.session.users.length ? '?users=1' : ''), res.session);
    if (imp.s !== 200) throw new Error('import failed (' + imp.s + '): ' + (imp.j.error || ''));
    extra.push('imported into ' + a.server + ': ' + imp.j.imported + ' records');
    if (a.attachments) {
      var taskIds = {}; res.session.tasks.forEach(function (t) { taskIds[t.id] = 1; });
      var projIds = {}; res.session.projects.forEach(function (p) { projIds[p.id] = 1; });
      for (var k = 0; k < res.report.attachmentRecords.length; k++) {
        var f = res.report.attachmentRecords[k], fp = safeJoin(a.attachments, f.path);
        if (!fp || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) { missing.push(f.name || f.path); continue; }
        var q = 'name=' + encodeURIComponent(f.name || path.basename(fp)) + (f.taskId && taskIds[f.taskId] ? '&taskId=' + encodeURIComponent(f.taskId) : (f.projectId && projIds[f.projectId] ? '&projectId=' + encodeURIComponent(f.projectId) : ''));
        var up = await call('POST', '/api/files?' + q, fs.readFileSync(fp), { 'content-type': f.type || 'application/octet-stream' });
        if (up.s === 201) uploaded++; else missing.push((f.name || f.path) + ' (' + (up.j.error || up.s) + ')');
      }
      extra.push('attachments uploaded: ' + uploaded + ', not found or rejected: ' + missing.length);
      missing.forEach(function (m) { extra.push('  missing: ' + m); });
    } else if (res.report.attachmentRecords.length) {
      extra.push('attachments were NOT transferred (add --attachments <v1 backup folder>)');
    }
  }
  return { report: res.report, text: formatReport(res.report, extra), uploaded: uploaded, missing: missing, out: out, session: res.session };
}

module.exports = { migrate: migrate, run: run, formatReport: formatReport };
if (require.main === module) {
  run(process.argv.slice(2)).then(function (r) { console.log(r.text); }, function (e) { console.error('Error: ' + e.message); process.exit(1); });
}
