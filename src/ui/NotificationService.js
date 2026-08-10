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
    el.innerHTML = `<span class="notif-icon">${cfg.icon}</span><span class="notif-text">${message}</span>`;
    this.container.appendChild(el);

    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 400);
    }, timeout);
  }

  success(msg) { this.show(msg, 'success'); }
  danger(msg) { this.show(msg, 'danger'); }
  warning(msg) { this.show(msg, 'warning'); }
}

export default NotificationService;
