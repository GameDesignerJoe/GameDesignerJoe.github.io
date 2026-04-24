#!/usr/bin/env node
/* eslint-disable */
// Deploys the Vite build output into meetMorse/ for GitHub Pages.
// 1. Restores index.html from the committed template (so vite build has clean source)
// 2. Runs vite build (writes to dist/)
// 3. Copies dist/index.html to meetMorse/index.html (the file GH Pages serves)
// 4. Replaces meetMorse/assets/ with dist/assets/
// 5. Removes dist/

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'index.src.html');
const SOURCE_INDEX = path.join(ROOT, 'index.html');
const DIST = path.join(ROOT, 'dist');
const ASSETS_OUT = path.join(ROOT, 'assets');

if (!fs.existsSync(TEMPLATE)) {
  console.error('Missing index.src.html template at repo root.');
  process.exit(1);
}

console.log('[deploy] restoring source index.html from template');
fs.copyFileSync(TEMPLATE, SOURCE_INDEX);

console.log('[deploy] running vite build');
execSync('vite build', { cwd: ROOT, stdio: 'inherit' });

const distIndex = path.join(DIST, 'index.html');
const distAssets = path.join(DIST, 'assets');
if (!fs.existsSync(distIndex) || !fs.existsSync(distAssets)) {
  console.error('Build did not produce expected dist output.');
  process.exit(1);
}

console.log('[deploy] copying dist/index.html -> index.html (built version, served by GH Pages)');
fs.copyFileSync(distIndex, SOURCE_INDEX);

console.log('[deploy] replacing assets/');
fs.rmSync(ASSETS_OUT, { recursive: true, force: true });
fs.cpSync(distAssets, ASSETS_OUT, { recursive: true });

console.log('[deploy] cleaning dist/');
fs.rmSync(DIST, { recursive: true, force: true });

console.log('[deploy] done. commit meetMorse/index.html and meetMorse/assets/ then push.');
