#!/usr/bin/env node
/**
 * Builds the Electron renderer UI: the same standalone React entry
 * (web/app-entry.tsx) used by `npx agent-flow-app`, bundled via
 * desktop/vite.renderer.config.ts into desktop/dist/renderer/.
 *
 * Mirrors app/build.js's webview build step. The Vite `lib`/iife build only
 * emits index.js + index.css (no HTML), so we also write the HTML shell
 * here, mirroring the shell app/src/static.ts serves for the standalone app.
 */
'use strict'

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const DESKTOP_DIR = path.join(__dirname, '..')
const ROOT = path.join(DESKTOP_DIR, '..')
const WEB_DIR = path.join(ROOT, 'web')
const RENDERER_OUT_DIR = path.join(DESKTOP_DIR, 'dist', 'renderer')

console.log('Building Agent Flow desktop renderer...\n')

console.log('[1/2] Building renderer UI (Vite)...')
execSync('npx vite build --config ../desktop/vite.renderer.config.ts', {
  cwd: WEB_DIR,
  stdio: 'inherit',
})

console.log('\n[2/2] Writing renderer HTML shell...')
const HTML_SHELL = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Flow</title>
  <link rel="stylesheet" href="./index.css">
  <style>html, body { height: 100%; margin: 0; padding: 0; }</style>
</head>
<body class="font-sans antialiased" style="background: #0a0a1a;">
  <div id="root" style="height: 100%;"></div>
  <script src="./index.js"></script>
</body>
</html>
`
fs.writeFileSync(path.join(RENDERER_OUT_DIR, 'index.html'), HTML_SHELL)

console.log('\nDone! Renderer ready in desktop/dist/renderer/')
