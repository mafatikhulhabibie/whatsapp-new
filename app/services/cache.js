import env from '#start/env';
import consola from 'consola';
import { Redis as RedisType } from 'ioredis';
import { LRUCache } from 'lru-cache';
const cacheDriver = env.get('CACHE_DRIVER', 'lru');
let activeCacheInstance;
if (cacheDriver === 'redis') {
    const redisInstance = new RedisType({
        port: Number.parseInt(env.get('REDIS_PORT') || '6379'),
        host: env.get('REDIS_HOST'),
        password: env.get('REDIS_PASSWORD'),
    });
    class RedisCache {
        async has(key) {
            const result = await redisInstance.exists(key);
            return result === 1;
        }
        async get(key) {
            return redisInstance.get(key);
        }
        async set(key, value, ttlSeconds) {
            await redisInstance.setex(key, ttlSeconds, value);
        }
        async delete(key) {
            await redisInstance.del(key);
        }
    }
    activeCacheInstance = new RedisCache();
    consola.info('[CACHE] Using Redis cache driver');
}
else {
    const lruCacheInstance = new LRUCache({
        max: 1000,
        ttl: 1000 * 60 * 60 * 2,
        allowStale: false,
    });
    class LruCache {
        has(key) {
            return lruCacheInstance.has(key);
        }
        get(key) {
            return lruCacheInstance.get(key);
        }
        set(key, value, ttlSeconds) {
            lruCacheInstance.set(key, value, { ttl: ttlSeconds * 1000 });
        }
        delete(key) {
            lruCacheInstance.delete(key);
        }
    }
    activeCacheInstance = new LruCache();
    consola.info('[CACHE] Using LRU cache driver');
}
class CacheService {
    async get(key) {
        const result = activeCacheInstance.get(key);
        return result instanceof Promise ? await result : result;
    }
    async set(key, value, ttlSeconds = 3600) {
        const stringValue = typeof value !== 'string' ? JSON.stringify(value) : value;
        const result = activeCacheInstance.set(key, stringValue, ttlSeconds);
        if (result instanceof Promise)
            await result;
    }
    async delete(key) {
        const result = activeCacheInstance.delete(key);
        if (result instanceof Promise)
            await result;
    }
}
export default new CacheService();
//# sourceMappingURL=cache.js.map