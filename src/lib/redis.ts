import { Redis } from "@upstash/redis";
import { env } from "./env";

let client: Redis | null | undefined;

/** Shared Upstash client, or null when Redis is not configured (callers fall back to memory). */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = env.redisUrl;
  const token = env.redisToken;
  client = url && token ? new Redis({ url, token, enableTelemetry: false }) : null;
  return client;
}
