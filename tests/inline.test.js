/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.2
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: Guards against drift between shared/*.js and the copy inlined in the page
 * Method: compares the generated block with public/index.html
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
var fs = require('node:fs');
var path = require('node:path');
var inl = require('../tools/inline');

test('public/index.html embeds the current shared/*.js (run `node tools/inline.js` after editing them)', function () {
  var html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.strictEqual(inl.build(html), html);
});
