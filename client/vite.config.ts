import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for the payroll SPA.
// - dev: proxy /api -> NestJS on :3000 so the browser hits same-origin paths.
// - prod: build to client/dist, served same-origin by NestJS ServeStaticModule.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
