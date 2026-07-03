#!/usr/bin/env bash
set -euo pipefail
rm -rf dist && mkdir -p dist
npx esbuild src/app.jsx --bundle --minify --jsx=automatic --outfile=dist/app.js
cp public/* dist/
echo "Built dist/ ($(du -sh dist | cut -f1))"
