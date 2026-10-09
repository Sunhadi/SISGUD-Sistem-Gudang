import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Opsional: proxy API saat development (alternatif CORS)
      // '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
