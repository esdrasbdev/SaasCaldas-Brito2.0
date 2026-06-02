/*
 * Cache Simples em Memória - TTL 5min (300000ms)
 * Uso: cache.get('usuarios'), cache.set('usuarios', data, 300000), cache.invalidate('usuarios')
 */

class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.cleanExpired = this.cleanExpired.bind(this);
    setInterval(this.cleanExpired, 60000); // Limpa expirados a cada 1min
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlMs = 300000) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs
    });
  }

  invalidate(key) {
    this.cache.delete(key);
  }

  cleanExpired() {
    const now = Date.now();
    for (const [key, item] of this.cache) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  clearAll() {
    this.cache.clear();
  }
}

module.exports = new SimpleCache();

