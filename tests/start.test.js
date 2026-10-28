/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.1
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: Start-up smoke test (data folder, lock, backup, static client)
 * Method: spawns server/index.js with --data on a fresh folder
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
var cp = require('node:child_process');
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');

function start(dir, port) {
  var p = cp.spawn(process.execPath, ['--no-warnings', path.join(__dirname, '..', 'server', 'index.js'), '--data', dir], { env: Object.assign({}, process.env, { PORT: String(port), DATA_DIR: '' }) });
  p.out = ''; p.stdout.on('data', function (d) { p.out += d; }); p.stderr.on('data', function (d) { p.out += d; });
  return p;
}
function until(fn, ms) { return new Promise(function (res, rej) { var t0 = Date.now(); (function tick() { var v = fn(); if (v) return res(v); if (Date.now() - t0 > ms) return rej(new Error('timeout')); setTimeout(tick, 50); })(); }); }

test('zero-config start: only the data folder is needed; lock, backup, LAN address, static client', async function () {
  var dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'labpm-start-')), 'share', 'labpm'); // folder does not exist yet
  var port = 20000 + Math.floor(Math.random() * 20000);
  var a = start(dir, port);
  try {
    await until(function () { return /First visit/.test(a.out); }, 8000);
    assert.ok(a.out.indexOf('Data folder: ' + dir) >= 0);
    assert.ok(/http:\/\/[\d.]+:\d+|http:\/\/localhost/.test(a.out), 'prints a LAN address');
    var r = await fetch('http://127.0.0.1:' + port + '/api/status'); assert.deepStrictEqual((await r.json()).setup, true);
    var h = await fetch('http://127.0.0.1:' + port + '/'); var html = await h.text();
    assert.ok(html.indexOf('LabPM') >= 0 && /default-src 'self'/.test(h.headers.get('content-security-policy')));
    assert.ok(fs.readdirSync(path.join(dir, 'backups')).length === 1);
    assert.ok(fs.existsSync(path.join(dir, 'labpm.sqlite')) && fs.existsSync(path.join(dir, 'attachments')));
    var b = start(dir, port + 1); // second server on the same folder must refuse
    var code = await new Promise(function (res) { b.on('exit', res); });
    assert.strictEqual(code, 1); assert.ok(/already using/.test(b.out), b.out);
  } finally { a.kill('SIGTERM'); await new Promise(function (res) { a.on('exit', res); }); }
  assert.ok(!fs.existsSync(path.join(dir, 'labpm.lock')), 'lock released on shutdown');
});
