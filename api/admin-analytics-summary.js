function safe(value) {
  return String(value || "").trim();
}

function json(res, statusCode, payload) {
  res.status(statusCode).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "Method not allowed" });
  }

  const supabaseUrl = safe(process.env.SUPABASE_URL);
  const serviceRoleKey = safe(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, {
      error: "Native analytics is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel.",
    });
  }

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const endpoint = `${supabaseUrl}/rest/v1/analytics_events?select=occurred_at,path,device_id,event_type&event_type=eq.pageview&occurred_at=gte.${encodeURIComponent(since7d)}&order=occurred_at.desc&limit=10000`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    const rows = await response.json().catch(() => []);
    if (!response.ok) {
      return json(res, 500, {
        error: "Could not query analytics_events. Ensure supabase-analytics.sql is applied.",
      });
    }

    const events = Array.isArray(rows) ? rows : [];
    const pageviews7d = events.length;
    const uniqueVisitors7d = new Set(events.map((row) => safe(row.device_id)).filter(Boolean)).size;

    const events24h = events.filter((row) => {
      const t = Date.parse(row && row.occurred_at ? row.occurred_at : "");
      return Number.isFinite(t) && t >= Date.parse(since24h);
    });
    const pageviews24h = events24h.length;
    const uniqueVisitors24h = new Set(events24h.map((row) => safe(row.device_id)).filter(Boolean)).size;

    const topMap = new Map();
    events.forEach((row) => {
      const key = safe(row && row.path ? row.path : "/") || "/";
      topMap.set(key, (topMap.get(key) || 0) + 1);
    });
    const topPages = Array.from(topMap.entries())
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    return json(res, 200, {
      summary: {
        pageviews24h,
        uniqueVisitors24h,
        pageviews7d,
        uniqueVisitors7d,
        topPages,
      },
    });
  } catch {
    return json(res, 500, { error: "Could not load native analytics summary." });
  }
};

