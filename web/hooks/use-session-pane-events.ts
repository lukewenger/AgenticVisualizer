'use client'

import { useMemo, useRef, useCallback, useEffect } from 'react'
import type { useVSCodeBridge } from '@/hooks/use-vscode-bridge'
import { SimulationEvent } from '@/lib/agent-types'

/**
 * Per-pane equivalent of the bridge's single-session pendingEvents/consumeEvents
 * plumbing, generalized to an arbitrary session id.
 *
 * Each split-view pane calls this with its own assigned sessionId, sourcing
 * events from bridge.getSessionEvents() (a pure, non-mutating read of the full
 * buffered log for that session) and tracking its own consumed-index locally —
 * independent of whichever session is "selected" in the main view.
 */
export function useSessionPaneEvents(
  bridge: ReturnType<typeof useVSCodeBridge>,
  sessionId: string | null,
) {
  const consumedIndexRef = useRef(0)
  const lastSessionIdRef = useRef<string | null>(sessionId)

  // Reset the consumed index whenever the pane is reassigned to a different
  // session, so the new session replays from the start rather than some
  // stale index left over from the previous assignment.
  useEffect(() => {
    if (lastSessionIdRef.current !== sessionId) {
      lastSessionIdRef.current = sessionId
      consumedIndexRef.current = 0
    }
  }, [sessionId])

  const pendingEvents = useMemo((): SimulationEvent[] => {
    if (!sessionId) return []
    return bridge.getSessionEvents(sessionId).slice(consumedIndexRef.current)
    // eventVersion is bumped on every incoming event for any session — used
    // here purely as a re-check trigger, not read directly.
  }, [sessionId, bridge.eventVersion, bridge.getSessionEvents])

  const consumeEvents = useCallback(() => {
    if (!sessionId) return
    consumedIndexRef.current = bridge.getSessionEvents(sessionId).length
  }, [sessionId, bridge])

  return { pendingEvents, consumeEvents }
}
