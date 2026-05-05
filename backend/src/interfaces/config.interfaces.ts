interface RedisConnDetails {
    host: string
    port: number
    ttl: number
}

export interface Config {
    nodeEnv: string
    port: number
    redis: RedisConnDetails
    OpenAiApiKey: string
}