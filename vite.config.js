import { defineConfig } from 'vite';
import { resolve } from 'path';

// Capacitor WebView: relative base + dist çıktısı
export default defineConfig({
  base: './',
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
      output: {
        // Tek bundle — mobil WebView performansı için
        manualChunks: undefined
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Preview/WebView hostlarının erişimine izin ver
    allowedHosts: true
  }
});
