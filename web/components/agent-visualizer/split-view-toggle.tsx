'use client'

import { COLORS } from '@/lib/colors'

export interface SplitViewToggleProps {
  active: boolean
  onToggle: () => void
}

/**
 * Dumb presentational toggle matching the ToggleButton visual style used in
 * top-bar.tsx. The actual viewMode state lives in index.tsx (integrated
 * separately) — this component only renders the button and forwards clicks.
 */
export function SplitViewToggle({ active, onToggle }: SplitViewToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="px-1.5 py-0.5 rounded transition-all font-mono text-[10px]"
      style={{
        background: active ? COLORS.toggleActive : COLORS.toggleInactive,
        border: `1px solid ${COLORS.toggleBorder}`,
        color: active ? COLORS.holoBright : COLORS.textMuted,
      }}
    >
      Split View
    </button>
  )
}
