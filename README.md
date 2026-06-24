# AgenticVisualizer

Real-time visualization of Claude Code and Codex agent orchestration. Watch your agents think, branch, and coordinate as they work.

![AgenticVisualizer screenshot](https://res.cloudinary.com/dxlvclh9c/image/upload/v1773924941/screenshot_e7yox3.png)

> AgenticVisualizer is a fork of [Agent Flow](https://github.com/patoles/agent-flow) by Simon Patole / [CraftMyGame](https://craftmygame.com), repackaged as a standalone desktop app.

Claude Code is powerful, but its execution is a black box — you see the final result, not the journey. AgenticVisualizer makes the invisible visible:

- **Understand agent behavior** — See how Claude breaks down problems, which tools it reaches for, and how subagents coordinate
- **Debug tool call chains** — When something goes wrong, trace the exact sequence of decisions and tool calls that led there
- **See where time is spent** — Identify slow tool calls, unnecessary branching, or redundant work at a glance
- **Learn by watching** — Build intuition for how to write better prompts by observing how Claude interprets and executes them

## Features

- **Live agent visualization**: Watch agent execution as an interactive node graph with real-time tool calls, branching, and return flows
- **Claude Code + Codex**: Auto-detects sessions from both runtimes concurrently and shows them side-by-side, or restrict to one via `AGENTICVISUALIZER_RUNTIME`
- **Claude Code hooks**: Lightweight HTTP hook server receives events directly from Claude Code for zero-latency streaming
- **Codex rollout tailing**: Reads `~/.codex/sessions/**/rollout-*.jsonl` (respects `CODEX_HOME`) and surfaces tool calls, reasoning, and authoritative token counts from Codex's own event stream
- **Multi-session support**: Track multiple concurrent agent sessions with tabs
- **Interactive canvas**: Pan, zoom, click agents and tool calls to inspect details
- **Timeline & transcript panels**: Review the full execution timeline, file attention heatmap, and message transcript
- **JSONL log file support**: Point at any JSONL event log to replay or watch agent activity

## Getting Started

### Desktop App

Download the latest installer for your platform from [Releases](https://github.com/lukewenger/AgenticVisualizer/releases). Launch it, then start a Claude Code or Codex session — AgenticVisualizer auto-detects it and configures Claude Code hooks on first run.

### From source

```bash
git clone https://github.com/lukewenger/AgenticVisualizer.git
cd AgenticVisualizer
pnpm i
pnpm run setup      # configure Claude Code hooks (one-time)
pnpm run dev:desktop
```

### Runtime selection

By default AgenticVisualizer watches both Claude Code (`~/.claude/projects/`) and Codex (`~/.codex/sessions/`) concurrently. Sessions are shown side-by-side and tagged by runtime. If you only use one, the other is a harmless no-op — no visible effect, no user action needed.

To restrict to one runtime, set the `AGENTICVISUALIZER_RUNTIME` environment variable to `claude` or `codex` (defaults to watching both).

For non-default Codex installs, set the `CODEX_HOME` environment variable.

## Requirements

- [Node.js](https://nodejs.org/) 20+ (LTS recommended)
- [pnpm](https://pnpm.io/)
- Claude Code CLI

## Development

```bash
pnpm i              # install dependencies for all packages
pnpm run setup      # configure Claude Code hooks (one-time)
pnpm run dev        # start the Next.js web dev server + event relay (browser-based dev loop)
pnpm run dev:desktop # run the Electron desktop app against source
```

`pnpm run dev` starts both the Next.js dev server and an event relay that receives Claude Code events and streams them to the browser via SSE — useful for iterating on the visualizer UI without rebuilding the desktop app each time.

Other scripts:

| Script | Description |
|--------|-------------|
| `pnpm run dev:demo` | Start the web dev server with demo/mock data |
| `pnpm run dev:relay` | Run the event relay server standalone |
| `pnpm run build:desktop` | Build and package the desktop app |
| `pnpm run build:web` | Build the Next.js web app |

## Privacy & Telemetry

AgenticVisualizer emits no telemetry.

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.

This project is a fork of [Agent Flow](https://github.com/patoles/agent-flow). The name "Agent Flow" and associated logos remain trademarks of Simon Patole and are not used here — see [TRADEMARK.md](TRADEMARK.md).


## Installation Guide for dummies on Windows

Preqisition: node.js
 
For installing this repo, run <code> pnpm run build:desktop </code> from root.
under desktop/dist-packages is the installation exe and the compiled program itsself.