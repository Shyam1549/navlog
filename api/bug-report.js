const RESEND_API_URL = "https://api.resend.com/emails";

function safe(value) {
  return String(value || "").trim();
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function json(res, statusCode, payload) {
  res.status(statusCode).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const apiKey = safe(process.env.RESEND_API_KEY);
  const to = safe(process.env.BUG_REPORT_TO_EMAIL);
  const from = safe(process.env.BUG_REPORT_FROM_EMAIL) || "Navlog Bug Reports <onboarding@resend.dev>";
  if (!apiKey || !to) {
    return json(res, 500, { error: "Bug reporting is not configured on the server." });
  }

  const body = readBody(req);
  const message = safe(body.message);
  const reporterEmail = safe(body.reporterEmail);
  const page = safe(body.page);
  const departure = safe(body.departure);
  const destination = safe(body.destination);
  const userAgent = safe(body.userAgent);

  if (!message) return json(res, 400, { error: "Message is required." });
  if (message.length > 2000) return json(res, 400, { error: "Message is too long." });
  if (reporterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
    return json(res, 400, { error: "Email format is invalid." });
  }

  const subject = `Navlog Bug Report${reporterEmail ? ` from ${reporterEmail}` : ""}`;
  const html = [
    "<h2>New Navlog Bug Report</h2>",
    `<p><strong>Reporter:</strong> ${reporterEmail || "not provided"}</p>`,
    `<p><strong>Page:</strong> ${page || "unknown"}</p>`,
    `<p><strong>Route:</strong> ${departure || "-"} to ${destination || "-"}</p>`,
    `<p><strong>User-Agent:</strong> ${userAgent || "unknown"}</p>`,
    "<hr/>",
    `<p style="white-space:pre-wrap">${message.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>`,
  ].join("");

  try {
    const emailResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        reply_to: reporterEmail || undefined,
      }),
    });

    if (!emailResponse.ok) {
      return json(res, 502, { error: "Email provider rejected the bug report." });
    }

    return json(res, 200, { ok: true });
  } catch {
    return json(res, 502, { error: "Failed to send bug report email." });
  }
};
