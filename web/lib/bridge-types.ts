/**
 * Shared types for the desktop/webview bridge protocol.
 *
 * These types mirror core/protocol.ts and are kept separate to avoid
 * cross-project imports. When updating these, also update the canonical
 * definitions in core/protocol.ts.
 */

export interface AgentEvent {
  time: number
  type: string
  payload: Record<string, unknown>
  sessionId?: string
}

export interface SessionInfo {
  id: string
  label: string
  status: 'active' | 'completed' | 'loaded'
  startTime: number
  lastActivityTime: number
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'watching'
