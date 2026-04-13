import dotenv from "dotenv";
import type { Config } from "./interfaces/config.interfaces";

dotenv.config({ path: '.env' })

// redis defaults
const redis = {
    host: 'localhost',
    port: 6379,
    ttl: 60 * 60 * 24
}

if (process.env.REDIS_URL) {
    const url = process.env.REDIS_URL

    redis.host = url.split(':')[0]
    redis.port = Number.parseInt(url.split(':').slice(1).join(''));
}

const config: Config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: +(process.env.PORT || 3000),
    redis: redis,
}

export { config }