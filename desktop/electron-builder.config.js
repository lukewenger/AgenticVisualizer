'use strict'

/**
 * electron-builder configuration for the AgenticVisualizer desktop app.
 *
 * NOTE on the `electron-builder` devDependency version pin (see
 * desktop/package.json and the root package.json's `pnpm.overrides`):
 * it is pinned EXACT at 26.12.1, not `^26.0.0`. Two separate upstream
 * regressions bracket every other version around it:
 *   - `app-builder-lib` >=26.14.0 hard-requires `@noble/hashes@^2.2.0`,
 *     which is ESM-only — electron-builder's own `require()` of it crashes
 *     with `ERR_REQUIRE_ESM` (in targets/blockmap/blockmap.js) on every
 *     run, including `--dir` / unpacked builds.
 *   - `app-builder-lib@26.13.1`'s NSIS target calls
 *     `builder_util_1.spawnAndWriteWithOutput`, a function that does not
 *     exist in the `builder-util@26.13.0` it itself depends on (it only
 *     ships `spawnAndWrite`) — every NSIS build fails with
 *     `TypeError: spawnAndWriteWithOutput is not a function`. This is a
 *     real version-skew bug in the 26.13.1 release itself, not a
 *     resolution/hoisting issue.
 * 26.12.1 predates both regressions and packages + builds NSIS cleanly.
 * Do not bump past 26.12.x until upstream fixes are released (re-check
 * 26.13.2+ and 26.14.1+ for fixes before upgrading). The root
 * `pnpm.overrides` block pins `app-builder-lib`, `builder-util`,
 * `dmg-builder`, `electron-builder-squirrel-windows`, and
 * `electron-publish` all to 26.12.1 too, since pnpm does not reliably
 * apply overrides to pure peerDependencies (electron-builder-squirrel-windows
 * is also pinned as an explicit desktop devDependency for the same reason).
 *
 * Packaging only — no code signing / notarization is configured yet:
 *   - TODO(signing): Windows builds are unsigned. Add `win.certificateFile` /
 *     `win.certificateSubjectName` (or CSC_LINK / CSC_KEY_PASSWORD env vars)
 *     once a code-signing certificate is available.
 *   - TODO(notarization): macOS builds are unsigned and unnotarized. Add
 *     `mac.identity`, `afterSign` (e.g. @electron/notarize), and the
 *     APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID env vars once
 *     an Apple Developer ID is available. Without this, Gatekeeper will
 *     block the app on first launch.
 *
 */
module.exports = {
  appId: 'com.agenticvisualizer.desktop',
  productName: 'AgenticVisualizer',
  directories: {
    output: 'dist-packages',
  },
  files: [
    'dist/**',
    'package.json',
    '!dist/**/*.map',
  ],
  win: {
    target: 'nsis',
    icon: 'assets/icon.ico',
  },
  mac: {
    target: 'dmg',
    icon: 'assets/icon.icns',
    category: 'public.app-category.developer-tools',
  },
  linux: {
    target: 'AppImage',
    icon: 'assets/icon.png',
  },
  publish: {
    provider: 'github',
    owner: 'lukewenger',
    repo: 'AgenticVisualizer',
  },
}
