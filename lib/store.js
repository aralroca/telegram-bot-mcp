/**
 * Store abstraction for pending confirmation requests.
 * Supports both Upstash REST (@upstash/redis) and standard Redis (ioredis).
 */

const TTL_SECONDS = 300; // 5 min

let client;

function initClient() {
  if (client) return client;

  // 1. Try Standard Redis (ioredis) - Compatible with REDIS_URL (redis://)
  if (process.env.REDIS_URL) {
    try {
      const Redis = require("ioredis");
      client = new Redis(process.env.REDIS_URL, {
        connectTimeout: 5000,
        maxRetriesPerRequest: 1,
      });
      client.type = "ioredis";
      console.log("Redis initialized via ioredis (REDIS_URL)");
      return client;
    } catch (err) {
      console.error("Failed to initialize ioredis:", err.message);
    }
  }

  // 2. Try Upstash REST (@upstash/redis)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const { Redis } = require("@upstash/redis");
      client = Redis.fromEnv();
      client.type = "upstash";
      console.log("Redis initialized via @upstash/redis (REST)");
      return client;
    } catch (err) {
      console.error("Failed to initialize @upstash/redis:", err.message);
    }
  }

  return null;
}

const memoryStore = new Map();

function memoryCleanup(key) {
  setTimeout(() => memoryStore.delete(key), TTL_SECONDS * 1000);
}

// ── Public API ───────────────────────────────────────────────────────

async function setPending(id, data) {
  const c = initClient();
  if (c) {
    if (c.type === "ioredis") {
      await c.set(`pending:${id}`, JSON.stringify(data), "EX", TTL_SECONDS);
      await c.sadd("pending_ids", id);
    } else {
      await c.set(`pending:${id}`, JSON.stringify(data), { ex: TTL_SECONDS });
      await c.sadd("pending_ids", id);
    }
  } else {
    memoryStore.set(id, data);
    memoryCleanup(id);
  }
}

async function getPending(id) {
  const c = initClient();
  if (c) {
    const raw = await c.get(`pending:${id}`);
    return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
  }
  return memoryStore.get(id) || null;
}

async function deletePending(id) {
  const c = initClient();
  if (c) {
    await c.del(`pending:${id}`);
    if (c.type === "ioredis") {
      await c.srem("pending_ids", id);
    } else {
      await c.srem("pending_ids", id);
    }
  } else {
    memoryStore.delete(id);
  }
}

async function getOldestPendingId() {
  const c = initClient();
  if (c) {
    const ids =
      c.type === "ioredis"
        ? await c.smembers("pending_ids")
        : await c.smembers("pending_ids");

    for (const id of ids) {
      const data = await getPending(id);
      if (data && !data.answer) return id;
      if (!data) await deletePending(id);
    }
    return null;
  }

  for (const [id, data] of memoryStore) {
    if (!data.answer) return id;
  }
  return null;
}

module.exports = {
  setPending,
  getPending,
  deletePending,
  getOldestPendingId,
  isRedis: () => !!initClient(),
};
