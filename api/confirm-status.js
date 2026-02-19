const { getPending, deletePending } = require("../lib/store");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.query?.id;

  if (!id) {
    return res.status(400).json({ error: "Missing 'id' query parameter" });
  }

  const data = await getPending(id);

  if (!data) {
    console.log(`Status poll: ID ${id} not found in store`);
    return res.status(404).json({ error: "Request not found or expired" });
  }

  if (data.answer) {
    console.log(`Status poll: ID ${id} has answer: ${data.answer}`);
    // Clean up after delivering the answer
    await deletePending(id);

    return res.status(200).json({
      requestId: id,
      status: "answered",
      answer: data.answer,
    });
  }

  console.log(`Status poll: ID ${id} still pending`);
  return res.status(200).json({
    requestId: id,
    status: "pending",
  });
};
