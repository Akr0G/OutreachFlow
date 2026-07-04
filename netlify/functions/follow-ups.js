exports.handler = async () => {
  return callCronRoute("/api/cron/follow-ups");
};

async function callCronRoute(path) {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");
  const cronSecret = process.env.CRON_SECRET;

  if (!siteUrl) {
    return jsonResponse(500, { error: "Netlify site URL is not available." });
  }
  if (!cronSecret) {
    return jsonResponse(500, { error: "CRON_SECRET is not configured." });
  }

  const response = await fetch(`${siteUrl}${path}`, {
    headers: {
      authorization: `Bearer ${cronSecret}`
    }
  });
  const body = await response.text();

  return {
    statusCode: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
    body
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}
