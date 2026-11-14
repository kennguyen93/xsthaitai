import Redis from 'ioredis';

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

class CacheService {
  private redis: Redis | null = null;
  private memory = new Map<string, MemoryEntry>();
  private redisConnected = false;
  private hits = 0;
  private misses = 0;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl && redisUrl.trim().length > 0) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          enableOfflineQueue: false,
        });
        this.redis.on('connect', () => {
          this.redisConnected = true;
        });
        this.redis.on('error', (err) => {
          this.redisConnected = false;
          console.warn('Redis unavailable, using in-memory TTL cache:', err.message);
        });
        this.redis.connect().catch(() => {
          this.redisConnected = false;
        });
      } catch {
        this.redis = null;
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis && this.redisConnected) {
      try {
        const raw = await this.redis.get(key);
        if (raw !== null) {
          this.hits++;
          return JSON.parse(raw) as T;
        }
        this.misses++;
        return null;
      } catch {
        // Fall through to memory cache
      }
    }

    const entry = this.memory.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.memory.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return JSON.parse(entry.value) as T;
  }

  async set(key: string, data: unknown, ttlSeconds = 120): Promise<void> {
    const serialized = JSON.stringify(data);
    if (this.redis && this.redisConnected) {
      try {
        await this.redis.set(key, serialized, 'EX', ttlSeconds);
        return;
      } catch {
        // Fall through to memory cache
      }
    }

    if (this.memory.size > 1500) {
      const oldestKey = this.memory.keys().next().value;
      if (oldestKey) this.memory.delete(oldestKey);
    }
    this.memory.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    if (this.redis && this.redisConnected) {
      try {
        const keys = await this.redis.keys(`${prefix}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch {
        // Ignore
      }
    }
    for (const k of this.memory.keys()) {
      if (k.startsWith(prefix)) {
        this.memory.delete(k);
      }
    }
  }

  getStats() {
    return {
      backend: this.redisConnected ? 'redis' : 'memory-ttl',
      keysCount: this.memory.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

export const cacheService = new CacheService();
