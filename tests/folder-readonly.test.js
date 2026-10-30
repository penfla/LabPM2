/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.2
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: Read-only shared-folder view for browsers without the File System Access API (Firefox, Safari)
 * Method: Playwright Chromium with showDirectoryPicker removed; folder chosen through the standard directory input
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
var os = require('node:os');
var path = require('node:path');
var pw;
try { pw = require('playwright'); } catch (e) { pw = null; }

/* a folder as another PC would have written it (log/<device>.jsonl, attachments/<id>, meta.json) */
function makeFolder() {
  var root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'labpm-ro-')), 'labpm-share');
  fs.mkdirSync(path.join(root, 'log'), { recursive: true }); fs.mkdirSync(path.join(root, 'attachments'));
  fs.writeFileSync(path.join(root, 'meta.json'), JSON.stringify({ id: 'fo-test' }));
  var t = 1700000000000, n = 0;
  var op = function (k, id, p) { return JSON.stringify({ t: t + (++n), d: 'devA', u: 'u1', k: k, id: id, c: 1, p: p }); };
  var task = { projectId: 'p1', title: 'DSC run PP-04', status: 'To do', priority: 'Medium', assignee: 'u2', start: '2026-11-02', due: '2026-11-03', est: 4, deps: [], tags: [], cf: {}, notes: '', log: [], created: t };
  fs.writeFileSync(path.join(root, 'log', 'devA.jsonl'), [
    op('users', 'u1', { name: 'Flavio', role: 'Admin', cap: 40 }), op('users', 'u2', { name: 'Anna', role: 'Researcher', cap: 36 }),
    op('projects', 'p1', { name: 'Film PE/EVOH', c: 0, status: 'auto' }), op('tasks', 't1', task),
    op('files', 'f1', { taskId: 't1', projectId: 'p1', name: 'dsc-report.txt', path: '', size: 10, type: 'text/plain', added: t, by: 'u1' })
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(root, 'attachments', 'f1'), 'Tm 165.2 C');
  return root;
}

test('browser without File System Access API (Firefox/Safari): read-only folder view', { skip: !pw && 'playwright not installed', timeout: 90000 }, async function () {
  var srv = http.createServer(function (req, res) {
    if (req.url.indexOf('/api/') === 0) { res.writeHead(404); return res.end('no'); }
    res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html')));
  });
  await new Promise(function (r) { srv.listen(0, '127.0.0.1', r); });
  var browser = await pw.chromium.launch(), ctx = await browser.newContext({ acceptDownloads: true });
  try {
    var page = await ctx.newPage(), errs = [];
    page.on('pageerror', function (e) { errs.push(e.message); });
    await page.addInitScript(function () { Object.defineProperty(window, 'showDirectoryPicker', { value: undefined }); }); // what Firefox and Safari look like
    await page.goto('http://127.0.0.1:' + srv.address().port + '/');
    await page.waitForSelector('text=read-only');
    await page.setInputFiles('input[data-ch=fro]', makeFolder());
    await page.waitForSelector('select[name=user]');
    assert.ok(!(await page.textContent('select[name=user]')).includes('I am new here'), 'no profile creation in read-only mode');
    await page.selectOption('select[name=user]', 'u2'); await page.click('button[type=submit]');
    await page.waitForSelector('.side');
    assert.ok(/Read-only/.test(await page.textContent('#sv')));
    await page.click('[data-act=nav][data-v=tasks]');
    await page.waitForSelector('text=DSC run PP-04');
    await page.click('tr[data-id=t1]');
    assert.ok(await page.isDisabled('select[data-ch=dr][data-f=status]'), 'Researcher is forced to view-only');
    assert.strictEqual(await page.locator('input[data-ch=fup]').count(), 0);
    await page.keyboard.press('Escape');
    await page.click('[data-act=nav][data-v=files]');
    var dl = page.waitForEvent('download'); await page.click('a[data-act=fdl]');
    var chunks = []; for await (var c of await (await dl).createReadStream()) chunks.push(c);
    assert.strictEqual(Buffer.concat(chunks).toString(), 'Tm 165.2 C');
    assert.deepStrictEqual(errs, []);
  } finally { await browser.close(); srv.close(); }
});
