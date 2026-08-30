import { EventEmitter } from 'node:events';

/**
 * Parses TTL (in seconds or string format like '5m', '1h', '30s') into milliseconds.
 * @param {number|string|undefined} ttl
 * @returns {number|null} TTL in milliseconds, 0 for infinite, or null if invalid/undefined
 */
function parseTtlToMs(ttl) {
  if (ttl === undefined || ttl === null) return null;
  if (typeof ttl === 'number') {
    if (ttl <= 0) return ttl;
    return ttl * 1000;
  }
  if (typeof ttl === 'string') {
    const trimmed = ttl.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      return num <= 0 ? num : num * 1000;
    }
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?$/i);
    if (!match) return null;
    const value = parseFloat(match[1]);
    const unit = (match[2] || 's').toLowerCase();
    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'w':
        return value * 7 * 24 * 60 * 60 * 1000;
      default:
        return value * 1000;
    }
  }
  return null;
}

function cloneValue(val) {
  if (val === null || typeof val !== 'object') return val;
  try {
    return structuredClone(val);
  } catch {
    return val;
  }
}

export class Cache extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {number|string} [options.stdTTL=0] Default TTL in seconds (0 = unlimited).
   * @param {number} [options.checkperiod=600] Interval in seconds to check for expired items (0 = disabled).
   * @param {boolean} [options.useClones=false] Whether to clone values on get/set.
   * @param {boolean} [options.deleteOnExpire=true] Whether to delete expired items on access or interval check.
   * @param {number} [options.maxKeys=-1] Maximum keys allowed (-1 = unlimited).
   */
  constructor(options = {}) {
    super();
    this.options = {
      stdTTL: options.stdTTL ?? 0,
      checkperiod: options.checkperiod ?? 600,
      useClones: options.useClones ?? false,
      deleteOnExpire: options.deleteOnExpire ?? true,
      maxKeys: options.maxKeys ?? -1,
    };

    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this.store = new Map();

    this._stats = {
      hits: 0,
      misses: 0,
      keys: 0,
      ksize: 0,
      vsize: 0,
    };

    this._intervalId = null;
    if (this.options.checkperiod > 0) {
      this.startInterval();
    }
  }

  get useClones() {
    return this.options.useClones;
  }

  set useClones(val) {
    this.options.useClones = Boolean(val);
  }

  get stdTTL() {
    return this.options.stdTTL;
  }

  set stdTTL(val) {
    this.options.stdTTL = val;
  }

  startInterval() {
    this.stopInterval();
    if (this.options.checkperiod > 0) {
      this._intervalId = setInterval(() => {
        this.checkExpired();
      }, this.options.checkperiod * 1000);
      if (this._intervalId?.unref) {
        this._intervalId.unref();
      }
    }
  }

  stopInterval() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  checkExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt > 0 && entry.expiresAt <= now) {
        if (this.options.deleteOnExpire) {
          this.store.delete(key);
          this._stats.keys = this.store.size;
          this.emit('expired', key, entry.value);
        }
      }
    }
  }

  /**
   * Compute expiration timestamp for a given TTL.
   * @private
   */
  _computeExpiresAt(ttl) {
    let ttlMs = parseTtlToMs(ttl);
    if (ttlMs === null) {
      ttlMs = parseTtlToMs(this.options.stdTTL) ?? 0;
    }

    if (ttlMs < 0) {
      return 1;
    }
    if (ttlMs === 0) {
      return 0;
    }
    return Date.now() + ttlMs;
  }

  /**
   * Checks if an entry is expired.
   * @private
   */
  _isExpired(entry) {
    return entry.expiresAt > 0 && entry.expiresAt <= Date.now();
  }

  /**
   * Set a key/value pair with optional TTL.
   * @param {string|number} key
   * @param {any} value
   * @param {number|string} [ttl]
   * @returns {boolean}
   */
  set(key, value, ttl) {
    const stringKey = String(key);

    if (
      this.options.maxKeys > 0 &&
      !this.store.has(stringKey) &&
      this.store.size >= this.options.maxKeys
    ) {
      return false;
    }

    const expiresAt = this._computeExpiresAt(ttl);
    const storedValue = this.options.useClones ? cloneValue(value) : value;

    this.store.set(stringKey, {
      value: storedValue,
      expiresAt,
    });

    this._stats.keys = this.store.size;
    this.emit('set', stringKey, storedValue);
    return true;
  }

  /**
   * Set multiple key/value pairs.
   * @param {Array<{ key: string|number, val?: any, value?: any, ttl?: number|string }>} list
   * @returns {boolean}
   */
  mset(list) {
    if (!Array.isArray(list)) return false;
    for (const item of list) {
      const val = item.value !== undefined ? item.value : item.val;
      this.set(item.key, val, item.ttl);
    }
    return true;
  }

  /**
   * Get a cached value by key.
   * @param {string|number} key
   * @returns {any|undefined}
   */
  get(key) {
    const stringKey = String(key);
    const entry = this.store.get(stringKey);

    if (!entry) {
      this._stats.misses++;
      return undefined;
    }

    if (this._isExpired(entry)) {
      if (this.options.deleteOnExpire) {
        this.store.delete(stringKey);
        this._stats.keys = this.store.size;
        this.emit('expired', stringKey, entry.value);
      }
      this._stats.misses++;
      return undefined;
    }

    this._stats.hits++;
    return this.options.useClones ? cloneValue(entry.value) : entry.value;
  }

  /**
   * Get multiple cached values.
   * @param {Array<string|number>} keys
   * @returns {Record<string, any>}
   */
  mget(keys) {
    if (!Array.isArray(keys)) return {};
    const result = {};
    for (const key of keys) {
      const val = this.get(key);
      if (val !== undefined) {
        result[String(key)] = val;
      }
    }
    return result;
  }

  /**
   * Check if a key exists and is not expired.
   * @param {string|number} key
   * @returns {boolean}
   */
  has(key) {
    const stringKey = String(key);
    const entry = this.store.get(stringKey);
    if (!entry) return false;

    if (this._isExpired(entry)) {
      if (this.options.deleteOnExpire) {
        this.store.delete(stringKey);
        this._stats.keys = this.store.size;
        this.emit('expired', stringKey, entry.value);
      }
      return false;
    }

    return true;
  }

  /**
   * Delete one or multiple keys.
   * @param {string|number|Array<string|number>} key
   * @returns {number} Count of deleted keys
   */
  del(key) {
    let count = 0;
    if (Array.isArray(key)) {
      for (const k of key) {
        const stringKey = String(k);
        if (this.store.delete(stringKey)) {
          count++;
          this.emit('del', stringKey);
        }
      }
    } else {
      const stringKey = String(key);
      if (this.store.delete(stringKey)) {
        count++;
        this.emit('del', stringKey);
      }
    }
    this._stats.keys = this.store.size;
    return count;
  }

  /**
   * Delete multiple keys.
   * @param {Array<string|number>} keys
   * @returns {number}
   */
  mdel(keys) {
    return this.del(keys);
  }

  /**
   * Get value and delete key from cache in one atomic operation.
   * @param {string|number} key
   * @returns {any|undefined}
   */
  take(key) {
    const val = this.get(key);
    if (val !== undefined) {
      this.del(key);
    }
    return val;
  }

  /**
   * Get expiration timestamp in ms of a key, or 0 if unlimited, or undefined if not found.
   * @param {string|number} key
   * @returns {number|undefined}
   */
  getTtl(key) {
    const stringKey = String(key);
    const entry = this.store.get(stringKey);
    if (!entry) return undefined;
    if (this._isExpired(entry)) {
      if (this.options.deleteOnExpire) {
        this.store.delete(stringKey);
        this._stats.keys = this.store.size;
        this.emit('expired', stringKey, entry.value);
      }
      return undefined;
    }
    return entry.expiresAt;
  }

  /**
   * Update TTL of an existing key.
   * @param {string|number} key
   * @param {number|string} [ttl]
   * @returns {boolean}
   */
  ttl(key, ttl) {
    const stringKey = String(key);
    const entry = this.store.get(stringKey);
    if (!entry || this._isExpired(entry)) {
      return false;
    }
    entry.expiresAt = this._computeExpiresAt(ttl);
    return true;
  }

  /**
   * Returns array of all active (non-expired) keys.
   * @returns {string[]}
   */
  keys() {
    const validKeys = [];
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt > 0 && entry.expiresAt <= now) {
        if (this.options.deleteOnExpire) {
          this.store.delete(key);
          this.emit('expired', key, entry.value);
        }
      } else {
        validKeys.push(key);
      }
    }
    this._stats.keys = this.store.size;
    return validKeys;
  }

  flushAll() {
    this.store.clear();
    this._stats.keys = 0;
    this.emit('flush');
  }

  clear() {
    this.flushAll();
  }

  /**
   * Get cache statistics.
   * @returns {{ keys: number, hits: number, misses: number, ksize: number, vsize: number }}
   */
  getStats() {
    return {
      ...this._stats,
      keys: this.store.size,
    };
  }

  flushStats() {
    this._stats.hits = 0;
    this._stats.misses = 0;
    this._stats.ksize = 0;
    this._stats.vsize = 0;
    this._stats.keys = this.store.size;
  }

  close() {
    this.stopInterval();
  }

  disconnect() {
    this.close();
  }
}

export { Cache as NodeCache };
export default Cache;
