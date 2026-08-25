import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const AI_WS_PATH = '/demo/api/ai/ws'

// WebSocket streaming for the AI chat: Node has no WebSocketPair, so we
// upgrade the socket ourselves (ws package) and hand it to
// toWebSocketStream. The handler is loaded through ssrLoadModule so it runs
// in the SAME module graph as the app routes — shared persistence, usage
// ledger and tool registry across SSE and WS.
const aiWebSocket = {
  name: 'studio-ai-websocket',
  apply: 'serve' as const,
  configureServer(server: any) {
    server.httpServer?.on('upgrade', async (req: any, socket: any, head: any) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname !== AI_WS_PATH) return
      try {
        const mod = await server.ssrLoadModule('/src/lib/studio-ws-server.ts')
        if (!mod.handleAiUpgrade(req, socket, head)) socket.destroy()
      } catch (error) {
        console.error('[ai-ws] upgrade failed:', error)
        socket.destroy()
      }
    })
  },
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact(), aiWebSocket],
})

export default config
