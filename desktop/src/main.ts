/**
 * Electron main process entry point.
 *
 * Phase 1 scope: start the relay in-process (same `createRelay()` used by the
 * dev relay server), forward its raw event / session-lifecycle callbacks to
 * the renderer over IPC, and open a window that proves the pipe works. No
 * tray, no packaging, no preferences yet — those are later phases.
 */
import { app, BrowserWindow, Tray, Menu, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

// Bundled by esbuild (see desktop/scripts/build.js) — same module the dev
// relay uses. Bundling pulls in core/* and aliases the `vscode` import to
// scripts/vscode-shim.js.
import { createRelay, type Relay } from '../../scripts/relay'
import { loadPreferences, savePreferences, type DesktopPreferences } from './preferences'

// Phase 6: route console output through electron-log so it also persists to
// disk (default location: app.getPath('logs')/main.log on each OS), instead
// of only being visible when launched from a terminal.
log.transports.file.level = 'info'
log.transports.console.level = 'info'
Object.assign(console, log.functions)

let mainWindow: BrowserWindow | null = null
let relay: Relay | null = null
let preferences: DesktopPreferences = loadPreferences()
let connectionStatus: 'connected' | 'disconnected' | 'degraded' = 'disconnected'

// Phase 3: only one instance of the app should run at a time. If a second
// launch is attempted (e.g. double-clicking the app again while it's already
// running in the tray), focus the existing window instead of starting a new
// process.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// Phase 3: tracks whether the app is genuinely quitting (via the tray's
// "Quit" item, the native menu's Quit role, or OS shutdown) versus the user
// just closing the window, which should hide to tray instead (Slack/Discord
// style background utility behavior).
let isQuitting = false

// Phase 6: createRelay() can throw if the hook server's port is already
// bound (e.g. another instance of this app is already running). That must
// not crash the app or block the window from
// opening — fall back gracefully and let file-based session detection
// (transcript polling) keep working.
async function startRelay(): Promise<void> {
  if (relay) return
  try {
    relay = await createRelay({ workspace: null })
    relay.onRawEvent((event) => {
      mainWindow?.webContents.send('agent-event', event)
    })
    relay.onRawSessionLifecycle((raw) => {
      // Translate the relay's flat {type, sessionId, label, ...} shape into
      // the {type, data} envelope web/lib/vscode-bridge.ts expects on the
      // session-lifecycle channel (same shapes the SSE 'session-started' /
      // 'session-ended' / 'session-updated' messages carry).
      if (raw.type === 'started') {
        mainWindow?.webContents.send('session-lifecycle', {
          type: 'started',
          data: { id: raw.sessionId, label: raw.label, status: 'active', startTime: raw.startTime, lastActivityTime: raw.lastActivityTime },
        })
      } else if (raw.type === 'ended') {
        mainWindow?.webContents.send('session-lifecycle', { type: 'ended', data: raw.sessionId })
      } else if (raw.type === 'updated') {
        mainWindow?.webContents.send('session-lifecycle', { type: 'updated', data: { sessionId: raw.sessionId, label: raw.label } })
      }
    })

    // Sessions already active when the relay started broadcast their
    // 'started' lifecycle event during createRelay()'s synchronous initial
    // scan — before the subscriptions above existed. Without this catch-up,
    // a session that was running before the desktop app launched would
    // never appear, even though the relay knows about it internally.
    const snapshot = relay.getSnapshot()
    if (snapshot.sessions.length > 0) {
      mainWindow?.webContents.send('session-lifecycle', { type: 'list', data: snapshot.sessions })
    }
    for (const event of snapshot.events) {
      mainWindow?.webContents.send('agent-event', event)
    }

    connectionStatus = 'connected'
  } catch (err) {
    log.error('Failed to start relay/hook server:', err)
    connectionStatus = 'degraded'
    dialog.showErrorBox(
      'AgenticVisualizer',
      'Could not start the session listener (port already in use — is another instance already running?). File-based session detection will still work.',
    )
  }
  mainWindow?.webContents.send('connection-status', { status: connectionStatus, source: 'electron-main' })
}

function stopRelay(): void {
  relay?.dispose()
  relay = null
  connectionStatus = 'disconnected'
  mainWindow?.webContents.send('connection-status', { status: connectionStatus, source: 'electron-main' })
}

function resolveRendererPath(): string | null {
  // Built by desktop/scripts/build-renderer.js (desktop/vite.renderer.config.ts)
  // into desktop/dist/renderer/. Falls back to the placeholder if missing.
  const candidate = path.join(__dirname, 'renderer', 'index.html')
  return fs.existsSync(candidate) ? candidate : null
}

// Resolves once the renderer's page has finished loading — i.e. once
// preload.ts's contextBridge listeners are guaranteed to be attached.
// startRelay() awaits this before sending its catch-up snapshot, otherwise
// session data broadcast immediately on launch has no listener yet on the
// renderer side and is silently dropped (mirrors the bug this was added to fix).
function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'AgenticVisualizer',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  const rendererPath = resolveRendererPath()
  const loaded = new Promise<void>((resolve) => {
    mainWindow!.webContents.once('did-finish-load', () => resolve())
  })

  // Re-send connection status and the session snapshot on every page load,
  // including reloads triggered by View > Reload / Ctrl+R. On the first load
  // this fires before startRelay() (sending the pre-relay 'disconnected'
  // state); startRelay() then overwrites it with 'connected'. On subsequent
  // reloads it is the only sender, so without this handler the renderer
  // would stay stuck at 'disconnected' forever.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('connection-status', { status: connectionStatus, source: 'electron-main' })
    if (relay) {
      const snapshot = relay.getSnapshot()
      if (snapshot.sessions.length > 0) {
        mainWindow?.webContents.send('session-lifecycle', { type: 'list', data: snapshot.sessions })
      }
      for (const event of snapshot.events) {
        mainWindow?.webContents.send('agent-event', event)
      }
    }
  })

  if (rendererPath) {
    mainWindow.loadFile(rendererPath)
  } else {
    mainWindow.loadFile(path.join(__dirname, 'placeholder.html'))
  }

  // Closing the window fully quits the app (relay, hook server, file
  // watchers, tray icon all torn down via 'before-quit' -> stopRelay()).
  // macOS is the one exception: red-X-to-hide is the platform convention
  // there, and the dock icon is already hidden (see app.dock?.hide() below)
  // so the tray's "Show"/"Quit" items remain the only way back in.
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
      return
    }
    isQuitting = true
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return loaded
}

function setupTray(win: BrowserWindow) {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png')
  const tray = new Tray(iconPath)
  tray.setToolTip('AgenticVisualizer')

  // Phase 6: keep the "Launch at login" checkbox in sync with the actual OS
  // state on startup, in case the user changed it via OS settings directly
  // rather than through this menu.
  const osLoginState = app.getLoginItemSettings().openAtLogin
  if (osLoginState !== preferences.launchAtLogin) {
    preferences.launchAtLogin = osLoginState
    savePreferences(preferences)
  }

  function rebuildMenu() {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Show AgenticVisualizer',
        click: () => {
          win.show()
          win.focus()
        },
      },
      { type: 'separator' },
      {
        label: 'Auto-detect sessions',
        type: 'checkbox',
        checked: preferences.autoDetectSessions,
        click: (menuItem) => {
          preferences.autoDetectSessions = menuItem.checked
          savePreferences(preferences)
          if (preferences.autoDetectSessions) {
            startRelay().catch((err) => log.error('startRelay failed:', err))
          } else {
            stopRelay()
          }
        },
      },
      {
        label: 'Launch at login',
        type: 'checkbox',
        checked: preferences.launchAtLogin,
        click: (menuItem) => {
          preferences.launchAtLogin = menuItem.checked
          savePreferences(preferences)
          app.setLoginItemSettings({ openAtLogin: menuItem.checked })
        },
      },
      { type: 'separator' },
      {
        label: 'Preferences...',
        click: () => {
          dialog.showMessageBox(win, {
            type: 'info',
            title: 'Preferences',
            message: 'AgenticVisualizer Preferences',
            detail:
              `Auto-detect sessions: ${preferences.autoDetectSessions ? 'On' : 'Off'}\n` +
              `Launch at login: ${preferences.launchAtLogin ? 'On' : 'Off'}\n` +
              `Hook port override: ${preferences.hookPortOverride ?? '(default)'}\n\n` +
              'Use the tray menu checkboxes to change these settings.',
          })
        },
      },
      {
        label: 'About',
        click: () => {
          const sessionCount = relay ? '(see main window for active sessions)' : 'n/a'
          dialog.showMessageBox(win, {
            type: 'info',
            title: 'About AgenticVisualizer',
            message: 'AgenticVisualizer',
            detail:
              `Version ${app.getVersion()}\n` +
              `Status: ${connectionStatus === 'connected' ? 'Running' : connectionStatus === 'degraded' ? 'Running (file-based detection only)' : 'Running'}\n` +
              `Active sessions: ${sessionCount}`,
          })
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ])
    tray.setContextMenu(menu)
  }

  rebuildMenu()

  // Windows convention: left-click the tray icon toggles the window instead
  // of (only) opening the context menu.
  tray.on('click', () => {
    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })

  return tray
}

function setupApplicationMenu() {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: app.name,
          submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
        },
        {
          label: 'View',
          submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }],
        },
        {
          label: 'Window',
          submenu: [{ role: 'minimize' }, { role: 'close' }],
        },
      ]
    : [
        {
          label: 'File',
          submenu: [{ role: 'quit' }],
        },
        {
          label: 'View',
          submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }],
        },
        {
          label: 'Window',
          submenu: [{ role: 'minimize' }, { role: 'close' }],
        },
        {
          label: 'Help',
          submenu: [
            {
              label: 'About',
              click: () => {
                dialog.showMessageBox({
                  type: 'info',
                  title: 'About AgenticVisualizer',
                  message: 'AgenticVisualizer',
                  detail: `Lukis Visualizer App Version ${app.getVersion()}`,
                })
              },
            },
          ],
        },
      ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  // Phase 5: check for updates on startup and notify the user when one has
  // been downloaded (no-op in dev / unpackaged runs — electron-updater
  // requires app.isPackaged and a configured publish provider).
  autoUpdater.checkForUpdatesAndNotify().catch(() => {
    // Swallow errors (e.g. no update server reachable, unpackaged app) —
    // update checks must never block app startup.
  })
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-downloaded', info)
  })

  await createWindow()

  if (preferences.autoDetectSessions) {
    await startRelay()
  } else {
    mainWindow?.webContents.send('connection-status', { status: 'disconnected', source: 'electron-main' })
  }

  setupApplicationMenu()
  if (mainWindow) setupTray(mainWindow)

  // Phase 3: on macOS the app should live in the tray, not the Dock, like a
  // background utility (mirrors Slack/Discord "minimize to tray" behavior).
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  // Phase 3: closing via the tray's Quit item / native menu Quit role /
  // OS shutdown should bypass the hide-to-tray behavior in the window's
  // `close` handler and actually exit.
  isQuitting = true
  stopRelay()
})
