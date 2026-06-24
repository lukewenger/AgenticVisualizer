#!/usr/bin/env node
/**
 * Builds the Electron main + preload bundles via esbuild, mirroring the
 * pattern used by scripts/build-relay.js: bundle the TypeScript entry
 * points for Node, alias `vscode` to the shim so the core/ watcher code
 * that scripts/relay.ts pulls in (hook-server.ts, etc.) runs outside VS Code.
 *
 * Also copies the placeholder HTML into dist/ so main.ts can load it when
 * no built renderer is present yet (Phase 2 wires the real renderer).
 */
'use strict'

const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

const DESKTOP_DIR = path.join(__dirname, '..')
const ROOT = path.join(DESKTOP_DIR, '..')
const SRC_DIR = path.join(DESKTOP_DIR, 'src')
const OUT_DIR = path.join(DESKTOP_DIR, 'dist')

console.log('Building AgenticVisualizer desktop...\n')

fs.mkdirSync(OUT_DIR, { recursive: true })

const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  external: ['electron'],
  alias: {
    'vscode': path.join(ROOT, 'scripts', 'vscode-shim.js'),
  },
  sourcemap: true,
  logLevel: 'warning',
}

console.log('[1/3] Bundling main process...')
esbuild.buildSync({
  ...sharedOptions,
  entryPoints: [path.join(SRC_DIR, 'main.ts')],
  outfile: path.join(OUT_DIR, 'main.js'),
})

console.log('[2/3] Bundling preload script...')
esbuild.buildSync({
  ...sharedOptions,
  entryPoints: [path.join(SRC_DIR, 'preload.ts')],
  outfile: path.join(OUT_DIR, 'preload.js'),
})

console.log('[3/3] Copying placeholder renderer...')
fs.copyFileSync(
  path.join(SRC_DIR, 'placeholder.html'),
  path.join(OUT_DIR, 'placeholder.html'),
)

console.log('\nDone! Bundles ready in desktop/dist/')
