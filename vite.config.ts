import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { visualizer } from "rollup-plugin-visualizer"

export default defineConfig({
  plugins: [
    react(),
    process.env.ANALYZE &&
      visualizer({
        open: true,
        filename: "stats.html"
      })
  ].filter(Boolean),

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("firebase")) {
            return "firebase"
          }
        }
      }
    }
  }
})