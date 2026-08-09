/**
 * main.js — Bootstrap
 * DOM hazır olunca terminali başlat; global'e aç (Capacitor/WebView uyumu).
 */
import { UltimateTerminal } from './app/App.js';
import { Logger } from './core/Logger.js';

async function boot() {
  try {
    window.app = new UltimateTerminal();
    await window.app.start();
  } catch (e) {
    Logger.error('Boot', 'Başlatma hatası:', e);
    const screen = document.getElementById('boot-screen');
    if (screen) {
      screen.innerHTML = `<h1 style="color:#ef4444">HATA</h1><pre style="color:#8b949e;font-size:11px;max-width:90%;overflow:auto">${e.message}</pre>`;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
