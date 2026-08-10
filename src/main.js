/**
 * main.js — Bootstrap
 * UltimateTradingCommandCenter'ı başlat (barva35.html referansı).
 */
import { UltimateTradingCommandCenter } from './app/App.js';
import { Logger } from './core/Logger.js';

// SW & Cache temizliği — eski sürümler çakışmasın (ai_studio_code.html referansı, BÖLÜM 3)
(async () => {
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      if (regs.length) console.log(`🧹 ${regs.length} eski ServiceWorker silindi`);
    } catch(e) {}
  }
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      if (keys.length) console.log(`🧹 ${keys.length} eski Cache silindi:`, keys);
    } catch(e) {}
  }
})();

console.log('%c🏛️ KOMUTA MERKEZİ JS YÜKLENDİ — Boot başlıyor...', 'color:#58a6ff; font-weight:700;');

async function boot() {
  console.log('Boot: DOM readyState', document.readyState, 'document.body', !!document.body);
  try {
    window.app = new UltimateTradingCommandCenter();
    console.log('Boot: App constructed, ui:', !!window.app.ui, 'chartManager:', !!window.app.chartManager);
    await window.app.init();
    console.log('Boot: App.init() tamamlandı, isRunning:', window.app.isRunning);
    // Debug: butonların bağlı olup olmadığını kontrol et
    const testIds = ['start-btn','stop-btn','header-main-bar','mobile-toggle-controls-btn','open-settings-modal-btn','panteon-toggle-btn'];
    for (const id of testIds) {
      const el = document.getElementById(id);
      console.log(`Boot check: #${id} ->`, el ? 'VAR' : 'YOK');
    }
  } catch (e) {
    Logger.error('Boot', 'Başlatma hatası:', e);
    console.error('Boot HATASI:', e);
    console.error(e.stack);
    const btn = document.getElementById('start-btn');
    if (btn) btn.disabled = false;
    // Hata olsa bile kullanıcıya göster
    const container = document.getElementById('notifications-container');
    if (container) {
      const errDiv = document.createElement('div');
      errDiv.className = 'notification danger';
      errDiv.textContent = 'Boot hatası: ' + (e.message || e);
      errDiv.style.cssText = 'background:rgba(220,53,69,0.9); color:white; padding:10px; margin:10px; border-radius:6px;';
      container.appendChild(errDiv);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Global hata yakalayıcı (genel JS sorunlarını teşhis için)
window.addEventListener('error', (e) => {
  console.error('Global JS Hatası:', e.message, e.filename, e.lineno, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled Promise:', e.reason);
});
