"use client"

import { useCallback, useRef, useState } from "react"
import { COLORS } from "@/lib/colors"
import { vscodeBridge } from "@/lib/vscode-bridge"
import type { SimulationEvent } from "@/lib/agent-types"
import type { useVSCodeBridge } from "@/hooks/use-vscode-bridge"

/** Current on-disk envelope format for a saved session. */
const FORMAT_VERSION = 1

interface SessionEnvelope {
  formatVersion: number
  session: {
    id: string
    label: string
    status: 'active' | 'completed' | 'loaded'
    startTime: number
    lastActivityTime: number
  }
  events: SimulationEvent[]
  savedAt: number
}

function isSessionEnvelope(value: unknown): value is SessionEnvelope {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (v.formatVersion !== FORMAT_VERSION) return false
  if (!v.session || typeof v.session !== 'object') return false
  const session = v.session as Record<string, unknown>
  if (typeof session.id !== 'string' || typeof session.label !== 'string') return false
  if (!Array.isArray(v.events)) return false
  return true
}

/** Sanitize a label into a filesystem-safe filename fragment. */
function sanitizeForFilename(label: string): string {
  return label.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'session'
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Save/Load Controls ──────────────────────────────────────────────────────

export interface SaveLoadControlsProps {
  /** Bridge hook result — used for getSessionEvents (read) and loadLocalSession (write). */
  bridge: ReturnType<typeof useVSCodeBridge>
  /** Currently selected session ID. Save is disabled/no-op when null. */
  sessionId: string | null
  /** Human-readable label for the session, used for the saved filename and the
   *  reloaded session's display name. Falls back to sessionId if omitted. */
  sessionLabel?: string
}

/**
 * Two small buttons — Save and Load — for persisting a session's event log
 * to disk (VS Code save dialog or browser download) and reading it back
 * (VS Code open dialog or browser file picker). Loaded sessions are injected
 * via bridge.loadLocalSession and replay through the existing simulation
 * machinery like any other session.
 */
export function SaveLoadControls({ bridge, sessionId, sessionLabel }: SaveLoadControlsProps) {
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showError = useCallback((message: string) => {
    setError(message)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setError(null), 4000)
  }, [])

  const handleSave = useCallback(() => {
    if (!sessionId) return
    const label = sessionLabel ?? sessionId
    const now = Date.now()
    const envelope: SessionEnvelope = {
      formatVersion: FORMAT_VERSION,
      session: {
        id: sessionId,
        label,
        status: 'completed',
        startTime: now,
        lastActivityTime: now,
      },
      events: bridge.getSessionEvents(sessionId),
      savedAt: now,
    }
    const json = JSON.stringify(envelope)
    const filename = `${sanitizeForFilename(label)}-${todayStamp()}.agentflow.json`

    if (vscodeBridge?.isVSCode) {
      vscodeBridge.saveSession(json, filename)
      return
    }

    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [bridge, sessionId, sessionLabel])

  const applyLoadedJson = useCallback((json: string) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      showError('Could not parse session file (invalid JSON)')
      return
    }
    if (!isSessionEnvelope(parsed)) {
      showError('Not a valid Agent Flow session file')
      return
    }
    bridge.loadLocalSession({ session: parsed.session, events: parsed.events })
  }, [bridge, showError])

  const handleLoad = useCallback(async () => {
    if (vscodeBridge?.isVSCode) {
      const json = await vscodeBridge.requestLoadSession()
      if (json !== null) applyLoadedJson(json)
      return
    }
    fileInputRef.current?.click()
  }, [applyLoadedJson])

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') applyLoadedJson(reader.result)
    }
    reader.onerror = () => showError('Failed to read selected file')
    reader.readAsText(file)
  }, [applyLoadedJson, showError])

  const buttonStyle: React.CSSProperties = {
    background: COLORS.toggleInactive,
    border: `1px solid ${COLORS.toggleBorder}`,
    color: COLORS.textMuted,
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleSave}
        disabled={!sessionId}
        className="px-1.5 py-0.5 rounded transition-all disabled:opacity-40"
        style={buttonStyle}
      >
        Save
      </button>
      <button
        onClick={handleLoad}
        className="px-1.5 py-0.5 rounded transition-all"
        style={buttonStyle}
      >
        Load
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileSelected}
      />
      {error && (
        <span className="text-[10px]" style={{ color: COLORS.error }}>
          {error}
        </span>
      )}
    </div>
  )
}
