/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.6
 * License: Apache License 2.0
 * Commercial use: permitted under the Apache License 2.0
 * Purpose: Tests for the v1.3 -> v2 migration tool
 * Method: pure conversion cases and a CLI run against an in-memory server
 * Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
 * Third-party components: none (Node.js built-ins only)
 * Scientific references: n/a
 * AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
 *
 * (c) 2026 Flavio Pendolino | Apache License 2.0
 */
'use strict';
var test = require('node:test');
var assert = require('node:assert');
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');
var mig = require('../tools/migrate-v1');
var app = require('../server/app');

var task = function (id, extra) { return Object.assign({ id: id, projectId: 'p1', title: 'T ' + id, status: 'Da fare', priority: 'Media', assignee: 'u2', start: '2026-11-02', due: '2026-11-03', est: 4, deps: [], tags: [], cf: {}, notes: '', log: [] }, extra || {}); };
function v1() {
  return { v: 1, me: 'u1', activity: [{ t: 1, u: 'u1', m: 'x' }], ui: { view: 'tasks' },
    users: [{ id: 'u1', name: 'A. Rossi', role: 'Admin', cap: 40 }, { id: 'u2', name: 'L. Bianchi', role: 'Ricercatore', cap: 36 }, { id: 'u3', name: 'M. Verdi', role: 'Visualizzatore', cap: 0 }],
    projects: [{ id: 'p1', name: 'Film', c: 1, status: 'A rischio' }],
    fields: [{ id: 'f1', name: 'Strumento', type: 'select', options: ['DSC'] }, { id: 'f2', name: 'N. campioni', type: 'number' }, { id: 'f4', name: 'Ore', type: 'formula', formula: '{est}/{N. campioni}+{registrate}' }],
    rules: [{ id: 'r1', name: 'Done', on: true, trigger: { type: 'status_to', value: 'Completato' }, cond: { type: 'priority', value: 'Alta' }, action: { type: 'set_priority', value: 'Critica' } }],
    goals: [], docs: [{ id: 'd1', title: 'SOP', body: '# x', projectId: 'p1', taskId: '' }],
    tasks: [task('t1', { timer: { user: 'u2', start: 5 }, log: [{ id: 'l1', u: 'u2', date: '2026-11-02', h: 2, note: '' }] }), task('t2', { deps: ['t1', 'ghost'], status: 'In corso', assignee: 'u9' }), task('bad', { start: '2026-13-40' })],
    files: [{ id: 'f1', taskId: 't1', projectId: 'p1', name: 'report.txt', path: 'attachments/task-t1/report.txt', size: 10, type: 'text/plain', added: 1, by: 'u1' }] };
}

test('migrate: Italian enumerations, formulas, timers, dangling references, invalid records', function () {
  var r = mig.migrate(v1(), { people: 'skip' }), s = r.session;
  assert.strictEqual(s.projects[0].status, 'At risk');
  assert.deepStrictEqual(s.fields.map(function (f) { return f.name; }), ['Instrument', 'No. of samples', 'Ore']);
  assert.strictEqual(s.fields[2].formula, '{est}/{No. of samples}+{logged}');
  assert.deepStrictEqual([s.rules[0].trigger.value, s.rules[0].cond.value, s.rules[0].action.value], ['Done', 'High', 'Critical']);
  var t1 = s.tasks.find(function (t) { return t.id === 't1'; }), t2 = s.tasks.find(function (t) { return t.id === 't2'; });
  assert.deepStrictEqual([t1.status, t1.priority, t1.timer], ['To do', 'Medium', null]);
  assert.deepStrictEqual(t2.deps, ['t1']); assert.strictEqual(t2.status, 'In progress');
  assert.strictEqual(s.tasks.length, 2); assert.strictEqual(r.report.skipped[0].id, 'bad');
  assert.strictEqual(r.report.timersDropped, 1); assert.strictEqual(r.report.depsRemoved, 1);
  assert.strictEqual(s.users.length, 0); assert.strictEqual(t1.assignee, null); assert.strictEqual(t1.log[0].u, null); // people skipped -> cleared, not dangling
  assert.deepStrictEqual(s.files, []); assert.strictEqual(r.report.attachmentRecords.length, 1);
  assert.strictEqual(s.ui, undefined); assert.strictEqual(s.activity, undefined);
});
test('migrate: placeholders keep people (Viewer role translated); userMap remaps to existing accounts; rejects non-sessions', function () {
  var r = mig.migrate(v1(), { people: 'placeholders', userMap: { u2: 'uEXIST' } });
  assert.deepStrictEqual(r.session.users.map(function (u) { return u.id + ':' + u.role; }), ['u1:Admin', 'u3:Viewer']);
  var t1 = r.session.tasks.find(function (t) { return t.id === 't1'; });
  assert.strictEqual(t1.assignee, 'uEXIST'); assert.strictEqual(t1.log[0].u, 'uEXIST'); assert.strictEqual(r.report.assigneesRemapped, 2 - 1); // t1 remapped; t2 'u9' unknown -> cleared
  assert.throws(function () { mig.migrate({ v: 2 }); }, /not a LabPM session/);
});

test('migrate CLI against a running server: names matched to accounts, attachments uploaded, dry run writes nothing', async function () {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'labpm-mig-')), att = path.join(dir, 'attachments');
  var srv = app.createApp({ dbPath: ':memory:', attachmentsDir: path.join(dir, 'srv-att') });
  await new Promise(function (r) { srv.server.listen(0, '127.0.0.1', r); });
  var base = 'http://127.0.0.1:' + srv.server.address().port, ck = '';
  var call = function (m, p, b) { return fetch(base + p, { method: m, headers: Object.assign({ 'content-type': 'application/json' }, ck ? { cookie: ck } : {}), body: b ? JSON.stringify(b) : undefined }).then(function (r) { var sc = r.headers.get('set-cookie'); if (sc && !ck) ck = sc.split(';')[0]; return r.json().then(function (j) { return { s: r.status, j: j }; }); }); };
  try {
    assert.strictEqual((await call('POST', '/api/setup', { username: 'root1', password: 'long-password-1', name: 'A. Rossi' })).s, 201);
    var anna = (await call('POST', '/api/accounts', { username: 'lbianchi', password: 'long-password-2', name: 'l. bianchi', role: 'Researcher' })).j.user;
    fs.mkdirSync(path.join(att, 'task-t1'), { recursive: true }); fs.writeFileSync(path.join(att, 'task-t1', 'report.txt'), 'Tm 165.2 C');
    var session = path.join(dir, 'labpm-session.json'); fs.writeFileSync(session, JSON.stringify(v1()));
    var common = [session, '--server', base, '--user', 'root1', '--password', 'long-password-1', '--people', 'placeholders'];
    var dry = await mig.run(common.concat(['--dry-run']));
    assert.ok(/dry run/.test(dry.text)); assert.strictEqual((await call('GET', '/api/state')).j.state.tasks.length, 0);
    var done = await mig.run(common.concat(['--attachments', dir, '--out', path.join(dir, 'out.json')]));
    assert.strictEqual(done.uploaded, 1); assert.deepStrictEqual(done.missing, []);
    var st = (await call('GET', '/api/state')).j.state;
    var t1 = st.tasks.find(function (t) { return t.id === 't1'; });
    assert.strictEqual(t1.assignee, anna.id, 'L. Bianchi matched to the existing account by name (case-insensitive)');
    assert.strictEqual(t1.log[0].u, anna.id); assert.strictEqual(t1.timer, null);
    assert.ok(st.users.some(function (u) { return u.name === 'M. Verdi' && u.role === 'Viewer'; }), 'unmatched person kept as placeholder');
    assert.strictEqual(st.users.filter(function (u) { return u.name === 'A. Rossi'; }).length, 1, 'matched Admin not duplicated');
    assert.strictEqual(st.files.length, 1); assert.strictEqual(st.files[0].taskId, 't1');
    var dl = await fetch(base + '/api/files/' + st.files[0].id + '/download', { headers: { cookie: ck } });
    assert.strictEqual(await dl.text(), 'Tm 165.2 C');
    assert.ok(fs.existsSync(path.join(dir, 'out.json')));
    // a path escaping the backup folder is never read
    var evil = v1(); evil.files[0].path = '../../etc/passwd'; fs.writeFileSync(session, JSON.stringify(evil));
    var e2 = await mig.run(common.concat(['--attachments', dir, '--out', path.join(dir, 'out2.json')]));
    assert.strictEqual(e2.uploaded, 0); assert.strictEqual(e2.missing.length, 1);
  } finally { srv.server.close(); }
});
