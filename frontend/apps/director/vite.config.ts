import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/v1/auth': { target: 'http://localhost:3002', changeOrigin: true },
      '/v1/kpi': { target: 'http://localhost:3002', changeOrigin: true },
      '/v1/departments': { target: 'http://localhost:3002', changeOrigin: true },
      '/v1/competencies': { target: 'http://localhost:3001', changeOrigin: true },
      '/v1/reports': { target: 'http://localhost:3004', changeOrigin: true },
      '/v1/dashboard': { target: 'http://localhost:3005', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
