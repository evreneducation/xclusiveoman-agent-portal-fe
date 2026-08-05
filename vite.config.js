import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // shadcn/ui's standard "@/components/..." import convention.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Backend runs on VITE_API_PROXY_TARGET (default http://localhost:4000).
      // Proxying keeps the app same-origin in dev so the httpOnly refresh
      // cookie works without extra CORS/SameSite configuration.
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
