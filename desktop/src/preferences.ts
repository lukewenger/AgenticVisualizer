/**
 * Preferences persistence for the desktop app.
 *
 * Stored as JSON under Electron's per-OS userData directory (the correct
 * convention — avoids reinventing path resolution like `~/.agent-flow/`).
 * Typical locations:
 *   Windows: %APPDATA%/agent-flow-desktop/desktop-prefs.json
 *   macOS:   ~/Library/Application Support/agent-flow-desktop/desktop-prefs.json
 *   Linux:   ~/.config/agent-flow-desktop/desktop-prefs.json
 */
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import log from 'electron-log'

export interface DesktopPreferences {
  launchAtLogin: boolean
  autoDetectSessions: boolean
  hookPortOverride: number | null
}

export const DEFAULT_PREFERENCES: DesktopPreferences = {
  launchAtLogin: false,
  autoDetectSessions: true,
  hookPortOverride: null,
}

function prefsPath(): string {
  return path.join(app.getPath('userData'), 'desktop-prefs.json')
}

export function loadPreferences(): DesktopPreferences {
  try {
    const raw = fs.readFileSync(prefsPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_PREFERENCES, ...parsed }
  } catch {
    // No file yet, or corrupt JSON — fall back to defaults.
    return { ...DEFAULT_PREFERENCES }
  }
}

export function savePreferences(prefs: DesktopPreferences): void {
  try {
    const target = prefsPath()
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, JSON.stringify(prefs, null, 2), 'utf-8')
  } catch (err) {
    log.error('Failed to save preferences:', err)
  }
}
