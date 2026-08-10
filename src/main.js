/**
 * main.js — Bootstrap
 * UltimateTradingCommandCenter'ı başlat (barva35.html referansı).
 */
import { UltimateTradingCommandCenter } from './app/App.js';
import { Logger } from './core/Logger.js';

async function boot() {
  try {
    window.app = new UltimateTradingCommandCenter();
    await window.app.init();
  } catch (e) {
    Logger.error('Boot', 'Başlatma hatası:', e);
    console.error(e);
    const btn = document.getElementById('start-btn');
    if (btn) btn.disabled = false;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
