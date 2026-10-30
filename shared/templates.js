/*
 * License-Identifier: PolyForm-Noncommercial-1.0.0
 * Copyright (c) 2026 Flavio Pendolino
 * https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Author: Flavio Pendolino
 * Version: 2.0.0-beta.2
 * License: PolyForm Noncommercial 1.0.0
 * Commercial use: penfla@me.com
 * Purpose: Built-in laboratory templates (seed data; stored as editable records)
 * Method: plain data; seeded once per database, then edited/deleted like any other record. Standards cited: ASTM D3418, ISO 11357-3, ISO 1133-1, ISO 527-3, ASTM D3985
 * Disclaimer: validate the results against your own reference samples before any analytical, engineering, safety or regulatory use.
 * Third-party components: none (Node.js built-ins only)
 * Scientific references: ASTM D3418, ISO 11357-3, ISO 1133-1, ISO 527-3, ASTM D3985
 * AI disclosure: this tool performs deterministic calculations; it does not generate content through generative AI (Art. 50 AI Act not applicable).
 *
 * (c) 2026 Flavio Pendolino | PolyForm Noncommercial 1.0.0
 */

'use strict';

var DEFAULTS=[
 {id:'tpl-dsc',name:'DSC characterization',desc:'ASTM D3418 / ISO 11357-3: from sample preparation to report.',tasks:[
  {t:'Sample preparation and weighing',d:1,est:3},{t:'DSC calibration check (In/Zn)',d:1,est:2,tool:'DSC'},
  {t:'DSC run: 1st heating, cooling, 2nd heating',d:2,est:8,tool:'DSC',after:[0,1]},
  {t:'Data processing: Tm, Tc, ΔHm and crystallinity',d:1,est:3,after:[2]},{t:'Report and data archiving',d:1,est:2,after:[3]}]},
 {id:'tpl-ext',name:'Compound extrusion campaign',desc:'Drying, twin-screw setup, run, sampling and basic characterization.',tasks:[
  {t:'Raw material drying',d:1,est:4},{t:'Thermal profile and feeding setup',d:1,est:6,tool:'Extruder',after:[0]},
  {t:'Extrusion run and sampling',d:2,est:14,tool:'Extruder',after:[1]},{t:'MFR (ISO 1133-1)',d:1,est:4,tool:'MFR',after:[2]},
  {t:'DSC on pellets',d:2,est:6,tool:'DSC',after:[2]},{t:'Campaign report',d:2,est:8,after:[3,4]}]},
 {id:'tpl-film',name:'PE/EVOH/PE multilayer film',desc:'Coextrusion, conditioning, O₂ barrier and mechanical properties.',tasks:[
  {t:'Structure and thickness definition',d:1,est:4},{t:'Film coextrusion',d:2,est:16,tool:'Extruder',after:[0]},
  {t:'Specimen conditioning',d:2,est:1,after:[1]},{t:'OTR (ASTM D3985)',d:3,est:8,tool:'OTR',after:[2]},
  {t:'Tensile test (ISO 527-3)',d:2,est:6,tool:'Tensile tester',after:[2]},{t:'Barrier and mechanical report',d:2,est:8,after:[3,4]}]},
 {id:'tpl-cal',name:'Instrument calibration and verification',desc:'Planning, execution, deviation assessment and report.',tasks:[
  {t:'Planning and reference materials',d:1,est:2},{t:'Calibration execution',d:1,est:4,after:[0]},
  {t:'Deviation assessment',d:1,est:2,after:[1]},{t:'Calibration report and sign-off',d:1,est:2,after:[2]}]},
 {id:'tpl-val',name:'Analytical method validation',desc:'Plan, repeatability, reproducibility, uncertainty and report.',tasks:[
  {t:'Validation plan',d:2,est:6},{t:'Repeatability tests',d:3,est:12,after:[0]},{t:'Reproducibility tests (second operator)',d:3,est:12,after:[1]},
  {t:'Uncertainty estimation',d:2,est:6,after:[2]},{t:'Validation report',d:2,est:8,after:[3]}]}];

module.exports = { DEFAULTS: DEFAULTS };
