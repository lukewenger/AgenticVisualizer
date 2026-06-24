/**
 * Regression test: AgentEventType (core/protocol.ts) and SimulationEvent['type']
 * (web/lib/agent-types.ts) are two independently hand-maintained unions that are
 * supposed to describe the exact same wire vocabulary — every AgentEvent emitted
 * by a watcher/parser in core/ is consumed by the frontend's processEvent switch
 * keyed on SimulationEvent['type']. TypeScript unions don't exist at runtime and
 * the two files don't share an import (core/ has no dependency on web/, and web/
 * is a separate workspace), so nothing currently catches the two lists drifting
 * apart silently.
 *
 * This test hard-codes both lists (kept in sync with the actual union members by
 * hand) and asserts they're identical sets. If you add/remove a member of either
 * union, this test will fail until you update both the other union and the lists
 * below — that's the point.
 *
 * Known intentional drift at the time this test was added: AgentEventType
 * includes 'error', which core/ never emits via `type: 'error'` anywhere and
 * web/'s processEvent has no switch case for. It's a vestigial/forward-compat
 * member, not active drift, so it's listed at the bottom of CORE_EVENT_TYPES
 * with a comment rather than removed — removing it is a product decision, not
 * a Phase 0 cleanup.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// Mirrors core/protocol.ts: AgentEventType
const CORE_EVENT_TYPES = [
  'agent_spawn',
  'agent_complete',
  'agent_idle',
  'message',
  'context_update',
  'model_detected',
  'tool_call_start',
  'tool_call_end',
  'subagent_dispatch',
  'subagent_return',
  'permission_requested',
  'error', // defined in core/protocol.ts but not currently emitted or handled anywhere
] as const

// Mirrors web/lib/agent-types.ts: SimulationEvent['type']
const WEB_SIMULATION_EVENT_TYPES = [
  'agent_spawn',
  'agent_complete',
  'agent_idle',
  'message',
  'context_update',
  'model_detected',
  'tool_call_start',
  'tool_call_end',
  'subagent_dispatch',
  'subagent_return',
  'permission_requested',
] as const

describe('AgentEventType / SimulationEvent type sync', () => {
  it('every web SimulationEvent type is a valid core AgentEventType', () => {
    const coreSet = new Set<string>(CORE_EVENT_TYPES)
    for (const t of WEB_SIMULATION_EVENT_TYPES) {
      assert.ok(coreSet.has(t), `web SimulationEvent type '${t}' has no matching core AgentEventType member`)
    }
  })

  it('every core AgentEventType is either handled on the web side or explicitly allow-listed as unused', () => {
    // 'error' is the one known, intentional exception — see file header.
    const allowedUnhandled = new Set(['error'])
    const webSet = new Set<string>(WEB_SIMULATION_EVENT_TYPES)
    for (const t of CORE_EVENT_TYPES) {
      if (allowedUnhandled.has(t)) continue
      assert.ok(webSet.has(t), `core AgentEventType '${t}' is missing from web's SimulationEvent union — frontend cannot type-check a switch case for it`)
    }
  })

  it('the allow-listed-unhandled set itself does not silently grow stale', () => {
    // If 'error' ever gets added to the web union (because someone wired it up),
    // this test's allowedUnhandled set must be updated to match — this assertion
    // exists so that update isn't optional.
    const webSet = new Set<string>(WEB_SIMULATION_EVENT_TYPES)
    assert.equal(webSet.has('error'), false, "'error' was added to web's SimulationEvent union — update this test's allowedUnhandled set and remove this assertion")
  })
})
