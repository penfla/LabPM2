/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.2
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: Browser end-to-end test, two concurrent sessions (login, live sync, RBAC)
 * Method: Playwright Chromium against an in-memory server instance
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
var pw;
try { pw = require('playwright'); } catch (e) { pw = null; }

var T = { id: 't1', projectId: 'p1', title: 'DSC run PP-04', status: 'To do', priority: 'Medium', assignee: null, start: '2026-11-02', due: '2026-11-03', est: 4, deps: [], tags: [], cf: {}, notes: '', log: [] };

test('two browsers: login, live update, role enforcement', { skip: !pw && 'playwright not installed', timeout: 120000 }, async function () {
  var attDir = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'labpm-e2e-'));
  var a = app.createApp({ dbPath: ':memory:', attachmentsDir: attDir, backupsDir: attDir }), srv = a.server;
  await new Promise(function (r) { srv.listen(0, '127.0.0.1', r); });
  var base = 'http://127.0.0.1:' + srv.address().port;
  var browser = await pw.chromium.launch();
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
    // Viewer attempts a write through the API: forbidden server-side
    var s = await B.evaluate(function () { return fetch('/api/tasks/t1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Done' }) }).then(function (r) { return r.status; }); });
    assert.strictEqual(s, 403);
    assert.deepStrictEqual(errs, []);
  } finally { await browser.close(); srv.close(); }
});
