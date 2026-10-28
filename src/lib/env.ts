// Server-only environment access: importing this from a Client Component fails the build.
import "server-only";

// Getters read process.env lazily so missing values never throw at import time.

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function first(...names: string[]): string | undefined {
  for (const name of names) {
    const value = read(name);
    if (value) return value;
  }
  return undefined;
}

export const env = {
  get azureOpenAIEndpoint() {
    return read("AZURE_OPENAI_ENDPOINT");
  },
  get azureOpenAIKey() {
    return read("AZURE_OPENAI_KEY");
  },
  get azureOpenAIDeployment() {
    return read("AZURE_OPENAI_DEPLOYMENT");
  },
  get githubToken() {
    return read("GITHUB_TOKEN");
  },
  get redisUrl() {
    return first("UPSTASH_REDIS_REST_URL", "KV_REST_API_URL");
  },
  get redisToken() {
    return first("UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN");
  },
  get cronSecret() {
    return read("CRON_SECRET");
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};

export function hasAzureOpenAI(): boolean {
  return Boolean(env.azureOpenAIEndpoint && env.azureOpenAIKey && env.azureOpenAIDeployment);
}

export function hasRedis(): boolean {
  return Boolean(env.redisUrl && env.redisToken);
}
