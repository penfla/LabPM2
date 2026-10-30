/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.2
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: SQLite schema, transactions, password hashing
 * Method: node:sqlite (rollback journal, safe on LAN shares; WAL optional); scrypt (N=32768) password hashes; sessions stored as SHA-256 of token
 * Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
 * Third-party components: none (Node.js built-ins only)
 * Scientific references: n/a
 * AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
 *
 * (c) 2026 Flavio Pendolino | PolyForm Noncommercial 1.0.0
 */
'use strict';
var sqlite = require('node:sqlite');
var crypto = require('node:crypto');

function open(file, wal) {
  var db = new sqlite.DatabaseSync(file);
  // rollback journal by default: WAL needs shared memory and is unsafe on network shares
  db.exec('PRAGMA journal_mode=' + (wal ? 'WAL' : 'DELETE') + '; PRAGMA synchronous=' + (wal ? 'NORMAL' : 'FULL') + '; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  db.exec([
    'CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE, hash TEXT NOT NULL, created INTEGER NOT NULL);',
    'CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);',
    'CREATE TABLE IF NOT EXISTS entities(kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, rev INTEGER NOT NULL, updated INTEGER NOT NULL, by TEXT, PRIMARY KEY(kind,id));',
    'CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, user TEXT, kind TEXT NOT NULL, id TEXT NOT NULL, op TEXT NOT NULL, rev INTEGER, data TEXT);',
    'CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);',
    'CREATE INDEX IF NOT EXISTS ev_ts ON events(ts);'
  ].join('\n'));
  return db;
}

function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { var r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

function hashPw(pw) {
  var salt = crypto.randomBytes(16);
  var h = crypto.scryptSync(pw, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  return 'scrypt$' + salt.toString('hex') + '$' + h.toString('hex');
}
function checkPw(pw, stored) {
  var p = String(stored).split('$');
  if (p[0] !== 'scrypt') return false;
  var h = crypto.scryptSync(pw, Buffer.from(p[1], 'hex'), 64, { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  var ref = Buffer.from(p[2], 'hex');
  return ref.length === h.length && crypto.timingSafeEqual(h, ref);
}
function sidHash(t) { return crypto.createHash('sha256').update(t).digest('hex'); }

module.exports = { open: open, tx: tx, hashPw: hashPw, checkPw: checkPw, sidHash: sidHash };
