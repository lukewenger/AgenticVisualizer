import { defineConfig } from 'vite'
import { createBuildConfig } from '../web/vite.config.shared'

// Builds web/app-entry.tsx (the same standalone React entry used by the
// `npx agent-flow-app` CLI bundle) into desktop/dist/renderer/, for the
// Electron main process to `loadFile`. Resolution in vite.config.shared.ts
// is relative to its own directory (web/), so outDir/entry paths below are
// given relative to web/ even though this config file lives in desktop/.
export default defineConfig(createBuildConfig({
  outDir: '../desktop/dist/renderer',
  entry: 'app-entry.tsx',
  name: 'AgentFlowDesktop',
  define: {
    'process.env.NEXT_PUBLIC_DEMO': '"0"',
    'process.env.NEXT_PUBLIC_RELAY_PORT': '""',
    'process.env.AGENT_FLOW_STANDALONE': '"1"',
  },
}))
