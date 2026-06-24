# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Agent Flow is a real-time visualization tool for Claude Code and Codex agent execution. It renders force-directed graphs of agent trees, tool calls, and message flows at 60fps. It ships as a native Electron desktop app, alongside a browser-based dev server used for iterating on the visualizer UI.

## Commands

All commands use `pnpm` from the repo root.

```bash
# One-time setup (installs Claude Code hooks)
pnpm setup

# Development
pnpm run dev           # Next.js dev server + SSE relay (browser-based UI dev loop)
pnpm run dev:demo      # Dev server with mock/demo data (no real agent needed)
pnpm run dev:relay     # Run the relay server standalone
pnpm run dev:desktop   # Run the Electron desktop app against source

# Production builds
pnpm run build:desktop # Build + package the desktop app (main, renderer, installer)
pnpm run build:web     # Build Next.js web app

# Tests
pnpm test              # Run all tests (root)
```

Tests use the Node.js native test runner (`node --test`) via `tsx`. There is no Jest or Vitest config. Run a single test file with:
```bash
npx tsx --test core/test/codex-rollout-parser.test.ts
```

## Monorepo Layout

```
agent-flow-GUI/
├── core/           # Shared session-watching backend (Node, no UI deps)
├── desktop/        # Electron desktop app (main process + packaging)
├── scripts/        # Shared relay, telemetry, hook setup
└── web/            # Frontend (Next.js + React 19 + Tailwind 4); also the Electron renderer
```

`pnpm-workspace.yaml` declares `web` and `desktop` as workspaces. `core` and `scripts` are not workspace packages — they are built directly with esbuild and `tsx`, and bundled into both the dev relay and the desktop app's main process.

## Architecture

### Event Pipeline

```
Agent work
  → HookServer (HTTP POST) or SessionWatcher (JSONL file polling)
  → relay.ts (SSE broadcaster, or direct IPC inside Electron)
  → useVSCodeBridge (React hook; despite the name, also handles the Electron/SSE paths)
  → useAgentSimulation (d3-force + event queue)
  → Canvas (60fps requestAnimationFrame loop)
```

**Claude Code** writes session transcripts to `~/.claude/projects/<workspace-hash>/<session-id>.jsonl`. `core/session-watcher.ts` watches these files for new lines and also receives live events via an HTTP hook server (`core/hook-server.ts`) that Claude Code calls on every tool use.

**Codex** writes rollouts to `~/.codex/sessions/<workspace>/<session-id>/rollout-*.jsonl` with line types `session_meta`, `turn_context`, `response_item`, `event_msg`, and `compacted`. `core/codex-session-watcher.ts` tails these.

`core/` code is written against a minimal `vscode`-shaped interface (`scripts/vscode-shim.js` provides `EventEmitter`/`workspace`/`window` stand-ins) so the same watcher implementations run unmodified inside the Electron main process and the standalone dev relay — there is no actual VS Code dependency left in this repo.

### Frontend Rendering

The canvas rendering is deliberately decoupled from React state:

- **`frameRef`** — updated every animation frame (60fps); the canvas reads this directly
- **React state** — updated only on structural data changes, throttled to ~4 updates/sec
- **d3-force** — drives agent node positions; nodes repel each other and attract via edge links; users can drag to pin/unpin nodes

This pattern prevents React re-renders from stalling the physics animation.

### Session Tab Switching

Each session's visual state (agents, tool calls, particles, camera) is snapshotted and cached on tab switch. Switching tabs saves the outgoing session, restores the incoming snapshot, and replays any buffered events synchronously before the next animation frame.

### Key Files

| File | Purpose |
|---|---|
| `scripts/relay.ts` | Core relay: starts HookServer or CodexSessionWatcher, exposes `handleSSE()`; used by the dev relay and bundled directly into the desktop main process |
| `desktop/src/main.ts` | Electron main process — starts the relay in-process and forwards events to the renderer over IPC |
| `core/transcript-parser.ts` | Parses Claude Code JSONL format into typed events |
| `core/codex-rollout-parser.ts` | Parses Codex rollout JSONL format |
| `core/protocol.ts` | Event type definitions shared across the relay, hook server, and watchers |
| `web/hooks/use-agent-simulation.ts` | d3-force simulation + event processing; the central state machine |
| `web/hooks/use-vscode-bridge.ts` | Connects to the SSE relay (browser dev) or the Electron IPC bridge (desktop) |
| `web/lib/vscode-bridge.ts` | Unifies the Electron `window.electronBridge` and `window.postMessage`/SSE delivery paths behind one API |
| `web/components/agent-visualizer/index.tsx` | Top-level visualizer component |
| `web/components/agent-visualizer/canvas/` | Canvas draw modules (agents, edges, tool calls, particles) |
| `web/lib/agent-types.ts` | Core TypeScript types (AgentNode, ToolCall, SimEvent, etc.) |

### Build Targets

The frontend has Next.js (browser dev) plus one Vite entry point for the Electron renderer:
- `desktop/vite.renderer.config.ts` — bundles `web/app-entry.tsx` into `desktop/dist/renderer/`, loaded by the Electron main process via `loadFile`

`desktop/scripts/build.js` bundles the Electron main + preload processes with esbuild, aliasing the `vscode` module to `scripts/vscode-shim.js` so the bundled `core/` watcher code runs outside any real VS Code host.

## Runtime Detection

The relay resolves which runtime(s) to start:
1. Check `AGENT_FLOW_RUNTIME` env var (`"claude"` / `"codex"` / `"auto"`)
2. Fall back to `"auto"` — starts both Claude and Codex watchers
