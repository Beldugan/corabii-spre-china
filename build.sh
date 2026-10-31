#!/bin/sh
# Reface assets/js/app.js din sursele din src/ (necesită: npm i three@0.160.0 d3-geo topojson-client esbuild)
NM=${NM:-./node_modules}
$NM/.bin/esbuild src/main.js --bundle --minify --format=iife --target=es2019 --loader:.json=json --outfile=assets/js/app.js --alias:three=$NM/three --log-level=warning
