import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        // three.js is ~600 kB of the bundle; splitting it lets the browser
        // cache it separately from app code.
        manualChunks: { three: ['three'], react: ['react', 'react-dom'] },
      },
    },
  },
  server: { port: 3000, host: '0.0.0.0' },
});
