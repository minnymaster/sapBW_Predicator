import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Auth через Manage API (port 3002 в dev, Manage GW в prod)
      '/v1/auth': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      // Tests и Courses через Learning API (tests:3001, courses:3003 в dev)
      '/v1/tests': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/v1/attempts': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/v1/recommendations': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/v1/courses': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      // Employee-facing dashboard summary — будет добавлен в tests-api (UC-05)
      '/v1/dashboard': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/v1/competencies': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
