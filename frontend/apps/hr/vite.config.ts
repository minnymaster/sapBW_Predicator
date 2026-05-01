import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/v1/auth': { target: 'http://localhost:3002', changeOrigin: true },
      '/v1/questions': { target: 'http://localhost:3002', changeOrigin: true },
      '/v1/tests': { target: 'http://localhost:3002', changeOrigin: true },
      '/v1/assignments': { target: 'http://localhost:3002', changeOrigin: true },
      '/v1/employees': { target: 'http://localhost:3002', changeOrigin: true },
      '/v1/departments': { target: 'http://localhost:3002', changeOrigin: true },
      '/v1/competencies': { target: 'http://localhost:3001', changeOrigin: true },
      '/v1/courses': { target: 'http://localhost:3003', changeOrigin: true },
      '/v1/materials': { target: 'http://localhost:3003', changeOrigin: true },
      '/v1/upload': { target: 'http://localhost:3003', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3003', changeOrigin: true },
      '/v1/reports': { target: 'http://localhost:3004', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
