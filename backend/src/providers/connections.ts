import { Redis } from "ioredis";
import { config } from '../config'
import { RedisCityInterface } from "../interfaces/city.interface";

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

    public async set(key: string, value: RedisCityInterface, ttl: number = config.redis.ttl) {
        await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    }

    public async get(key: string): Promise<RedisCityInterface | null> {
        const resp = await this.client.get(key);
        if (resp === null) return null;
        try {
            return JSON.parse(resp);
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    public getRedisClient() {
        return this.client;
    }

}