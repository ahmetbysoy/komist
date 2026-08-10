/**
 * ApiQueue — Binance rate limit için basit kuyruk (BÖLÜM 1: Gelişmiş API Limit Yönetimi)
 * Giden istekleri kuyruğa alır, 200ms arayla işler (5 req/s), 429'da bekler
 */
export class ApiQueue {
  constructor(delayMs = 200) {
    this.delayMs = delayMs;
    this.queue = [];
    this.running = false;
  }

  async enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      if (!this.running) this._process();
    });
  }

  async _process() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const { fn, resolve, reject } = this.queue.shift();
      try {
        const result = await fn();
        resolve(result);
      } catch (e) {
        // 429 ise biraz daha bekle
        if (e.message && e.message.includes('429')) {
          await new Promise(r => setTimeout(r, 2000));
        }
        reject(e);
      }
      if (this.queue.length) await new Promise(r => setTimeout(r, this.delayMs));
    }
    this.running = false;
  }
}

export default ApiQueue;
