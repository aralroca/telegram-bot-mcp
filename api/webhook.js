const { getPending, setPending, getOldestPendingId } = require("../lib/store");

const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const message = req.body?.message;

  if (!message) {
    console.log("No message found in body");
    return res.status(200).send("OK");
  }

  // Security: only accept messages from the allowed user
  if (ALLOWED_USER_ID && message.from?.id?.toString() !== ALLOWED_USER_ID) {
    console.log(
      `Forbidden: Sender ${message.from?.id} does not match ALLOWED_USER_ID ${ALLOWED_USER_ID}`,
    );
    return res.status(403).send("Forbidden");
  }

  const text = message.text?.toUpperCase();

  if (!text) {
    console.log("Message has no text");
    return res.status(200).send("OK");
  }

  console.log(`Received message: ${text}`);

  // Find the oldest pending request without an answer
  const pendingId = await getOldestPendingId();
  console.log(`Oldest pending ID found: ${pendingId}`);

  if (pendingId) {
    const data = await getPending(pendingId);
    if (data) {
      console.log(`Updating request ${pendingId} with answer ${text}`);
      data.answer = text;
      data.answeredAt = Date.now();
      await setPending(pendingId, data);
      console.log("Request updated successfully");
    } else {
      console.error(`Pending data for ${pendingId} not found`);
    }
  } else {
    console.log("No pending requests found to answer");
  }

  return res.status(200).send("OK");
};
