import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy API calls to the gateway (docker compose exposes it on :8080).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': process.env.VITE_API_PROXY || 'http://localhost:8080' },
  },
});
