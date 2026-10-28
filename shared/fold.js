/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.2
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: Conflict-free merge of per-device operation logs (shared-folder mode, no server)
 * Method: per-field last-writer-wins on (clock, device); idempotent and order-independent; permanent delete tombstones; log compaction
 * Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
 * Third-party components: none (Node.js built-ins only)
 * Scientific references: n/a
 * AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
 *
 * (c) 2026 Flavio Pendolino | PolyForm Noncommercial 1.0.0
 */
'use strict';

/*
 * Fold: conflict-free state built from an append-only operation log (shared-folder mode).
 * op = { t, d, u, k, id, c?: 1, p: {field: value} }   set fields; c = full-record write (create / restore)
 *    | { t, d, u, k, id, x: 1 }                       delete
 * A record is alive when its latest c-op is newer than its latest x-op. Field values older than that epoch
 * are discarded, so a stale patch can never resurrect a deleted record, while a restore (new c-op) can.
 * Per field the op with the highest (t, d) wins: applying the same ops in any order, any number of times,
 * gives the same state. Each device writes only its own log file.
 */
function after(a, b) { return a[0] !== b[0] ? a[0] > b[0] : a[1] > b[1]; }
function latest(a, b) { return !a ? b : !b ? a : (after(a, b) ? a : b); }

function Fold(norm) {
  this.ent = {};
  this.clock = 0;
  this.norm = norm;   // function(kind, obj) -> normalised obj, throws if invalid/incomplete
}
Fold.prototype.apply = function (op) {
  if (!op || typeof op.k !== 'string' || typeof op.id !== 'string' || typeof op.t !== 'number' || typeof op.d !== 'string') return null;
  if (op.t > this.clock) this.clock = op.t;
  var key = op.k + '/' + op.id, e = this.ent[key];
  if (!e) e = this.ent[key] = { k: op.k, id: op.id, obj: { id: op.id }, ft: {}, cs: null, ds: null, t0: null, t0d: null, last: null };
  var stamp = [op.t, op.d], changed = false;
  if (op.c) {
    if (e.t0 === null || op.t < e.t0) { e.t0 = op.t; e.t0d = op.d; }
    if (!e.cs || after(stamp, e.cs)) { e.cs = stamp; changed = true; e.last = op.u || null; }
  }
  if (op.x && (!e.ds || after(stamp, e.ds))) { e.ds = stamp; changed = true; e.last = op.u || null; }
  var epoch = latest(e.cs, e.ds);
  if (changed && epoch) Object.keys(e.ft).forEach(function (f) { if (after(epoch, e.ft[f])) { delete e.ft[f]; delete e.obj[f]; } });
  if (op.p && typeof op.p === 'object') {
    Object.keys(op.p).forEach(function (f) {
      if (f === 'id' || f === '__proto__' || f === 'constructor') return;
      if (epoch && after(epoch, stamp)) return;
      var cur = e.ft[f];
      if (!cur || after(stamp, cur)) { e.obj[f] = op.p[f]; e.ft[f] = stamp; changed = true; e.last = op.u || e.last; }
    });
  }
  return changed ? key : null;
};
/* next clock value for this device (strictly increasing, follows wall time) */
Fold.prototype.tick = function () { this.clock = Math.max(Date.now(), this.clock + 1); return this.clock; };
Fold.prototype.alive = function (e) { return !!e && !!e.cs && (!e.ds || after(e.cs, e.ds)); };
Fold.prototype.get = function (kind, id) {
  var e = this.ent[kind + '/' + id];
  if (!this.alive(e)) return null;
  try { return this.norm(kind, JSON.parse(JSON.stringify(e.obj))); } catch (x) { return null; }
};
Fold.prototype.lastUser = function (kind, id) { var e = this.ent[kind + '/' + id]; return e ? e.last : null; };
/* creation clock: stable display order across devices */
Fold.prototype.order = function (kind, id) { var e = this.ent[kind + '/' + id]; return e && e.t0 !== null ? e.t0 : Infinity; };
Fold.prototype.keys = function () { return Object.keys(this.ent); };
/* minimal op list that reproduces every winning value written by `dev` (log compaction) */
Fold.prototype.compact = function (dev) {
  var out = [], self = this;
  Object.keys(this.ent).forEach(function (key) {
    var e = self.ent[key], byT = {}, base = { d: dev, k: e.k, id: e.id };
    if (e.ds && e.ds[1] === dev) out.push({ t: e.ds[0], d: dev, k: e.k, id: e.id, x: 1 });
    Object.keys(e.ft).forEach(function (f) {
      if (e.ft[f][1] !== dev) return;
      (byT[e.ft[f][0]] = byT[e.ft[f][0]] || {})[f] = e.obj[f];
    });
    var cT = e.cs && e.cs[1] === dev ? e.cs[0] : null, oT = e.t0d === dev ? e.t0 : null;
    [cT, oT].forEach(function (t) { if (t !== null && !byT[t]) byT[t] = {}; });
    Object.keys(byT).forEach(function (t) {
      var op = { t: +t, d: base.d, k: base.k, id: base.id, p: byT[t] };
      if (+t === cT || +t === oT) op.c = 1;
      out.push(op);
    });
  });
  return out.sort(function (a, b) { return a.t - b.t; });
};
/* parse JSON-lines text, ignoring a truncated last line or garbage */
function parseLog(text) {
  var ops = [];
  String(text).split('\n').forEach(function (l) { l = l.trim(); if (!l) return; try { ops.push(JSON.parse(l)); } catch (e) { /* partial line */ } });
  return ops;
}

module.exports = { Fold: Fold, parseLog: parseLog };
