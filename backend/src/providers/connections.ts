import { Redis } from "ioredis";
import { config } from '../config'

/**
 * Class that works with redis
 *
 * @important **Declare it once**, only import from `server.ts`
 */
export class RedisConfiguration {
    client = new Redis({
        host: config.redis.host,
        port: config.redis.port
    });

    public async set(key: string, value: string, ttl: number = config.redis.ttl) {
        await this.client.set(key, value, 'EX', ttl);
    }

    public async get(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    public getRedisClient() {
        return this.client;
    }

}