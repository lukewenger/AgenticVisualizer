# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Agent Flow is a real-time visualization tool for Claude Code and Codex agent execution. It renders force-directed graphs of agent trees, tool calls, and message flows at 60fps. It ships as three entry points: a VS Code extension (webview panel), a standalone web app (`npx agent-flow-app`), and a development server.

## Commands

All commands use `pnpm` from the repo root.

```bash
# One-time setup (installs Claude Code hooks)
pnpm setup

# Development
pnpm run dev           # Next.js dev server + SSE relay (primary dev workflow)
pnpm run dev:demo      # Dev server with mock/demo data (no real agent needed)
pnpm run dev:relay     # Run the relay server standalone
pnpm run dev:extension # Watch-build the VS Code extension

# Production builds
pnpm run build:all     # Build webview + extension (full release build)
pnpm run build:web     # Build Next.js web app
pnpm run build:webview # Build VS Code webview assets (Vite IIFE bundle)
pnpm run build:app     # Build standalone CLI app
pnpm run build:extension # Build VS Code extension

# Tests
pnpm test                              # Run all tests (root)
cd extension && pnpm test              # Extension tests only
cd extension && pnpm run lint          # TypeScript type-check (no ESLint)
```

Tests use the Node.js native test runner (`node --test`) via `tsx`. There is no Jest or Vitest config. Run a single test file with:
```bash
npx tsx --test extension/test/codex-rollout-parser.test.ts
```

## Monorepo Layout

```
agent-flow-GUI/
├── app/            # Standalone CLI wrapper (npx agent-flow-app)
├── extension/      # VS Code extension host (Node.js, CommonJS)
├── scripts/        # Shared relay, telemetry, hook setup
└── web/            # Frontend (Next.js + React 19 + Tailwind 4)
```

`pnpm-workspace.yaml` declares `app` and `web` as workspaces. `extension` and `scripts` are not workspace packages — they are built directly with esbuild and `tsx`.

## Architecture

### Event Pipeline

```
Agent work
  → HookServer (HTTP POST) or SessionWatcher (JSONL file polling)
  → relay.ts (SSE broadcaster)
  → useVSCodeBridge (React hook)
  → useAgentSimulation (d3-force + event queue)
  → Canvas (60fps requestAnimationFrame loop)
```

**Claude Code** writes session transcripts to `~/.claude/projects/<workspace-hash>/<session-id>.jsonl`. The extension watches these files for new lines and also receives live events via an HTTP hook server that Claude Code calls on every tool use.

**Codex** writes rollouts to `~/.codex/sessions/<workspace>/<session-id>/rollout-*.jsonl` with line types `session_meta`, `turn_context`, `response_item`, `event_msg`, and `compacted`.

Both runtimes implement the `AgentRuntime` interface in `extension/src/session-runtime.ts` and can run in parallel (controlled by `agentVisualizer.runtime` VS Code setting or `AGENT_FLOW_RUNTIME` env var).

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
| `scripts/relay.ts` | Core relay: starts HookServer or CodexSessionWatcher, exposes `handleSSE()` |
| `extension/src/extension.ts` | VS Code `activate()` — wires runtimes to webview panel |
| `extension/src/transcript-parser.ts` | Parses Claude Code JSONL format into typed events |
| `extension/src/codex-rollout-parser.ts` | Parses Codex rollout JSONL format |
| `extension/src/protocol.ts` | Event type definitions shared between extension host and webview |
| `web/hooks/use-agent-simulation.ts` | d3-force simulation + event processing; the central state machine |
| `web/hooks/use-vscode-bridge.ts` | Connects to extension postMessage API or SSE relay |
| `web/components/agent-visualizer/index.tsx` | Top-level visualizer component |
| `web/components/agent-visualizer/canvas/` | Canvas draw modules (agents, edges, tool calls, particles) |
| `web/lib/agent-types.ts` | Core TypeScript types (AgentNode, ToolCall, SimEvent, etc.) |
| `app/src/server.ts` | HTTP server for standalone app (SSE + static files) |

### Build Targets

The frontend has **two Vite entry points** in addition to Next.js:
- `web/vite.config.webview.ts` — IIFE bundle for VS Code webview (`webview-entry.tsx`)
- `web/vite.config.app.ts` — ESM bundle for standalone app (`app-entry.tsx`)

The extension uses esbuild (not tsc) configured in `extension/esbuild.js`.

## Telemetry

Telemetry only runs in the published `npx agent-flow-app` binary — never in `pnpm run dev` or the VS Code extension. It collects only aggregate metadata (session count, model family, runtime choice, error class names) and is opt-out via `AGENT_FLOW_TELEMETRY=0`.

## Runtime Detection

The relay resolves which runtime(s) to start:
1. Check `AGENT_FLOW_RUNTIME` env var (`"claude"` / `"codex"` / `"auto"`)
2. Fall back to `"auto"` — starts both Claude and Codex watchers
