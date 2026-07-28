import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the large vendor libraries into their own cacheable chunks
        // instead of one monolithic bundle. The pdf libs (jspdf/html2canvas)
        // are only used on /results, so keeping them separate means they're
        // fetched only when that route (lazy-loaded) is visited.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "framer-motion": ["framer-motion"],
          "gsap": ["gsap"],
          "pdf": ["jspdf", "html2canvas"],
        },
      },
    },
  },
})
