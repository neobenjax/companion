import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // Ensures relative paths work when pywebview loads dist/index.html directly
  server: {
    port: 5173,
    strictPort: true,
  },
});
