const axios = require("axios");
const { setPending } = require("../lib/store");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question, requestId } = req.body || {};

  if (!question) {
    return res.status(400).json({ error: "Missing 'question' in body" });
  }

  const id = requestId || Date.now().toString();

  try {
    // Save the pending request
    await setPending(id, { question, createdAt: Date.now(), answer: null });

    // Send the question to Telegram
    console.log(
      `Sending to Telegram: https://api.telegram.org/bot<HIDDEN>/sendMessage`,
    );
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: `${question}\n\nReply: YES / NO`,
    });

    return res.status(200).json({
      requestId: id,
      status: "pending",
      message: "Question sent to Telegram. Poll /api/confirm-status?id=" + id,
    });
  } catch (error) {
    console.error(
      "Error in /api/confirm:",
      error.response?.data || error.message,
    );
    return res.status(error.response?.status || 500).json({
      error: "Failed to send confirmation",
      details: error.response?.data || error.message,
    });
  }
};
