/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.5
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
    var pollState = async function (page, pred, ms) { var t0 = Date.now(), st; while (Date.now() - t0 < (ms || 8000)) { st = await page.evaluate(function () { return fetch('/api/state').then(function (r) { return r.json(); }).then(function (j) { return j.state; }); }); if (pred(st)) return st; await page.waitForTimeout(150); } throw new Error('timeout waiting for state'); };
    // Settings live on their own page (gear icon): templates are seeded, editable and deletable there
    await A.click('[data-act=nav][data-v=settings]');
    assert.strictEqual(await A.locator('[data-act=nav][data-v=session]').count(), 0, 'no Data & sync entry in the menu any more');
    await A.click('[data-act=settab][data-v=templates]');
    await A.waitForSelector('[data-act=tpledit]');
    assert.strictEqual(await A.locator('[data-act=tpledit]').count(), 5);
    await A.locator('[data-act=tpledit]').first().click();
    await A.fill('input[data-f=t][data-i="0"]', 'Weigh 8-10 mg in Al pan');
    await A.press('input[data-f=t][data-i="0"]', 'Tab');
    await A.click('[data-act=tpledit][data-id=""]');
    await pollState(A, function (st) { return st.templates.some(function (t) { return t.tasks[0].t === 'Weigh 8-10 mg in Al pan'; }); });
    await A.locator('[data-act=tpldel]').last().click(); await A.locator('[data-act=tpldel2]').click();
    await A.waitForFunction(function () { return document.querySelectorAll('[data-act=tpledit]').length === 4; });
    // Files: every file gets a display name (empty = the file name)
    await A.click('[data-act=nav][data-v=files]'); await B.click('[data-act=nav][data-v=files]');
    await A.setInputFiles('input[data-ch=fstage]', [{ name: 'dsc-report.txt', mimeType: 'text/plain', buffer: Buffer.from('Tm 165.2 C') }, { name: 'plain-name.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }]);
    await A.fill('input[data-stg=g][data-i="0"]', 'DSC report November');
    await A.click('[data-act=fstageup]');
    await B.waitForSelector('text=DSC report November', { timeout: 8000 });
    await B.waitForSelector('text=plain-name.txt', { timeout: 8000 });
    var fst = await pollState(A, function (st) { return st.files.length === 2; });
    assert.deepStrictEqual(fst.files.map(function (f) { return f.title; }).sort(), ['DSC report November', 'plain-name.txt']);
    var body = await B.evaluate(function () { var h = document.querySelector('a[href*="/download"]').getAttribute('href'); return fetch(h).then(function (r) { return r.text(); }); });
    assert.ok(body === 'Tm 165.2 C' || body === 'x');
    // Data & sync is a tab of the settings page: backups
    await A.click('[data-act=nav][data-v=settings]'); await A.click('[data-act=settab][data-v=data]');
    await A.click('[data-act=bknow]');
    await A.waitForSelector('[data-act=bkrestore]', { timeout: 5000 });
    // Projects -> Tasks -> Activities: Quick add builds the whole structure from one outline and opens the project
    await A.click('[data-act=nav][data-v=projects]'); await A.click('[data-act=qa]');
    await A.fill('#qa-p', 'DSC campaign');
    await A.fill('#qa-t', ['Prepare samples @Flavio #2', '  Weigh 8 specimens', '  Condition 48 h', 'Run DSC @Flavio #3', '  - [x] Label vials'].join('\n'));
    await A.click('[data-act=qacreate]');
    await A.waitForSelector('[data-act=pclose]');
    var st1 = await pollState(A, function (st) { return st.tasks.some(function (t) { return t.title === 'Run DSC' && t.checklist.length === 1; }); });
    var by = function (title) { return st1.tasks.filter(function (t) { return t.title === title; })[0]; };
    var prep = by('Prepare samples'), run = by('Run DSC');
    assert.deepStrictEqual(prep.checklist.map(function (c) { return c.t; }), ['Weigh 8 specimens', 'Condition 48 h']);
    assert.ok(!prep.parent && !run.parent, 'indented lines are activities, not subtasks');
    assert.strictEqual(run.checklist[0].done, true);
    // project detail: tick a task and an activity, add a task and an activity inline
    await A.click('input[data-ch=taskchk][data-id="' + prep.id + '"]');
    await pollState(A, function (st) { return st.tasks.filter(function (t) { return t.id === prep.id; })[0].status === 'Done'; });
    await B.click('[data-act=nav][data-v=progress]');
    await B.waitForFunction(function () { return /1 \/ 2/.test(document.querySelector('#vb').innerText) && /1 \/ 3/.test(document.querySelector('#vb').innerText); }, null, { timeout: 8000 }); // tasks 1/2, activities 1/3
    await A.fill('[data-enter=taskadd]', 'Report @Flavio #1'); await A.press('[data-enter=taskadd]', 'Enter');
    await pollState(A, function (st) { return st.tasks.some(function (t) { return t.title === 'Report' && t.projectId === prep.projectId; }); });
    await A.fill('[data-enter=actadd][data-id="' + run.id + '"]', 'Calibrate In/Zn'); await A.press('[data-enter=actadd][data-id="' + run.id + '"]', 'Enter');
    await pollState(A, function (st) { return st.tasks.filter(function (t) { return t.id === run.id; })[0].checklist.length === 2; });
    await B.waitForFunction(function () { return /1 \/ 3/.test(document.querySelector('#vb').innerText) && /1 \/ 4/.test(document.querySelector('#vb').innerText); }, null, { timeout: 8000 });
    // project list: click a project to open it, and back
    await A.click('[data-act=pclose]');
    await A.click('tr[data-act=popen]:has-text("DSC campaign")');
    await A.waitForSelector('text=Calibrate In/Zn');
    // the task window: no hours, subtasks, dependencies, time or template steps; activities offer previously used ones
    await A.click('[data-act=nav][data-v=tasks]'); await A.click('tr[data-id="' + run.id + '"] b');
    var panel = await A.innerText('#drpanel');
    ['Estimated hours', 'Subtasks', 'Dependencies', 'Add template steps'].forEach(function (x) { assert.ok(panel.indexOf(x) < 0, x + ' is gone from the task window'); });
    assert.strictEqual(await A.locator('#drpanel [data-f=est]').count(), 0); assert.strictEqual(await A.locator('#drpanel h3:text-is("Time")').count(), 0);
    await A.selectOption('select[data-ch=actpick]', 'Weigh 8 specimens');
    await pollState(A, function (st) { return st.tasks.filter(function (t) { return t.id === run.id; })[0].checklist.length === 3; });
    await A.keyboard.press('Escape');
    // Viewer attempts a write through the API: forbidden server-side
    var s = await B.evaluate(function () { return fetch('/api/tasks/t1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Done' }) }).then(function (r) { return r.status; }); });
    assert.strictEqual(s, 403);
    assert.deepStrictEqual(errs, []);
  } finally { await browser.close(); srv.close(); }
});
});
