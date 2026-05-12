function safe(value) {
  return String(value || "").trim();
}

function readBody(req) {
  if (Array.isArray(req.body)) return req.body;
  if (req.body && typeof req.body === "object") {
    if (Array.isArray(req.body.events)) return req.body.events;
    return [req.body];
  }
  if (typeof req.body === "string") {
    try {
      const parsed = JSON.parse(req.body);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return [parsed];
    } catch {
      return [];
    }
  }
  return [];
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

  const sharedKey = safe(process.env.NAVLOG_DRAIN_SHARED_KEY);
  if (sharedKey) {
    const headerKey = safe(req.headers["x-navlog-drain-key"]);
    if (headerKey !== sharedKey) return json(res, 401, { error: "Unauthorized drain request." });
  }

  const supabaseUrl = safe(process.env.SUPABASE_URL);
  const serviceRoleKey = safe(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, { error: "Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." });
  }

  const body = readBody(req);
  const events = body
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      event_type: safe(item.eventType || item.event_type),
      occurred_at: Number.isFinite(Number(item.timestamp)) ? new Date(Number(item.timestamp)).toISOString() : new Date().toISOString(),
      path: safe(item.path),
      route: safe(item.route),
      referrer: safe(item.referrer),
      country: safe(item.country),
      device_id: safe(item.deviceId || item.device_id),
      client_name: safe(item.clientName || item.client_name),
      device_type: safe(item.deviceType || item.device_type),
      vercel_environment: safe(item.vercelEnvironment || item.vercel_environment),
      raw_event: item,
    }))
    .filter((row) => row.event_type === "pageview" || row.event_type === "event");

  if (!events.length) return json(res, 200, { ok: true, inserted: 0 });

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(events),
    });
    if (!response.ok) {
      return json(res, 500, { error: "Could not insert drain events into analytics_events." });
    }
    return json(res, 200, { ok: true, inserted: events.length });
  } catch {
    return json(res, 500, { error: "Drain ingestion failed." });
  }
};

