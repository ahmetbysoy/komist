/**
 * TtsService — Sesli anons (Web Speech API tr-TR) + kuyruk
 * Kaynak: barva35.html (speak + processSpeechQueue) — UTC v2.0 §18
 */
import { Logger } from '../core/Logger.js';

export class TtsService {
  constructor() {
    this.queue = [];
    this.isSpeaking = false;
    this.enabled = true;
    this.rate = 1.1;
    this.voice = null;
  }

  setEnabled(on) { this.enabled = on; }

  setVoice(voiceURI) {
    const voices = speechSynthesis?.getVoices?.() || [];
    this.voice = voices.find((v) => v.voiceURI === voiceURI) || null;
  }

  getVoices() {
    return speechSynthesis?.getVoices?.() || [];
  }

  speak(text) {
    if (!this.enabled || !text || typeof speechSynthesis === 'undefined') return;
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
      u.rate = this.rate;
      u.pitch = 1.0;
      if (this.voice) u.voice = this.voice;
      else {
        const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('tr'));
        if (v) u.voice = v;
      }
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
