/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-alpha.1
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: Server entry point
 * Method: reads PORT, HOST, DATA_DIR, COOKIE_SECURE from the environment
 * Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
 * Third-party components: none (Node.js built-ins only)
 * Scientific references: n/a
 * AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
 *
 * (c) 2026 Flavio Pendolino | PolyForm Noncommercial 1.0.0
 */
'use strict';
var fs = require('node:fs');
var path = require('node:path');
var app = require('./app');

var dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dir, { recursive: true });
var a = app.createApp({ dbPath: path.join(dir, 'labpm.sqlite'), cookieSecure: process.env.COOKIE_SECURE === '1' });
var port = +process.env.PORT || 8080, host = process.env.HOST || '0.0.0.0';
a.server.listen(port, host, function () { console.log('LabPM 2.0.0-alpha.1 listening on http://' + host + ':' + port); });
process.on('SIGTERM', function () { a.server.close(function () { process.exit(0); }); });
