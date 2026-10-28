/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.2
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: API integration tests (auth, RBAC, concurrency, SSE, import/export)
 * Method: node:test against an in-memory server instance
 * Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
 * Third-party components: none (Node.js built-ins only)
 * Scientific references: n/a
 * AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
 *
 * (c) 2026 Flavio Pendolino | PolyForm Noncommercial 1.0.0
 */
'use strict';
var test = require('node:test');
var assert = require('node:assert');
var app = require('../server/app');
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');
var attDir = fs.mkdtempSync(path.join(os.tmpdir(), 'labpm-att-'));
var bakDir = fs.mkdtempSync(path.join(os.tmpdir(), 'labpm-bak-'));

var srv, base, handle;
function req(method, path, body, cookie, headers) {
  var h = Object.assign({}, headers || {});
  if (body !== undefined) h['content-type'] = 'application/json';
  if (cookie) h.cookie = cookie;
  return fetch(base + path, { method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j, c: (r.headers.get('set-cookie') || '').split(';')[0] }; });
  });
}
var T = { id: 't1', projectId: 'p1', title: 'DSC run', status: 'To do', priority: 'Medium', assignee: null, start: '2026-11-02', due: '2026-11-03', est: 4, deps: [], tags: [], cf: {}, notes: '', log: [] };

test.before(function () {
  var a = app.createApp({ dbPath: ':memory:', attachmentsDir: attDir, backupsDir: bakDir, maxUploadMb: 1 });
  handle = a; srv = a.server;
  return new Promise(function (r) { srv.listen(0, '127.0.0.1', function () { base = 'http://127.0.0.1:' + srv.address().port; r(); }); });
});
test.after(function () { srv.close(); });

var admin, pm, res1, resId, view;
test('setup creates first Admin, only once', async function () {
  assert.strictEqual((await req('GET', '/api/status')).j.setup, true);
  var r = await req('POST', '/api/setup', { username: 'flavio', password: 'correct-horse-1', name: 'Flavio' });
  assert.strictEqual(r.s, 201); admin = r.c; assert.strictEqual(r.j.user.role, 'Admin');
  assert.strictEqual((await req('POST', '/api/setup', { username: 'x2', password: 'correct-horse-1' })).s, 409);
});
test('auth required, bad login rejected, weak password rejected', async function () {
  assert.strictEqual((await req('GET', '/api/state')).s, 401);
  assert.strictEqual((await req('POST', '/api/login', { username: 'flavio', password: 'nope' })).s, 401);
  assert.strictEqual((await req('POST', '/api/accounts', { username: 'bob', password: 'short' }, admin)).s, 400);
});
test('Admin creates accounts per role; login works', async function () {
  async function mk(u, role) { await req('POST', '/api/accounts', { username: u, password: 'password-' + u + '-1', role: role }, admin); return (await req('POST', '/api/login', { username: u, password: 'password-' + u + '-1' })); }
  var a = await mk('pmgr', 'Project manager'); pm = a.c;
  var b = await mk('res', 'Researcher'); res1 = b.c; resId = b.j.user.id;
  var c = await mk('view', 'Viewer'); view = c.c;
  assert.ok(pm && res1 && view);
  assert.strictEqual((await req('POST', '/api/accounts', { username: 'z', password: 'password-z-12345', role: 'Admin' }, pm)).s, 403);
});
test('RBAC matrix enforced server-side', async function () {
  assert.strictEqual((await req('POST', '/api/projects', { id: 'p1', name: 'Film', c: 1, status: 'auto' }, view)).s, 403);
  assert.strictEqual((await req('POST', '/api/projects', { id: 'p1', name: 'Film', c: 1, status: 'auto' }, res1)).s, 403);
  assert.strictEqual((await req('POST', '/api/projects', { id: 'p1', name: 'Film', c: 1, status: 'auto' }, pm)).s, 201);
  assert.strictEqual((await req('POST', '/api/tasks', Object.assign({}, T, { assignee: resId }), res1)).s, 403);
  assert.strictEqual((await req('POST', '/api/tasks', Object.assign({}, T, { assignee: resId }), pm)).s, 201);
  // Researcher: own task status ok, reassignment/title denied, delete denied
  assert.strictEqual((await req('PATCH', '/api/tasks/t1', { status: 'In progress' }, res1)).s, 200);
  assert.strictEqual((await req('PATCH', '/api/tasks/t1', { assignee: null }, res1)).s, 403);
  assert.strictEqual((await req('PATCH', '/api/tasks/t1', { title: 'x' }, res1)).s, 403);
  assert.strictEqual((await req('DELETE', '/api/tasks/t1', undefined, res1)).s, 403);
  // Researcher cannot touch someone else's task
  await req('POST', '/api/tasks', Object.assign({}, T, { id: 't2' }), pm);
  assert.strictEqual((await req('PATCH', '/api/tasks/t2', { status: 'Done' }, res1)).s, 403);
  // Researcher may submit an intake request
  assert.strictEqual((await req('POST', '/api/tasks', Object.assign({}, T, { id: 'rq1', src: 'form', status: 'Triage', requester: 'R' }), res1)).s, 201);
  // Viewer reads
  assert.strictEqual((await req('GET', '/api/state', undefined, view)).s, 200);
});
test('validation: bad dates and unknown collection rejected', async function () {
  assert.strictEqual((await req('POST', '/api/tasks', Object.assign({}, T, { id: 't9', start: '2026-13-40' }), pm)).s, 400);
  assert.strictEqual((await req('POST', '/api/tasks', Object.assign({}, T, { id: 't9', start: '2026-11-05', due: '2026-11-01' }), pm)).s, 400);
  assert.strictEqual((await req('POST', '/api/tasks', Object.assign({}, T, { id: '../x' }), pm)).s, 400);
  assert.strictEqual((await req('POST', '/api/evil', { id: 'a' }, pm)).s, 404);
});
test('optimistic concurrency: stale If-Match -> 409 with current; field-level PATCH merges', async function () {
  var cur = await req('GET', '/api/tasks/t2', undefined, pm);
  var ok = await req('PATCH', '/api/tasks/t2', { notes: 'A' }, pm, { 'if-match': String(cur.j.rev) });
  assert.strictEqual(ok.s, 200);
  var stale = await req('PATCH', '/api/tasks/t2', { notes: 'B' }, pm, { 'if-match': String(cur.j.rev) });
  assert.strictEqual(stale.s, 409); assert.strictEqual(stale.j.current.notes, 'A');
  // concurrent PATCHes on different fields (no If-Match) both survive
  await Promise.all([req('PATCH', '/api/tasks/t2', { priority: 'High' }, pm), req('PATCH', '/api/tasks/t2', { est: 9 }, pm)]);
  var f = (await req('GET', '/api/tasks/t2', undefined, pm)).j.item;
  assert.strictEqual(f.priority, 'High'); assert.strictEqual(f.est, 9); assert.strictEqual(f.notes, 'A');
});
test('SSE: change by one session is delivered to another', async function () {
  var ac = new AbortController();
  var r = await fetch(base + '/api/events', { headers: { cookie: view }, signal: ac.signal });
  var rd = r.body.getReader(), buf = '', dec = new TextDecoder();
  await req('PATCH', '/api/tasks/t2', { notes: 'live' }, pm);
  var t0 = Date.now();
  while (buf.indexOf('"notes":"live"') < 0 && Date.now() - t0 < 3000) { var x = await rd.read(); buf += dec.decode(x.value); }
  ac.abort();
  assert.ok(buf.indexOf('"notes":"live"') >= 0, 'event received');
  assert.ok(buf.indexOf('event: change') >= 0);
});
test('deleting a task detaches dependants; audit trail records actors', async function () {
  await req('POST', '/api/tasks', Object.assign({}, T, { id: 't3', deps: ['t2'] }), pm);
  assert.strictEqual((await req('DELETE', '/api/tasks/t2', undefined, pm)).s, 200);
  assert.deepStrictEqual((await req('GET', '/api/tasks/t3', undefined, pm)).j.item.deps, []);
  var a = await req('GET', '/api/audit', undefined, admin);
  assert.ok(a.j.events.some(function (e) { return e.op === 'delete' && e.id === 't2'; }));
  assert.strictEqual((await req('GET', '/api/audit', undefined, res1)).s, 403);
});
test('last Admin cannot be deleted or demoted; import/export Admin only', async function () {
  var me = (await req('GET', '/api/me', undefined, admin)).j.user;
  assert.strictEqual((await req('DELETE', '/api/users/' + me.id, undefined, admin)).s, 409);
  assert.strictEqual((await req('PATCH', '/api/users/' + me.id, { role: 'Viewer' }, admin)).s, 409);
  assert.strictEqual((await req('GET', '/api/export', undefined, pm)).s, 403);
  var exp = await req('GET', '/api/export', undefined, admin);
  assert.strictEqual(exp.j.v, 1);
  assert.strictEqual((await req('POST', '/api/import', { v: 2 }, admin)).s, 400);
  var imp = await req('POST', '/api/import', { v: 1, projects: [{ id: 'pX', name: 'Imported', c: 0, status: 'auto' }], tasks: [Object.assign({}, T, { id: 'tX', projectId: 'pX', timer: { user: 'u1', start: 1 } })] }, admin);
  assert.strictEqual(imp.s, 200);
  assert.strictEqual((await req('GET', '/api/tasks/tX', undefined, admin)).j.item.timer, null);
});
test('logout invalidates the session; login is throttled after repeated failures', async function () {
  var l = await req('POST', '/api/login', { username: 'view', password: 'password-view-1' });
  assert.strictEqual((await req('POST', '/api/logout', {}, l.c)).s, 200);
  assert.strictEqual((await req('GET', '/api/me', undefined, l.c)).s, 401);
  var last;
  for (var i = 0; i < 12; i++) last = await req('POST', '/api/login', { username: 'ghost', password: 'wrongwrong' });
  assert.strictEqual(last.s, 429);
});
test('Admin resets a password (sessions revoked); import skips people unless asked', async function () {
  var l = await req('POST', '/api/login', { username: 'view', password: 'password-view-1' });
  var id = (await req('GET', '/api/me', undefined, l.c)).j.user.id;
  assert.strictEqual((await req('POST', '/api/accounts/' + id + '/password', { password: 'new-password-123' }, pm)).s, 403);
  assert.strictEqual((await req('POST', '/api/accounts/' + id + '/password', { password: 'new-password-123' }, admin)).s, 200);
  assert.strictEqual((await req('GET', '/api/me', undefined, l.c)).s, 401);
  assert.strictEqual((await req('POST', '/api/login', { username: 'view', password: 'new-password-123' })).s, 200);
  var n0 = (await req('GET', '/api/state', undefined, admin)).j.state.users.length;
  await req('POST', '/api/import', { v: 1, users: [{ id: 'old1', name: 'Old', role: 'Admin', cap: 10 }] }, admin);
  assert.strictEqual((await req('GET', '/api/state', undefined, admin)).j.state.users.length, n0);
  await req('POST', '/api/import?users=1', { v: 1, users: [{ id: 'old1', name: 'Old', role: 'Admin', cap: 10 }] }, admin);
  var u = (await req('GET', '/api/users/old1', undefined, admin)).j.item;
  assert.strictEqual(u.role, 'Viewer');
});
test('server-side logic: cascade, blocked status, automations, timer stop, overdue sweep', async function () {
  var P1 = Object.assign({}, T, { projectId: 'p1' });
  // cascade: B depends on A; moving A.due pushes B (Mon 2026-11-02..Tue 03 -> B starts Wed 04 after A.due Tue 03)
  await req('POST', '/api/tasks', Object.assign({}, P1, { id: 'ca', start: '2026-11-02', due: '2026-11-03' }), pm);
  await req('POST', '/api/tasks', Object.assign({}, P1, { id: 'cb', start: '2026-11-04', due: '2026-11-05', deps: ['ca'] }), pm);
  await req('PATCH', '/api/tasks/ca', { due: '2026-11-06' }, pm); // Fri
  var b = (await req('GET', '/api/tasks/cb', undefined, pm)).j.item;
  assert.deepStrictEqual([b.start, b.due], ['2026-11-09', '2026-11-10']); // next working days (weekend skipped), duration kept
  // blocked: B cannot start while A is open
  var blk = await req('PATCH', '/api/tasks/cb', { status: 'In progress' }, pm);
  assert.strictEqual(blk.s, 409); assert.ok(/Blocked by/.test(blk.j.error));
  // automation: when Done and tag to-archive -> create follow-up task, set priority
  await req('POST', '/api/rules', { id: 'r1', name: 'Archive', on: true, trigger: { type: 'status_to', value: 'Done' }, cond: { type: 'tag', value: 'to-archive' }, action: { type: 'create_task', value: 'Archive residual samples' } }, pm);
  await req('POST', '/api/rules', { id: 'r2', name: 'Prio', on: true, trigger: { type: 'status_to', value: 'Done' }, cond: { type: 'none', value: '' }, action: { type: 'add_tag', value: 'closed' } }, pm);
  await req('POST', '/api/tasks', Object.assign({}, P1, { id: 'au', tags: ['to-archive'], timer: { user: 'u1', start: Date.now() - 2 * 36e5 } }), pm);
  assert.strictEqual((await req('PATCH', '/api/tasks/au', { status: 'Done' }, pm)).s, 200);
  var st = (await req('GET', '/api/state', undefined, pm)).j.state;
  var au = st.tasks.find(function (t) { return t.id === 'au'; });
  assert.ok(au.tags.indexOf('closed') >= 0); assert.strictEqual(au.timer, null);
  assert.ok(au.log.length === 1 && au.log[0].h >= 1.99 && au.log[0].h <= 2.1);
  assert.ok(st.tasks.some(function (t) { return t.title === 'Archive residual samples'; }));
  // overdue sweep fires once
  await req('POST', '/api/rules', { id: 'r3', name: 'Late', on: true, trigger: { type: 'overdue', value: '' }, cond: { type: 'none', value: '' }, action: { type: 'set_priority', value: 'Critical' } }, pm);
  await req('POST', '/api/tasks', Object.assign({}, P1, { id: 'od', start: '2020-01-06', due: '2020-01-07' }), pm);
  assert.ok(handle.sweep() >= 1);
  assert.strictEqual((await req('GET', '/api/tasks/od', undefined, pm)).j.item.priority, 'Critical');
  assert.strictEqual(handle.sweep(), 0);
});

function upload(cookie, qs, buf) {
  return fetch(base + '/api/files?' + qs, { method: 'POST', headers: { cookie: cookie, 'content-type': 'application/pdf' }, body: buf }).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); });
}
test('attachments: upload, authenticated download, limits, RBAC, cascade on task delete', async function () {
  await req('POST', '/api/tasks', Object.assign({}, T, { id: 'at1', assignee: resId }), pm);
  await req('POST', '/api/tasks', Object.assign({}, T, { id: 'at2' }), pm);
  view = (await req('POST', '/api/login', { username: 'view', password: 'new-password-123' })).c; // password was reset above
  var data = Buffer.from('%PDF-1.4 test content');
  var up = await upload(pm, 'taskId=at1&name=' + encodeURIComponent('../DSC<run>.pdf'), data);
  assert.strictEqual(up.s, 201); assert.strictEqual(up.j.item.size, data.length);
  assert.ok(!/[\\/<>]/.test(up.j.item.name), 'sanitised name: ' + up.j.item.name);
  var id = up.j.id;
  var dl = await fetch(base + '/api/files/' + id + '/download', { headers: { cookie: view } });
  assert.strictEqual(dl.status, 200); assert.strictEqual(dl.headers.get('content-type'), 'application/octet-stream');
  assert.ok(/attachment/.test(dl.headers.get('content-disposition')));
  assert.deepStrictEqual(Buffer.from(await dl.arrayBuffer()), data);
  assert.strictEqual((await fetch(base + '/api/files/' + id + '/download')).status, 401);
  assert.strictEqual((await upload(view, 'taskId=at1&name=x.pdf', data)).s, 403);
  assert.strictEqual((await upload(res1, 'taskId=at2&name=x.pdf', data)).s, 403); // not their task
  assert.strictEqual((await upload(res1, 'taskId=at1&name=mine.pdf', data)).s, 201);
  assert.strictEqual((await upload(pm, 'taskId=at1&name=big.bin', Buffer.alloc(1048577))).s, 413);
  assert.strictEqual((await upload(pm, 'taskId=nope&name=x', data)).s, 404);
  assert.strictEqual((await req('PUT', '/api/files/' + id, { id: id, name: 'evil' }, pm)).s, 405);
  // delete one file removes it from disk; deleting the task removes the rest
  assert.strictEqual((await req('DELETE', '/api/files/' + id, undefined, pm)).s, 200);
  assert.ok(!fs.existsSync(path.join(attDir, id)));
  var left = (await req('GET', '/api/state', undefined, pm)).j.state.files.filter(function (f) { return f.taskId === 'at1'; });
  assert.strictEqual(left.length, 1);
  assert.strictEqual((await req('DELETE', '/api/tasks/at1', undefined, pm)).s, 200);
  assert.ok(!fs.existsSync(path.join(attDir, left[0].id)));
  assert.strictEqual((await req('GET', '/api/state', undefined, pm)).j.state.files.length, 0);
});

test('backups: create, list, restore (Admin only) reverts data, revokes sessions, keeps a pre-restore copy', async function () {
  assert.strictEqual((await req('POST', '/api/backups', {}, pm)).s, 403);
  var mk = await req('POST', '/api/backups', {}, admin);
  assert.strictEqual(mk.s, 201);
  var name = mk.j.name;
  await req('POST', '/api/projects', { id: 'after-bak', name: 'Created after backup', c: 0, status: 'auto' }, pm);
  assert.strictEqual((await req('POST', '/api/backups/restore', { name: '../../etc/passwd' }, admin)).s, 400);
  assert.strictEqual((await req('POST', '/api/backups/restore', { name: name }, pm)).s, 403);
  assert.strictEqual((await req('POST', '/api/backups/restore', { name: name }, admin)).s, 200);
  assert.strictEqual((await req('GET', '/api/me', undefined, admin)).s, 401); // all sessions revoked
  var again = await req('POST', '/api/login', { username: 'flavio', password: 'correct-horse-1' });
  assert.strictEqual(again.s, 200);
  var st = (await req('GET', '/api/state', undefined, again.c)).j.state;
  assert.ok(!st.projects.some(function (p) { return p.id === 'after-bak'; }));
  assert.ok(fs.readdirSync(bakDir).some(function (f) { return /pre-restore/.test(f); }));
  assert.ok((await req('GET', '/api/backups', undefined, again.c)).j.backups.length >= 2);
});
