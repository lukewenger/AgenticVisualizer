'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAgentSimulation } from '@/hooks/use-agent-simulation'
import { useVSCodeBridge } from '@/hooks/use-vscode-bridge'
import { useSessionPaneEvents } from '@/hooks/use-session-pane-events'
import { AgentCanvas } from './canvas'
import { TIMING } from '@/lib/agent-types'
import { COLORS } from '@/lib/colors'
import { formatTokens } from '@/lib/utils'

const noop = () => {}

export interface SessionPaneProps {
  sessionId: string
  label: string
}

/**
 * Per-pane equivalent of the main AgentVisualizer view, generalized to an
 * arbitrary session id. Each pane runs its own bridge subscription and its
 * own simulation instance, independently rendering/playing in a grid cell.
 *
 * Deliberately does NOT call useKeyboardShortcuts or useAudioEffects — those
 * must stay exclusive to the single/main view (global window listener and
 * real AudioContext respectively).
 */
export function SessionPane({ sessionId, label }: SessionPaneProps) {
  const bridge = useVSCodeBridge()
  const { pendingEvents, consumeEvents } = useSessionPaneEvents(bridge, sessionId)

  // Ref updated synchronously each render so the animation frame never uses
  // a stale filter value (mirrors how index.tsx passes selectedSessionIdRef).
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  const {
    frameRef,
    agents,
    isPlaying,
    play,
    pause,
    restart,
  } = useAgentSimulation({
    useMockData: false,
    externalEvents: pendingEvents,
    onExternalEventsConsumed: consumeEvents,
    sessionFilter: sessionId,
    sessionFilterRef: sessionIdRef,
    disable1MContext: bridge.disable1MContext,
  })

  const [zoomToFitTrigger, setZoomToFitTrigger] = useState(0)

  // Auto-play on mount
  useEffect(() => {
    const timer = setTimeout(() => play(), TIMING.autoPlayDelayMs)
    return () => clearTimeout(timer)
  }, [play])

  // Frame the graph once on mount
  useEffect(() => {
    setZoomToFitTrigger(n => n + 1)
  }, [])

  const handlePlayPause = useCallback(() => {
    if (isPlaying) pause()
    else play()
  }, [isPlaying, play, pause])

  const handleRestart = useCallback(() => {
    restart(true)
    setZoomToFitTrigger(n => n + 1)
  }, [restart])

  let totalTokens = 0
  for (const a of agents.values()) totalTokens += a.tokensUsed

  return (
    <div style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
      {/* Header bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between gap-2 px-2 py-1 font-mono text-[10px]"
        style={{
          background: COLORS.panelBg,
          borderBottom: `1px solid ${COLORS.holoBorder08}`,
          zIndex: 5,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate" style={{ color: COLORS.textPrimary }}>{label}</span>
          <span style={{ color: COLORS.textMuted }}>{agents.size} agents</span>
          <span style={{ color: COLORS.textMuted }}>{formatTokens(totalTokens)} tok</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handlePlayPause}
            className="px-1.5 py-0.5 rounded"
            style={{
              background: COLORS.toggleInactive,
              border: `1px solid ${COLORS.toggleBorder}`,
              color: COLORS.textDim,
            }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={handleRestart}
            className="px-1.5 py-0.5 rounded"
            style={{
              background: COLORS.toggleInactive,
              border: `1px solid ${COLORS.toggleBorder}`,
              color: COLORS.textDim,
            }}
          >
            Restart
          </button>
        </div>
      </div>

      {/* Canvas fills the rest of the pane */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: 24 }}>
        <AgentCanvas
          simulationRef={frameRef}
          selectedAgentId={null}
          hoveredAgentId={null}
          showStats={false}
          showHexGrid={true}
          showCostOverlay={false}
          zoomToFitTrigger={zoomToFitTrigger}
          pauseAutoFit={false}
          onAgentClick={noop}
          onAgentHover={noop}
          onAgentDrag={noop}
          onContextMenu={noop}
          onToolCallClick={noop}
          selectedToolCallId={null}
          onDiscoveryClick={noop}
          selectedDiscoveryId={null}
        />
      </div>
    </div>
  )
}
