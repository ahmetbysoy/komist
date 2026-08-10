/**
 * NotificationService — Bildirim sistemi (barva35 showNotification)
 * `notifications-container` içine slide-in kartlar ekler, otomatik kapanır.
 */
import { Logger } from '../core/Logger.js';

const TYPES = {
  success: { color: '#28a745', icon: '✅' },
  danger: { color: '#dc3545', icon: '🚨' },
  warning: { color: '#ffc107', icon: '⚠️' },
  info: { color: '#58a6ff', icon: 'ℹ️' }
};

export class NotificationService {
  constructor(containerId = 'notifications-container') {
    this.container = document.getElementById(containerId);
  }

  show(message, type = 'info', timeout = 6000) {
    if (!this.container) { Logger.info('Notify', message); return; }
    const cfg = TYPES[type] || TYPES.info;
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.style.borderLeftColor = cfg.color;
    el.style.backdropFilter = 'blur(12px)';
    el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
    el.innerHTML = `<span class="notif-icon" style="font-size:14px;">${cfg.icon}</span><span class="notif-text" style="font-weight:500;">${message}</span>`;
    this.container.appendChild(el);
    // Haptic feedback (BÖLÜM 3: Genel Kullanım Kolaylığı)
    try {
      if (navigator.vibrate) {
        if (type === 'success') navigator.vibrate(30);
        else if (type === 'danger') navigator.vibrate([30,50,30]);
        else if (type === 'warning') navigator.vibrate(50);
      }
    } catch(_){}
    // Görsel geri bildirim animasyonu
    el.animate([{ transform: 'translateX(-100%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });

    setTimeout(() => {
      el.classList.add('fade-out');
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400 }).onfinish = () => el.remove();
      setTimeout(() => { try{ el.remove(); }catch(_){} }, 450);
    }, timeout);
  }

  success(msg) { this.show(msg, 'success'); }
  danger(msg) { this.show(msg, 'danger'); }
  warning(msg) { this.show(msg, 'warning'); }
  info(msg) { this.show(msg, 'info'); }
}

export default NotificationService;
