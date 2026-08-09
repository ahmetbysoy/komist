/**
 * TtsService — Sesli anons (Web Speech tr-TR) + kuyruk
 * Kaynak: UTC v2.0 §18
 */
import { CONFIG } from '../core/Config.js';
import { Logger } from '../core/Logger.js';

export class TtsService {
  constructor() {
    this.queue = [];
    this.isSpeaking = false;
    this.enabled = CONFIG.voiceAnnounce;
  }

  setEnabled(on) {
    this.enabled = on;
  }

  speak(text) {
    if (!this.enabled || typeof speechSynthesis === 'undefined') return;
    this.queue.push(text);
    if (!this.isSpeaking) this._processQueue();
  }

  _processQueue() {
    if (!this.queue.length) { this.isSpeaking = false; return; }
    this.isSpeaking = true;
    const text = this.queue.shift();
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'tr-TR';
      u.rate = 1.1;
      u.pitch = 1.0;
      const voices = speechSynthesis.getVoices?.();
      const v = voices?.find((x) => x.lang.startsWith('tr'));
      if (v) u.voice = v;
      u.onend = () => this._processQueue();
      u.onerror = () => this._processQueue();
      speechSynthesis.speak(u);
    } catch (e) {
      Logger.warn('TTS', 'konuşma hatası:', e);
      this._processQueue();
    }
  }

  cancel() {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    this.queue = [];
    this.isSpeaking = false;
  }
}

export default TtsService;
