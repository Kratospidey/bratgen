import IORedis, { type RedisOptions } from "ioredis";

let redis: IORedis | null = null;
let redisHealthy = false;

function createClient() {
  const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  const options: RedisOptions = {
    maxRetriesPerRequest: null
  };
  const client = new IORedis(url, options);
  client.on("error", (error) => {
    console.error("redis connection error", error);
    redisHealthy = false;
  });
  client.on("ready", () => {
    redisHealthy = true;
  });
  return client;
}

export function getRedis(): IORedis | null {
  if (!redis) {
    try {
      redis = createClient();
    } catch (error) {
      console.warn("failed to initialize redis client", error);
      redis = null;
    }
  }
  return redisHealthy ? redis : null;
}

export function isRedisAvailable() {
  return redisHealthy;
}
