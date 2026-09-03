class Cache {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || parseInt(process.env.CACHE_TTL) || 5000;
    this.maxItems = options.maxItems || parseInt(process.env.CACHE_MAX_ITEMS) || 1000;
  }

  /**
   * Obtener valor del cache
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Verificar expiración
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Guardar en cache
   */
  set(key, value, ttl = this.ttl) {
    // Si el cache está lleno, eliminar el más viejo
    if (this.cache.size >= this.maxItems) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }

  /**
   * Eliminar del cache
   */
  del(key) {
    this.cache.delete(key);
  }

  /**
   * Eliminar del cache por coincidencia de patrón o prefijo
   */
  delPattern(pattern) {
    if (!pattern) return;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpiar todo el cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Obtener estadísticas del cache
   */
  getStats() {
    const now = Date.now();
    let active = 0;
    let expired = 0;

    for (const [key, item] of this.cache) {
      if (now > item.expires) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
      maxItems: this.maxItems
    };
  }

  /**
   * Limpiar cachés expirados
   */
  cleanExpired() {
    const now = Date.now();
    for (const [key, item] of this.cache) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton
module.exports = new Cache();