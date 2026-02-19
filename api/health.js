const { isRedis } = require("../lib/store");

module.exports = async function handler(req, res) {
  const redisUrl = process.env.REDIS_URL || "";
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || "";

  return res.status(200).json({
    status: "ok",
    redis_initialized: isRedis(),
    env_summary: {
      BOT_TOKEN: !!process.env.BOT_TOKEN,
      CHAT_ID: !!process.env.CHAT_ID,
      ALLOWED_USER_ID: !!process.env.ALLOWED_USER_ID,
      UPSTASH_REDIS_REST_URL: !!upstashUrl,
      REDIS_URL: !!redisUrl,
      REDIS_URL_PREFIX: redisUrl ? redisUrl.substring(0, 10) : "none",
    },
  });
};
