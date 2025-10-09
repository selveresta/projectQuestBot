import { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>;

export async function createRedisClient(url: string) {
  const client = createClient({ url });

  client.on("error", (error) => {
    console.error("[redis] connection error", error);
  });

  await client.connect();

  return client;
}
