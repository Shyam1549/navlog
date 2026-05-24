module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const configuredKey = String(process.env.NAVLOG_ACCESS_KEY || "874969").trim();
  const providedKey = String((req.body && req.body.key) || "").trim();
  const ok = providedKey !== "" && configuredKey !== "" && providedKey === configuredKey;
  return res.status(200).json({ ok });
};
