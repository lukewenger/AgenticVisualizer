/**
 * Preload script — runs in an isolated context with access to Node and
 * Electron APIs, but the renderer only ever sees what's explicitly exposed
 * via contextBridge. Keeps nodeIntegration disabled in the renderer.
 */
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronBridge', {
  onEvent: (cb: (data: unknown) => void) => {
    ipcRenderer.on('agent-event', (_event, data) => cb(data))
  },
  onSessionLifecycle: (cb: (data: unknown) => void) => {
    ipcRenderer.on('session-lifecycle', (_event, data) => cb(data))
  },
  onStatus: (cb: (data: unknown) => void) => {
    ipcRenderer.on('connection-status', (_event, data) => cb(data))
  },
  send: (channel: string, data: unknown) => {
    ipcRenderer.send(channel, data)
  },
})
