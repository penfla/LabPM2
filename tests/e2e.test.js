/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.4
 * License: Apache License 2.0
 * Commercial use: permitted under the Apache License 2.0
 * Purpose: Browser end-to-end test, two concurrent sessions (login, live sync, RBAC)
 * Method: Playwright Chromium against an in-memory server instance
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
var app = require('../server/app');
var pw;
try { pw = require('playwright'); } catch (e) { pw = null; }

var T = { id: 't1', projectId: 'p1', title: 'DSC run PP-04', status: 'To do', priority: 'Medium', assignee: null, start: '2026-11-02', due: '2026-11-03', est: 4, deps: [], tags: [], cf: {}, notes: '', log: [] };

function installed(name) {
  try { return !!pw && require('node:fs').existsSync(pw[name].executablePath()); } catch (e) { return false; }
}
// server mode uses only standard web APIs: run the same scenario on every engine that is installed
['chromium', 'firefox', 'webkit'].forEach(function (engine) {
test('two browsers (' + engine + '): login, live update, files, role enforcement', { skip: !installed(engine) && engine + ' not installed (npx playwright install ' + engine + ')', timeout: 120000 }, async function () {
  var attDir = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'labpm-e2e-'));
  var a = app.createApp({ dbPath: ':memory:', attachmentsDir: attDir, backupsDir: attDir }), srv = a.server;
  await new Promise(function (r) { srv.listen(0, '127.0.0.1', r); });
  var base = 'http://127.0.0.1:' + srv.address().port;
  var browser = await pw[engine].launch();
  try {
    var A = await (await browser.newContext()).newPage(), B = await (await browser.newContext()).newPage();
    var errs = []; [A, B].forEach(function (p) { p.on('pageerror', function (e) { errs.push(e.message); }); });
    // first run: create Admin through the UI
    await A.goto(base);
    await A.fill('input[name=username]', 'flavio'); await A.fill('input[name=name]', 'Flavio'); await A.fill('input[name=password]', 'correct-horse-1');
    await A.click('button[type=submit]');
    await A.waitForSelector('.side');
    // seed project/task/second account through the API as Admin (browser context shares the cookie)
    await A.evaluate(async function (T) {
      var h = { 'Content-Type': 'application/json' };
      await fetch('/api/projects', { method: 'POST', headers: h, body: JSON.stringify({ id: 'p1', name: 'Film PE/EVOH', c: 0, status: 'auto' }) });
      await fetch('/api/tasks', { method: 'POST', headers: h, body: JSON.stringify(T) });
      await fetch('/api/accounts', { method: 'POST', headers: h, body: JSON.stringify({ username: 'viewer1', password: 'viewer-pass-123', name: 'Viewer One', role: 'Viewer' }) });
    }, T);
    // B (Viewer) signs in and sees the task once loaded
    await B.goto(base);
    await B.fill('input[name=username]', 'viewer1'); await B.fill('input[name=password]', 'viewer-pass-123');
    await B.click('button[type=submit]'); await B.waitForSelector('.side');
    await A.reload(); await A.waitForSelector('.side');
    await A.click('[data-act=nav][data-v=tasks]'); await B.click('[data-act=nav][data-v=tasks]');
    await B.waitForSelector('text=DSC run PP-04');
    // A edits the task status in the drawer; B sees it without reload
    await A.click('tr[data-id=t1]');
    await A.selectOption('select[data-ch=dr][data-f=status]', 'In progress');
    await B.waitForFunction(function () { return /In progress/.test(document.querySelector('#vb').innerText); }, null, { timeout: 5000 });
    await A.keyboard.press('Escape');
    // Templates: built-ins are seeded; Admin edits one, adds its steps to a single task, deletes another
    await A.click('[data-act=nav][data-v=templates]');
    await A.waitForSelector('[data-act=tpledit]');
    assert.strictEqual(await A.locator('[data-act=tpledit]').count(), 5);
    await A.locator('[data-act=tpledit]').first().click();
    await A.fill('input[data-f=t][data-i="0"]', 'Weigh 8-10 mg in Al pan');
    await A.press('input[data-f=t][data-i="0"]', 'Tab');
    await A.click('[data-act=tpledit][data-id=""]');
    await A.click('[data-act=nav][data-v=tasks]'); await A.click('tr[data-id=t1]');
    await A.selectOption('#dt-t', 'tpl-dsc'); await A.selectOption('#dt-m', 'after');
    await A.click('[data-act=tpltask]');
    await A.keyboard.press('Escape');
    await B.click('[data-act=nav][data-v=tasks]');
    await B.waitForSelector('text=Weigh 8-10 mg in Al pan', { timeout: 8000 });
    await A.click('[data-act=nav][data-v=templates]');
    await A.locator('[data-act=tpldel]').last().click(); await A.locator('[data-act=tpldel2]').click();
    await A.waitForFunction(function () { return document.querySelectorAll('[data-act=tpledit]').length === 4; });
    await A.click('[data-act=nav][data-v=tasks]');
    // A uploads a file from the Files page; B (Viewer) sees it and can download it
    await A.click('[data-act=nav][data-v=files]'); await B.click('[data-act=nav][data-v=files]');
    await A.setInputFiles('input[data-ch=fupg]', { name: 'dsc-report.txt', mimeType: 'text/plain', buffer: Buffer.from('Tm 165.2 C') });
    await B.waitForSelector('text=dsc-report.txt', { timeout: 5000 });
    var body = await B.evaluate(function () { var h = document.querySelector('a[href*="/download"]').getAttribute('href'); return fetch(h).then(function (r) { return r.text(); }); });
    assert.strictEqual(body, 'Tm 165.2 C');
    // Admin: backups card lists the copy made on demand
    await A.click('[data-act=nav][data-v=session]');
    await A.click('[data-act=bknow]');
    await A.waitForSelector('[data-act=bkrestore]', { timeout: 5000 });
    // Quick add: project, tasks, subtasks and activities from one outline; ticking progresses the parent; progress per person
    await A.click('[data-act=nav][data-v=tasks]'); await A.click('[data-act=qa]');
    await A.fill('#qa-p', 'DSC campaign');
    await A.fill('#qa-t', ['Prepare samples @Flavio #2 ~6h', '  Weigh 8 specimens #1 ~2h', '  Condition 48 h #2', '  - Check balance calibration', 'Run DSC @Flavio #3 ~12h', '  - [x] Label vials'].join('\n'));
    await A.click('[data-act=qacreate]');
    var api = function (page) { return page.evaluate(function () { return fetch('/api/state').then(function (r) { return r.json(); }).then(function (j) { return j.state.tasks; }); }); };
    var pollTasks = async function (page, pred, ms) { var t0 = Date.now(), list; while (Date.now() - t0 < (ms || 8000)) { list = await page.evaluate(function () { return fetch('/api/state').then(function (r) { return r.json(); }).then(function (j) { return j.state.tasks; }); }); if (pred(list)) return list; await page.waitForTimeout(150); } throw new Error('timeout waiting for tasks; have: ' + list.map(function (t) { return t.title; }).join(' | ')); };
    var ts0 = await pollTasks(A, function (l) { return l.some(function (t) { return t.title === 'Condition 48 h'; }); });
    var ts = ts0, by = function (title) { return ts.filter(function (t) { return t.title === title; })[0]; };
    var parent = by('Prepare samples'), w = by('Weigh 8 specimens'), c = by('Condition 48 h'), run = by('Run DSC');
    assert.ok(w.parent === parent.id && c.parent === parent.id && !run.parent, 'indented lines are subtasks');
    assert.strictEqual(w.assignee, parent.assignee, 'subtask inherits the assignee');
    assert.strictEqual(c.checklist.length, 1); assert.strictEqual(run.checklist[0].done, true);
    assert.strictEqual(parent.projectId, w.projectId);
    await A.waitForSelector('tr[data-id="' + w.id + '"]');
    await A.click('input[data-ch=taskchk][data-id="' + w.id + '"]');
    await A.click('input[data-ch=taskchk][data-id="' + c.id + '"]');
    await pollTasks(A, function (l) { return l.filter(function (t) { return t.id === parent.id; })[0].status === 'Done'; }); // parent follows its subtasks
    await B.click('[data-act=nav][data-v=progress]');
    await B.waitForFunction(function () { return /2 \/ 3/.test(document.querySelector('#vb').innerText); }, null, { timeout: 8000 }); // Flavio: 2 of 3 lowest-level tasks
    // tick an activity and add a subtask from the task panel
    await A.click('tr[data-id="' + c.id + '"] .dn, tr[data-id="' + c.id + '"] b');
    await A.click('input[data-ch=acttick]');
    await A.keyboard.press('Escape');
    await A.click('tr[data-id="' + run.id + '"] b');
    await A.fill('[data-enter=subadd]', 'Analyse curves #1'); await A.press('[data-enter=subadd]', 'Enter');
    await pollTasks(A, function (l) { return l.some(function (t) { return t.title === 'Analyse curves' && t.parent === run.id && t.assignee === run.assignee; }); });
    await B.waitForFunction(function () { return /2 \/ 2/.test(document.querySelector('#vb').innerText); }, null, { timeout: 8000 }); // activities: 2 of 2 done
    await A.keyboard.press('Escape');
    // Viewer attempts a write through the API: forbidden server-side
    var s = await B.evaluate(function () { return fetch('/api/tasks/t1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Done' }) }).then(function (r) { return r.status; }); });
    assert.strictEqual(s, 403);
    assert.deepStrictEqual(errs, []);
  } finally { await browser.close(); srv.close(); }
});
});
