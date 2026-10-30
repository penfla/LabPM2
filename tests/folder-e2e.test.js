/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.2
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: Browser test of shared-folder mode (no server): identity, merge, attachments, backup
 * Method: Playwright Chromium; two tabs share an OPFS directory standing in for the network folder
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
var http = require('node:http');
var fs = require('node:fs');
var path = require('node:path');
var pw;
try { pw = require('playwright'); } catch (e) { pw = null; }

var V1 = { v: 1, users: [], projects: [{ id: 'p1', name: 'Film PE/EVOH', c: 0, status: 'auto' }],
  tasks: [{ id: 't1', projectId: 'p1', title: 'DSC run PP-04', status: 'To do', priority: 'Medium', assignee: null, start: '2026-11-02', due: '2026-11-03', est: 4, deps: [], tags: [], cf: {}, notes: '', log: [], created: 1700000000000 }],
  fields: [], rules: [], goals: [], docs: [] };

test('shared-folder mode: two tabs, no server (login-free identity, merge, files, backup)', { skip: !pw && 'playwright not installed', timeout: 120000 }, async function () {
  var srv = http.createServer(function (req, res) { // static only: no /api, so the page falls back to folder mode
    if (req.url.indexOf('/api/') === 0) { res.writeHead(404); return res.end('no'); }
    res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html')));
  });
  await new Promise(function (r) { srv.listen(0, '127.0.0.1', r); });
  var url = 'http://127.0.0.1:' + srv.address().port + '/index.html#opfs=lab-' + Date.now();
  var browser = await pw.chromium.launch(), ctx = await browser.newContext({ acceptDownloads: true });
  try {
    var A = await ctx.newPage(), B = await ctx.newPage(), errs = [];
    [A, B].forEach(function (p) { p.on('pageerror', function (e) { errs.push(e.message); }); });
    await A.goto(url);
    await A.fill('input[name=name]', 'Flavio'); await A.click('button[type=submit]'); await A.waitForSelector('.side');
    assert.ok(/Shared folder/.test(await A.textContent('#sv')));
    // import a v1 session (Admin) -> operations are written to this device's log
    await A.click('[data-act=nav][data-v=session]');
    await A.setInputFiles('input[data-ch=openfile]', { name: 'v1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(V1)) });
    var folder = url.split('#opfs=')[1];
    await A.waitForFunction(async function (name) { // wait until the import has really been written to the shared folder
      var l = await (await (await navigator.storage.getDirectory()).getDirectoryHandle(name)).getDirectoryHandle('log');
      for await (var e of l.entries()) { if ((await (await e[1].getFile()).text()).indexOf('DSC run PP-04') >= 0) return true; }
      return false;
    }, folder, { timeout: 20000 });
    // second tab = another PC: auto-enters as the saved identity, then switches to a new user
    await B.goto(url);
    // Chromium's OPFS can list a directory stale across tabs for a few seconds; a user would just reload (the page says so)
    if (!(await B.waitForSelector('.side', { timeout: 8000 }).then(function () { return true; }, function () { return false; }))) { await B.reload(); await B.waitForSelector('.side', { timeout: 15000 }); }
    await B.click('[data-act=logout]');
    await B.selectOption('select[name=user]', '__new'); await B.fill('input[name=name]', 'Anna'); await B.click('button[type=submit]');
    await B.waitForSelector('.side');
    await B.click('[data-act=nav][data-v=tasks]');
    await B.waitForSelector('text=DSC run PP-04', { timeout: 15000 });
    // A edits the task status; B sees it via the other device's log
    await A.click('[data-act=nav][data-v=tasks]'); await A.click('tr[data-id=t1]');
    await A.selectOption('select[data-ch=dr][data-f=status]', 'In progress');
    await B.waitForFunction(function () { return /In progress/.test(document.querySelector('#vb').innerText); }, null, { timeout: 15000 });
    await A.keyboard.press('Escape');
    // built-in templates are seeded by the first Admin/PM; Admin deletes one and the other PC sees it
    await A.click('[data-act=nav][data-v=templates]'); await B.click('[data-act=nav][data-v=templates]');
    await A.waitForFunction(function () { return document.querySelectorAll('[data-act=tpledit]').length === 5; });
    await B.waitForFunction(function () { return document.querySelectorAll('.wgrid > section').length === 5; }, null, { timeout: 15000 });
    assert.strictEqual(await B.locator('[data-act=tpledit]').count(), 0); // Researcher: view only
    await A.locator('[data-act=tpldel]').last().click(); await A.locator('[data-act=tpldel2]').click();
    await B.waitForFunction(function () { return document.querySelectorAll('.wgrid > section').length === 4; }, null, { timeout: 15000 });
    await B.click('[data-act=nav][data-v=tasks]');
    // A uploads a file, B downloads it
    await A.click('[data-act=nav][data-v=files]'); await B.click('[data-act=nav][data-v=files]');
    await A.setInputFiles('input[data-ch=fupg]', { name: 'dsc-report.txt', mimeType: 'text/plain', buffer: Buffer.from('Tm 165.2 C') });
    await B.waitForSelector('text=dsc-report.txt', { timeout: 15000 });
    var dl = B.waitForEvent('download'); await B.click('a[data-act=fdl]');
    var d = await dl; var chunks = []; var st = await d.createReadStream(); for await (var c of st) chunks.push(c);
    assert.strictEqual(Buffer.concat(chunks).toString(), 'Tm 165.2 C');
    // backup from the Data page (Admin)
    await A.click('[data-act=nav][data-v=session]'); await A.click('[data-act=bknow]');
    await A.waitForSelector('[data-act=bkrestore]', { timeout: 5000 });
    assert.deepStrictEqual(errs, []);
  } finally { await browser.close(); srv.close(); }
});
