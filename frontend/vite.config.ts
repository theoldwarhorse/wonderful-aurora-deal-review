import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // For frontend work with hot reload: `docker compose up`, then `npm run dev` here.
  server: { proxy: { '/api': 'http://localhost:8080', '/mcp': 'http://localhost:8080' } },
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts' },
  // The PDF viewer (pdf.js) makes the bundle about 900 kB, which is expected. Warn only beyond that.
  build: { chunkSizeWarningLimit: 1000 },
});
