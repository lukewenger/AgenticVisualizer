'use client'

import { SessionPane } from './session-pane'
import { COLORS } from '@/lib/colors'
import type { SessionInfo } from '@/lib/bridge-types'
import type { useVSCodeBridge } from '@/hooks/use-vscode-bridge'

export interface SplitViewProps {
  bridge: ReturnType<typeof useVSCodeBridge>
  sessions: SessionInfo[]
  /** Length 1-4 — which session id (if any) occupies each grid slot */
  slotSessionIds: (string | null)[]
  onSlotChange: (slotIndex: number, sessionId: string | null) => void
}

/**
 * Renders up to 4 sessions simultaneously in a grid layout.
 *
 * Layout choice: always use a fixed 2x2 grid (`grid-template-columns: 1fr 1fr;
 * grid-template-rows: 1fr 1fr`) regardless of slot count. Slots beyond
 * slotSessionIds.length simply aren't rendered, leaving empty grid cells for
 * 1-3 slots. This was chosen over a dynamic layout (e.g. 1 slot = full size,
 * 2 = side-by-side) because it's far less code — no conditional grid-template
 * logic — and the "wasted" empty cells are an acceptable tradeoff for a dev
 * tool where panes are typically reassigned anyway.
 */
export function SplitView({ bridge, sessions, slotSessionIds, onSlotChange }: SplitViewProps) {
  return (
    <div
      className="absolute left-0 right-0 bottom-0"
      style={{
        // top: 48 clears the global TopBar (see message-feed-panel.tsx for the
        // same offset) — without it, the grid's top row sits underneath the
        // TopBar and the two sets of controls render on top of each other.
        top: 48,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 2,
        background: COLORS.void,
      }}
    >
      {slotSessionIds.map((sessionId, index) => {
        const session = sessionId ? sessions.find(s => s.id === sessionId) : undefined
        return (
          <div
            key={index}
            style={{
              position: 'relative',
              overflow: 'hidden',
              background: COLORS.void,
              border: `1px solid ${COLORS.holoBorder06}`,
            }}
          >
            {sessionId && session ? (
              <SessionPane
                bridge={bridge}
                sessionId={sessionId}
                sessions={sessions}
                onSelectSession={(id) => onSlotChange(index, id)}
              />
            ) : (
              <>
                {/* Slot session selector — only shown for an empty slot, since
                    an assigned slot's SessionPane renders its own selector
                    inline in its header instead. */}
                <select
                  value=""
                  onChange={(e) => onSlotChange(index, e.target.value || null)}
                  className="absolute top-0 left-0 font-mono text-[10px] px-1 py-0.5"
                  style={{
                    zIndex: 10,
                    background: COLORS.panelBg,
                    color: COLORS.textDim,
                    border: `1px solid ${COLORS.holoBorder08}`,
                    maxWidth: '100%',
                  }}
                >
                  <option value="">Select a session</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <div
                  className="absolute inset-0 flex items-center justify-center font-mono text-xs"
                  style={{ color: COLORS.textMuted }}
                >
                  Select a session
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
