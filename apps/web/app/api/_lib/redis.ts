import IORedis, { type RedisOptions } from "ioredis";

let redis: IORedis | null = null;
let redisHealthy = false;
let missingConfigLogged = false;

function createClient(url: string) {
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
  const url = process.env.REDIS_URL;

  if (!url) {
    if (!missingConfigLogged) {
      console.info("redis disabled: REDIS_URL not configured");
      missingConfigLogged = true;
    }
    return null;
  }

  if (!redis) {
    try {
      redis = createClient(url);
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
