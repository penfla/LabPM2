/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.2
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: Server entry point: data folder (only setting), single-instance lock, daily backup, LAN addresses
 * Method: folder from --data, DATA_DIR or labpm.config.json {"dataDir"}; default ./data. Port 8080 (PORT to override)
 * Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
 * Third-party components: none (Node.js built-ins only)
 * Scientific references: n/a
 * AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
 *
 * (c) 2026 Flavio Pendolino | PolyForm Noncommercial 1.0.0
 */
'use strict';
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');
var app = require('./app');

var ROOT = path.join(__dirname, '..');
var VERSION = '2.0.0-beta.2';

function readConfig() {
  var f = path.join(ROOT, 'labpm.config.json');
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch (e) { return {}; }
}
function dataDir() {
  var i = process.argv.indexOf('--data');
  var d = (i > 0 && process.argv[i + 1]) || process.env.DATA_DIR || (readConfig().dataDir || "").trim() || path.join(ROOT, 'data');
  return path.resolve(d);
}
function die(m) { console.error('\nLabPM cannot start: ' + m + '\n'); process.exit(1); }

var dir = dataDir();
try { fs.mkdirSync(dir, { recursive: true }); fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK); }
catch (e) { die('data folder "' + dir + '" is not writable (' + e.code + '). Check the path and permissions in labpm.config.json.'); }

/* one server per folder: a lock file refreshed every 10 s (works on network shares) */
var lock = path.join(dir, 'labpm.lock');
function lockInfo() { return JSON.stringify({ host: os.hostname(), pid: process.pid, started: Date.now() }); }
try {
  var st = fs.statSync(lock);
  if (Date.now() - st.mtimeMs < 30000) {
    var who = {}; try { who = JSON.parse(fs.readFileSync(lock, 'utf8')); } catch (e) { /* unreadable */ }
    die('another LabPM server is already using "' + dir + '"' + (who.host ? ' (computer ' + who.host + ')' : '') + '. Use that one or stop it first.');
  }
} catch (e) { if (e.code !== 'ENOENT') die('cannot inspect the lock file: ' + e.message); }
fs.writeFileSync(lock, lockInfo());
var beat = setInterval(function () { try { fs.utimesSync(lock, new Date(), new Date()); } catch (e) { /* retry next beat */ } }, 10000);

var a = app.createApp({
  dbPath: path.join(dir, 'labpm.sqlite'),
  attachmentsDir: path.join(dir, 'attachments'),
  backupsDir: path.join(dir, 'backups'),
  maxUploadMb: +process.env.MAX_UPLOAD_MB || 25,
  wal: process.env.LABPM_WAL === '1',
  cookieSecure: process.env.COOKIE_SECURE === '1'
});

function doBackup() { try { var f = a.backup(path.join(dir, 'backups'), 14); console.log('Backup: ' + f); } catch (e) { console.error('Backup failed: ' + e.message); } }
doBackup();
setInterval(function () { if (new Date().getHours() === 3) doBackup(); }, 3600000).unref();

var port = +process.env.PORT || 8080, host = process.env.HOST || '0.0.0.0';
a.server.on('error', function (e) { clearInterval(beat); try { fs.unlinkSync(lock); } catch (x) { /* none */ } die(e.code === 'EADDRINUSE' ? 'port ' + port + ' is in use (set PORT to change it).' : e.message); });
a.server.listen(port, host, function () {
  console.log('LabPM ' + VERSION + '\nData folder: ' + dir + '\nOpen from any PC on the network:');
  var seen = false;
  Object.keys(os.networkInterfaces()).forEach(function (n) {
    os.networkInterfaces()[n].forEach(function (i) { if (i.family === 'IPv4' && !i.internal) { seen = true; console.log('  http://' + i.address + ':' + port); } });
  });
  if (!seen) console.log('  http://localhost:' + port);
  console.log('First visit: create the Admin account in the browser.');
});

function shutdown() { clearInterval(beat); try { fs.unlinkSync(lock); } catch (e) { /* none */ } a.server.close(function () { process.exit(0); }); setTimeout(function () { process.exit(0); }, 2000).unref(); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
