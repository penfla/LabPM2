/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.2
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: Unit tests for the shared-folder merge (convergence, tombstones, compaction)
 * Method: node:test
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
var F = require('../shared/fold');
var V = require('../shared/validate');

function mk() { return new F.Fold(V.normalize); }
var base = { projectId: 'p1', title: 'DSC', status: 'To do', priority: 'Medium', assignee: null, start: '2026-11-02', due: '2026-11-03', est: 4, deps: [], tags: [], cf: {}, notes: '', log: [], created: 1700000000000 };
var ops = [
  { t: 10, d: 'A', u: 'u1', k: 'tasks', id: 't1', c: 1, p: base },
  { t: 20, d: 'B', u: 'u2', k: 'tasks', id: 't1', p: { status: 'In progress' } },
  { t: 21, d: 'A', u: 'u1', k: 'tasks', id: 't1', p: { notes: 'from A' } },
  { t: 20, d: 'A', u: 'u1', k: 'tasks', id: 't1', p: { status: 'Done' } },      // same t, device A < B: B wins
  { t: 30, d: 'B', u: 'u2', k: 'tasks', id: 't2', c: 1, p: Object.assign({}, base, { title: 'gone' }) },
  { t: 31, d: 'A', u: 'u1', k: 'tasks', id: 't2', x: 1 },
  { t: 32, d: 'B', u: 'u2', k: 'tasks', id: 't2', p: { title: 'edit after delete' } }
];
function state(f) { return JSON.stringify(['t1', 't2'].map(function (i) { return f.get('tasks', i); })); }
function shuffle(a, seed) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; var j = seed % (i + 1); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

test('fold converges regardless of op order and repetition', function () {
  var ref = mk(); ops.forEach(function (o) { ref.apply(o); });
  for (var s = 1; s <= 25; s++) { var f = mk(); shuffle(ops.concat(ops), s).forEach(function (o) { f.apply(o); }); assert.strictEqual(state(f), state(ref)); }
  var t1 = ref.get('tasks', 't1');
  assert.strictEqual(t1.status, 'In progress'); assert.strictEqual(t1.notes, 'from A'); // per-field merge, tie broken by device id
  assert.strictEqual(ref.get('tasks', 't2'), null); // tombstone is permanent
});
test('incomplete records are not materialised until their creating op arrives', function () {
  var f = mk(); f.apply(ops[1]); assert.strictEqual(f.get('tasks', 't1'), null);
  f.apply(ops[0]); assert.strictEqual(f.get('tasks', 't1').status, 'In progress');
});
test('compaction keeps exactly the winning values of the device', function () {
  var ref = mk(); ops.forEach(function (o) { ref.apply(o); });
  var merged = mk();
  ['A', 'B'].forEach(function (d) { ref.compact(d).forEach(function (o) { merged.apply(o); }); });
  assert.strictEqual(state(merged), state(ref));
  assert.ok(ref.compact('A').length < ops.length);
});
test('restore: a newer full write revives a deleted record; stale patches cannot', function () {
  var restore = { t: 40, d: 'C', u: 'u3', k: 'tasks', id: 't2', c: 1, p: Object.assign({}, base, { title: 'restored' }) };
  var stale = { t: 35, d: 'B', u: 'u2', k: 'tasks', id: 't2', p: { title: 'stale' } };
  var all = ops.concat([restore, stale]);
  for (var s = 1; s <= 25; s++) { var f = mk(); shuffle(all, s).forEach(function (o) { f.apply(o); }); assert.strictEqual(f.get('tasks', 't2').title, 'restored'); }
  var ref = mk(); all.forEach(function (o) { ref.apply(o); });
  var merged = mk(); ['A', 'B', 'C'].forEach(function (d) { ref.compact(d).forEach(function (o) { merged.apply(o); }); });
  assert.strictEqual(state(merged), state(ref));
  assert.strictEqual(ref.order('tasks', 't2'), 30); // display order = first creation, survives restore and compaction
  assert.strictEqual(merged.order('tasks', 't2'), 30);
});
test('tick is strictly increasing and follows seen clocks; parseLog skips partial lines', function () {
  var f = mk(); f.apply({ t: Date.now() + 5000, d: 'X', k: 'tasks', id: 'z', p: {} });
  var a = f.tick(), b = f.tick(); assert.ok(b > a && a > Date.now() + 4000);
  assert.strictEqual(F.parseLog('{"a":1}\n{"b":2}\n{"c":').length, 2);
});
