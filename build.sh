#!/bin/sh
# Reface assets/js/app.js din sursele din src/, cu modulul de limbă RO / EN (src/lang/).
# O singură dată: npm i three@0.160.0 d3-geo@3.1.0 topojson-client@3.1.0 esbuild@0.20.2 acorn@8.11.3 acorn-walk@8.3.2
node tools/build.mjs
