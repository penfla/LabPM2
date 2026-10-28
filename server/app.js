/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-alpha.1
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: HTTP API (auth, CRUD with RBAC, SSE change feed, import/export, audit) and static client
 * Method: node:http; cookie sessions; per-record rev (If-Match -> 409); one SQLite transaction per mutation; events table = audit + replay feed
 * Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
 * Third-party components: none (Node.js built-ins only)
 * Scientific references: n/a
 * AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
 *
 * (c) 2026 Flavio Pendolino | PolyForm Noncommercial 1.0.0
 */
'use strict';
var http = require('node:http');
var fs = require('node:fs');
var path = require('node:path');
var crypto = require('node:crypto');
var D = require('./db');
var V = require('./validate');
var P = require('./perms');

var COOKIE = 'labpm_sid';
var TTL = 12 * 3600 * 1000;
var CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

function createApp(opts) {
  opts = opts || {};
  var db = D.open(opts.dbPath || ':memory:');
  var pub = opts.publicDir || path.join(__dirname, '..', 'public');
  var secure = !!opts.cookieSecure;
  var clients = [];
  var fails = {};

  var q = {
    getEnt: db.prepare('SELECT data, rev FROM entities WHERE kind=? AND id=?'),
    putEnt: db.prepare('INSERT INTO entities(kind,id,data,rev,updated,by) VALUES(?,?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data, rev=excluded.rev, updated=excluded.updated, by=excluded.by'),
    delEnt: db.prepare('DELETE FROM entities WHERE kind=? AND id=?'),
    allEnt: db.prepare('SELECT kind, id, data, rev FROM entities'),
    ev: db.prepare('INSERT INTO events(ts,user,kind,id,op,rev,data) VALUES(?,?,?,?,?,?,?)'),
    evSince: db.prepare('SELECT * FROM events WHERE seq>? ORDER BY seq LIMIT 1000'),
    maxSeq: db.prepare('SELECT COALESCE(MAX(seq),0) AS s FROM events'),
    acctCount: db.prepare('SELECT COUNT(*) AS n FROM accounts'),
    acctByName: db.prepare('SELECT * FROM accounts WHERE username=?'),
    addAcct: db.prepare('INSERT INTO accounts(id,username,hash,created) VALUES(?,?,?,?)'),
    setHash: db.prepare('UPDATE accounts SET hash=? WHERE id=?'),
    delAcct: db.prepare('DELETE FROM accounts WHERE id=?'),
    addSess: db.prepare('INSERT INTO sessions(sid,user_id,expires) VALUES(?,?,?)'),
    getSess: db.prepare('SELECT * FROM sessions WHERE sid=?'),
    delSess: db.prepare('DELETE FROM sessions WHERE sid=?'),
    delUserSess: db.prepare('DELETE FROM sessions WHERE user_id=?'),
    admins: db.prepare("SELECT COUNT(*) AS n FROM entities WHERE kind='users' AND json_extract(data,'$.role')='Admin'")
  };

  function err(status, m, extra) { var e = new Error(m); e.status = status; e.extra = extra; return e; }
  function get(kind, id) { var r = q.getEnt.get(kind, id); return r ? { d: JSON.parse(r.data), rev: r.rev } : null; }

  function emit(user, kind, id, op, rev, data) {
    var ts = Date.now();
    var r = q.ev.run(ts, user, kind, id, op, rev, data ? JSON.stringify(data) : null);
    var msg = { seq: Number(r.lastInsertRowid), ts: ts, user: user, kind: kind, id: id, op: op, rev: rev, data: data || null };
    return msg;
  }
  function broadcast(msgs) {
    msgs.forEach(function (m) {
      var line = 'id: ' + m.seq + '\nevent: change\ndata: ' + JSON.stringify(m) + '\n\n';
      clients.forEach(function (c) { c.res.write(line); });
    });
  }

  /* ---- mutations (all run in one transaction; return events to broadcast) ---- */
  function upsert(user, kind, body, ifRev, mode) {
    var d = V.normalize(kind, body);
    var cur = get(kind, d.id);
    if (mode === 'create' && cur) throw err(409, 'already exists', { current: cur.d, rev: cur.rev });
    if (mode === 'update' && !cur) throw err(404, 'not found');
    if (cur && ifRev != null && ifRev !== cur.rev) throw err(409, 'stale revision', { current: cur.d, rev: cur.rev });
    if (!P.can(user, cur ? 'update' : 'create', kind, cur && cur.d, d)) throw err(403, 'forbidden');
    if (kind === 'tasks') {
      if (user.role === 'Researcher' && d.timer && d.timer.user !== user.id) throw err(403, 'forbidden');
    }
    if (kind === 'users' && cur && cur.d.role === 'Admin' && d.role !== 'Admin' && q.admins.get().n <= 1) throw err(409, 'cannot demote the last Admin');
    if (kind === 'users' && !cur) throw err(400, 'create users via /api/accounts');
    var rev = cur ? cur.rev + 1 : 1;
    q.putEnt.run(kind, d.id, JSON.stringify(d), rev, Date.now(), user.id);
    return [emit(user.id, kind, d.id, cur ? 'update' : 'create', rev, d)];
  }
  function patch(user, kind, id, fields, ifRev) {
    var cur = get(kind, id);
    if (!cur) throw err(404, 'not found');
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw err(400, 'object expected');
    var merged = Object.assign({}, cur.d, fields, { id: id });
    return upsert(user, kind, merged, ifRev, 'update');
  }
  function remove(user, kind, id, ifRev) {
    var cur = get(kind, id);
    if (!cur) throw err(404, 'not found');
    if (ifRev != null && ifRev !== cur.rev) throw err(409, 'stale revision', { current: cur.d, rev: cur.rev });
    if (!P.can(user, 'delete', kind, cur.d, null)) throw err(403, 'forbidden');
    var evs = [];
    if (kind === 'users') {
      if (cur.d.role === 'Admin' && q.admins.get().n <= 1) throw err(409, 'cannot delete the last Admin');
      q.delAcct.run(id); q.delUserSess.run(id);
    }
    q.delEnt.run(kind, id);
    evs.push(emit(user.id, kind, id, 'delete', cur.rev + 1, null));
    if (kind === 'tasks') { // detach dependencies pointing at the deleted task
      db.prepare("SELECT id FROM entities WHERE kind='tasks'").all().forEach(function (r) {
        var t = get('tasks', r.id);
        if (t.d.deps.indexOf(id) >= 0) {
          t.d.deps = t.d.deps.filter(function (x) { return x !== id; });
          q.putEnt.run('tasks', r.id, JSON.stringify(t.d), t.rev + 1, Date.now(), user.id);
          evs.push(emit(user.id, 'tasks', r.id, 'update', t.rev + 1, t.d));
        }
      });
    }
    return evs;
  }
  function snapshot() {
    var out = { v: 1 };
    P.KINDS.forEach(function (k) { out[k] = []; });
    var revs = {};
    q.allEnt.all().forEach(function (r) { out[r.kind].push(JSON.parse(r.data)); revs[r.kind + '/' + r.id] = r.rev; });
    return { state: out, revs: revs, seq: Number(q.maxSeq.get().s) };
  }

  /* ---- http helpers ---- */
  function json(res, status, obj, headers) {
    var b = JSON.stringify(obj);
    res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, headers || {}));
    res.end(b);
  }
  function body(req, limit) {
    return new Promise(function (resolve, reject) {
      var ct = String(req.headers['content-type'] || '');
      if (ct.indexOf('application/json') !== 0) return reject(err(415, 'application/json required'));
      var n = 0, chunks = [];
      req.on('data', function (c) { n += c.length; if (n > (limit || 5e6)) { reject(err(413, 'payload too large')); req.destroy(); } else chunks.push(c); });
      req.on('end', function () { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(err(400, 'invalid JSON')); } });
      req.on('error', reject);
    });
  }
  function cookies(req) {
    var o = {};
    String(req.headers.cookie || '').split(/;\s*/).forEach(function (p) { var i = p.indexOf('='); if (i > 0) o[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); });
    return o;
  }
  function authUser(req) {
    var t = cookies(req)[COOKIE];
    if (!t) return null;
    var s = q.getSess.get(D.sidHash(t));
    if (!s) return null;
    if (s.expires < Date.now()) { q.delSess.run(s.sid); return null; }
    var u = get('users', s.user_id);
    return u ? u.d : null;
  }
  function startSession(res, uid, extra) {
    var tok = crypto.randomBytes(32).toString('hex');
    q.addSess.run(D.sidHash(tok), uid, Date.now() + TTL);
    return { 'Set-Cookie': COOKIE + '=' + tok + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + (TTL / 1000) + (secure ? '; Secure' : '') };
  }
  function throttled(key) { var f = fails[key]; return f && f.n >= 10 && Date.now() - f.t < 15 * 60 * 1000; }
  function noteFail(key) { var f = fails[key]; if (!f || Date.now() - f.t > 15 * 60 * 1000) f = fails[key] = { n: 0, t: Date.now() }; f.n++; f.t = Date.now(); }

  function checkPwPolicy(pw) { if (typeof pw !== 'string' || pw.length < 10 || pw.length > 200) throw err(400, 'password must be 10-200 characters'); }
  function newAccount(b, role) {
    var name = String(b.username || '').trim();
    if (!/^[A-Za-z0-9._@-]{3,60}$/.test(name)) throw err(400, 'invalid username');
    checkPwPolicy(b.password);
    if (q.acctByName.get(name)) throw err(409, 'username taken');
    var id = 'u' + crypto.randomBytes(6).toString('hex');
    var u = V.normalize('users', { id: id, name: b.name || name, role: role || b.role, cap: b.cap });
    q.addAcct.run(id, name, D.hashPw(b.password), Date.now());
    q.putEnt.run('users', id, JSON.stringify(u), 1, Date.now(), id);
    return { u: u, ev: emit(id, 'users', id, 'create', 1, u) };
  }

  /* ---- routing ---- */
  function route(req, res, url, user) {
    var m = req.method, p = url.pathname, seg = p.split('/').filter(Boolean); // ['api', ...]
    var ifm = req.headers['if-match'];
    req.cid = String(req.headers['x-client-id'] || '').slice(0, 40);
    var ifRev = ifm != null && /^\d+$/.test(ifm) ? +ifm : null;

    if (p === '/api/status' && m === 'GET') return json(res, 200, { setup: q.acctCount.get().n === 0, version: '2.0.0-alpha.1' });

    if (p === '/api/setup' && m === 'POST') return body(req).then(function (b) {
      var out = D.tx(db, function () { if (q.acctCount.get().n) throw err(409, 'already initialised'); return newAccount(b, 'Admin'); });
      broadcast([out.ev]);
      json(res, 201, { user: out.u }, startSession(res, out.u.id));
    });
    if (p === '/api/login' && m === 'POST') return body(req, 1e4).then(function (b) {
      var key = (req.socket.remoteAddress || '') + '|' + String(b.username).toLowerCase();
      if (throttled(key)) throw err(429, 'too many attempts, retry later');
      var a = q.acctByName.get(String(b.username || ''));
      var ok = a ? D.checkPw(String(b.password || ''), a.hash) : (D.checkPw('x', 'scrypt$' + '00'.repeat(16) + '$' + '00'.repeat(64)), false);
      if (!ok) { noteFail(key); throw err(401, 'invalid credentials'); }
      delete fails[key];
      json(res, 200, { user: get('users', a.id).d }, startSession(res, a.id));
    });
    if (!user) throw err(401, 'authentication required');
    if (p === '/api/logout' && m === 'POST') {
      q.delSess.run(D.sidHash(cookies(req)[COOKIE] || ''));
      return json(res, 200, { ok: true }, { 'Set-Cookie': COOKIE + '=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    }
    if (p === '/api/me' && m === 'GET') return json(res, 200, { user: user });
    if (p === '/api/password' && m === 'POST') return body(req, 1e4).then(function (b) {
      var a = db.prepare('SELECT * FROM accounts WHERE id=?').get(user.id);
      if (!D.checkPw(String(b.current || ''), a.hash)) throw err(401, 'invalid credentials');
      checkPwPolicy(b.password);
      q.setHash.run(D.hashPw(b.password), user.id);
      json(res, 200, { ok: true });
    });
    if (p === '/api/state' && m === 'GET') return json(res, 200, snapshot());
    if (p === '/api/events' && m === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      var last = +(req.headers['last-event-id'] || url.searchParams.get('since') || 0);
      if (last) q.evSince.all(last).forEach(function (r) {
        res.write('id: ' + r.seq + '\nevent: change\ndata: ' + JSON.stringify({ seq: r.seq, ts: r.ts, user: r.user, kind: r.kind, id: r.id, op: r.op, rev: r.rev, data: r.data ? JSON.parse(r.data) : null }) + '\n\n');
      });
      res.write(': connected\n\n');
      var c = { res: res, uid: user.id }; clients.push(c);
      var hb = setInterval(function () { res.write(': hb\n\n'); }, 25000);
      req.on('close', function () { clearInterval(hb); clients = clients.filter(function (x) { return x !== c; }); });
      return;
    }
    if (p === '/api/audit' && m === 'GET') {
      if (user.role !== 'Admin' && user.role !== 'Project manager') throw err(403, 'forbidden');
      var lim = Math.min(500, +url.searchParams.get('limit') || 100);
      return json(res, 200, { events: db.prepare('SELECT seq,ts,user,kind,id,op,rev FROM events ORDER BY seq DESC LIMIT ?').all(lim) });
    }
    if (p === '/api/export' && m === 'GET') { if (user.role !== 'Admin') throw err(403, 'forbidden'); return json(res, 200, snapshot().state); }
    if (p === '/api/import' && m === 'POST') return body(req, 50e6).then(function (b) {
      if (user.role !== 'Admin') throw err(403, 'forbidden');
      var evs = D.tx(db, function () { return importSession(user, b, url.searchParams.get('users') === '1'); });
      broadcast(evs); json(res, 200, { imported: evs.length });
    });
    if (seg[1] === 'accounts' && seg[3] === 'password' && m === 'POST') return body(req, 1e4).then(function (b) {
      if (user.role !== 'Admin') throw err(403, 'forbidden');
      if (!get('users', seg[2])) throw err(404, 'not found');
      checkPwPolicy(b.password);
      q.setHash.run(D.hashPw(b.password), seg[2]); q.delUserSess.run(seg[2]);
      json(res, 200, { ok: true });
    });
    if (p === '/api/accounts' && m === 'POST') return body(req, 1e4).then(function (b) {
      if (user.role !== 'Admin') throw err(403, 'forbidden');
      var out = D.tx(db, function () { return newAccount(b); });
      broadcast([out.ev]); json(res, 201, { user: out.u });
    });

    if (seg[0] === 'api' && P.KINDS.indexOf(seg[1]) >= 0) {
      var kind = seg[1], id = seg[2];
      if (!id && m === 'POST') return body(req).then(function (b) { return mutate(req, res, function () { return upsert(user, kind, b, null, 'create'); }, 201); });
      if (id && m === 'GET') { var r = get(kind, id); if (!r) throw err(404, 'not found'); return json(res, 200, { item: r.d, rev: r.rev }); }
      if (id && m === 'PUT') return body(req).then(function (b) { b.id = id; return mutate(req, res, function () { return upsert(user, kind, b, ifRev, 'update'); }); });
      if (id && m === 'PATCH') return body(req).then(function (b) { return mutate(req, res, function () { return patch(user, kind, id, b, ifRev); }); });
      if (id && m === 'DELETE') return mutate(req, res, function () { return remove(user, kind, id, ifRev); });
    }
    throw err(404, 'not found');
  }
  function mutate(req, res, fn, okStatus) {
    var evs = D.tx(db, fn);
    evs.forEach(function (m) { m.cid = req.cid; });
    broadcast(evs);
    var main = evs[0];
    json(res, okStatus || 200, { id: main.id, rev: main.rev, seq: main.seq, item: main.data });
  }
  function importSession(user, o, withUsers) {
    if (!o || o.v !== 1) throw err(400, 'unsupported session version (expected v:1)');
    var evs = [];
    P.KINDS.forEach(function (k) {
      if (o[k] != null && !Array.isArray(o[k])) throw err(400, k + ' must be an array');
      if ((o[k] || []).length > 5000) throw err(400, k + ' exceeds 5000 items');
    });
    // users imported from a v1 file have no credentials: they are created as role-bearing records without login
    var order = ['users', 'projects', 'fields', 'rules', 'goals', 'tasks', 'docs', 'files'];
    order.forEach(function (k) {
      if (k === 'users' && !withUsers) return;
      (o[k] || []).forEach(function (raw) {
        if (k === 'users') { if (raw.id === user.id) return; raw = Object.assign({}, raw, { role: raw.role === 'Admin' ? 'Viewer' : raw.role }); }
        var d = V.normalize(k, raw);
        var cur = get(k, d.id);
        var rev = cur ? cur.rev + 1 : 1;
        if (k === 'tasks') d.timer = null;
        q.putEnt.run(k, d.id, JSON.stringify(d), rev, Date.now(), user.id);
        evs.push(emit(user.id, k, d.id, cur ? 'update' : 'create', rev, d));
      });
    });
    return evs;
  }

  /* ---- static files ---- */
  var MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
  function serveStatic(req, res, url) {
    var rel = url.pathname === '/' ? '/index.html' : url.pathname;
    var f = path.normalize(path.join(pub, decodeURIComponent(rel)));
    if (f.indexOf(pub + path.sep) !== 0 || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    fs.createReadStream(f).pipe(res);
  }

  var server = http.createServer(function (req, res) {
    var url = new URL(req.url, 'http://x');
    if (url.pathname.indexOf('/api/') !== 0) return serveStatic(req, res, url);
    var done = function (e) {
      if (res.headersSent) return;
      var s = e && e.status || 500;
      if (s === 500) console.error(e && e.stack || e);
      json(res, s, Object.assign({ error: s === 500 ? 'internal error' : e.message }, e.extra || {}));
    };
    try {
      var r = route(req, res, url, authUser(req));
      if (r && r.catch) r.catch(done);
    } catch (e) { done(e); }
  });
  server.on('close', function () { clients.forEach(function (c) { c.res.end(); }); try { db.close(); } catch (e) { /* closed */ } });
  return { server: server, db: db };
}

module.exports = { createApp: createApp };
