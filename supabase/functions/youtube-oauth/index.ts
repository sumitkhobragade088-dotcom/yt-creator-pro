const ALLOWED_ORIGINS = new Set([
  "https://khobragade.online",
  "https://www.khobragade.online",
  "https://sumitkhobragade088-dotcom.github.io"
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://khobragade.online";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}
function J(req: Request, d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...cors(req), "Content-Type": "application/json" }
  });
}
async function rest(url:string, service:string, path:string, init:RequestInit={}) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return J(req, { error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "699096777627-ch5ds0kau6qej3m91mfi0mk7dbdjgppe.apps.googleusercontent.com";
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    const auth = req.headers.get("Authorization");
    if (!auth) return J(req, { error: "Login required" }, 401);

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: ANON }
    });
    if (!userRes.ok) return J(req, { error: "Invalid session" }, 401);
    const user = await userRes.json();

    const customerRes = await rest(
      SUPABASE_URL, SERVICE,
      `customers?user_id=eq.${encodeURIComponent(user.id)}&select=id,full_name,email&limit=1`
    );
    const customers = await customerRes.json();
    const customer = customers?.[0];
    if (!customer) return J(req, { error: "Customer profile not found" }, 404);

    const body = await req.json();

    // Full disconnect: remove stored OAuth token + existing Channel Access row.
    if (body.action === "disconnect") {
      const t = await rest(
        SUPABASE_URL, SERVICE,
        `youtube_oauth_tokens?customer_id=eq.${encodeURIComponent(customer.id)}`,
        { method: "DELETE" }
      );
      if (!t.ok) return J(req, { error: "YouTube token delete failed", details: await t.text() }, 400);

      const a = await rest(
        SUPABASE_URL, SERVICE,
        `channel_access?customer_id=eq.${encodeURIComponent(customer.id)}`,
        { method: "DELETE" }
      );
      if (!a.ok) return J(req, { error: "Channel Access delete failed", details: await a.text() }, 400);

      // Clear the customer-facing channel fields as part of the same disconnect.
      // This prevents stale channel name/URL from remaining in User Profile/Dashboard.
      const clearCustomer = await rest(
        SUPABASE_URL, SERVICE,
        `customers?id=eq.${encodeURIComponent(customer.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            channel_name: "",
            channel_url: ""
          })
        }
      );
      if (!clearCustomer.ok) {
        return J(req, { error: "Customer channel cleanup failed", details: await clearCustomer.text() }, 400);
      }

      return J(req, { success: true, disconnected: true });
    }

    // Refresh current connected channel using the already stored refresh token.
    if (body.action === "refresh") {
      const storedRes = await rest(
        SUPABASE_URL, SERVICE,
        `youtube_oauth_tokens?customer_id=eq.${encodeURIComponent(customer.id)}&select=refresh_token&limit=1`
      );
      const stored = storedRes.ok ? await storedRes.json() : [];
      const refreshToken = stored?.[0]?.refresh_token;
      if (!refreshToken) return J(req, { error: "Stored YouTube access not found. Please reconnect YouTube." }, 404);

      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token"
        })
      });
      const refreshed = await refreshRes.json();
      if (!refreshRes.ok || !refreshed.access_token) {
        return J(req, { error: "YouTube refresh failed", details: refreshed?.error_description || refreshed?.error || "Reconnect YouTube." }, 400);
      }

      const channelRes = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
        { headers: { Authorization: `Bearer ${refreshed.access_token}` } }
      );
      const channelData = await channelRes.json();
      if (!channelRes.ok) {
        return J(req, { error: "YouTube channel refresh failed", details: channelData?.error?.message || channelRes.status }, 400);
      }
      const ch = channelData.items?.[0];
      if (!ch) return J(req, { error: "No YouTube channel found." }, 404);

      const thumb = ch.snippet?.thumbnails?.high?.url || ch.snippet?.thumbnails?.default?.url || "";
      const stats = ch.statistics || {};
      const updateAccess = await rest(
        SUPABASE_URL, SERVICE,
        `channel_access?customer_id=eq.${encodeURIComponent(customer.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            google_connected: true,
            channel_id: ch.id,
            channel_name: ch.snippet?.title || "",
            channel_thumbnail: thumb,
            subscribers: Number(stats.subscriberCount || 0),
            views: Number(stats.viewCount || 0),
            videos: Number(stats.videoCount || 0),
            updated_at: new Date().toISOString()
          })
        }
      );
      if (!updateAccess.ok) return J(req, { error: "Channel Access update failed", details: await updateAccess.text() }, 400);

      await rest(
        SUPABASE_URL, SERVICE,
        `customers?id=eq.${encodeURIComponent(customer.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            channel_name: ch.snippet?.title || "",
            channel_url: `https://www.youtube.com/channel/${ch.id}`
          })
        }
      );

      return J(req, {
        success: true,
        refreshed: true,
        channel: {
          id: ch.id,
          name: ch.snippet?.title || "",
          thumbnail: thumb,
          subscribers: stats.subscriberCount || "0",
          views: stats.viewCount || "0",
          videos: stats.videoCount || "0"
        }
      });
    }

    const code = String(body.code || "");
    const verifier = String(body.code_verifier || "");
    const redirectUri = String(body.redirect_uri || "");

    const allowedRedirects = new Set([
      "https://khobragade.online/google-callback.html",
      "https://www.khobragade.online/google-callback.html",
      "https://sumitkhobragade088-dotcom.github.io/yt-creator-pro/google-callback.html"
    ]);

    if (!code || !verifier) return J(req, { error: "OAuth code/verifier missing" }, 400);
    if (!allowedRedirects.has(redirectUri)) return J(req, { error: "Invalid redirect URI" }, 400);

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      })
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok) {
      return J(req, { error: "Google token exchange failed", details: token.error_description || token.error }, 400);
    }

    const accessToken = token.access_token;
    if (!accessToken) return J(req, { error: "Google access token missing" }, 400);

    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const channelData = await channelRes.json();
    if (!channelRes.ok) {
      return J(req, { error: "YouTube channel read failed", details: channelData?.error?.message || channelRes.status }, 400);
    }

    const ch = channelData.items?.[0];
    if (!ch) return J(req, { error: "No YouTube channel found for this Google account" }, 404);

    const existingTokenRes = await rest(
      SUPABASE_URL, SERVICE,
      `youtube_oauth_tokens?customer_id=eq.${encodeURIComponent(customer.id)}&select=refresh_token&limit=1`
    );
    const existingTokens = existingTokenRes.ok ? await existingTokenRes.json() : [];
    const refreshToken = token.refresh_token || existingTokens?.[0]?.refresh_token;
    if (!refreshToken) {
      return J(req, { error: "Refresh token missing", details: "Reconnect with Google consent and try again." }, 400);
    }

    // Do not rely on a UNIQUE(customer_id) constraint here.
    // Reconnect safely replaces the old stored token, then inserts the fresh token.
    const deleteOldToken = await rest(
      SUPABASE_URL, SERVICE,
      `youtube_oauth_tokens?customer_id=eq.${encodeURIComponent(customer.id)}`,
      { method: "DELETE" }
    );
    if (!deleteOldToken.ok) {
      return J(req, { error: "Old YouTube token cleanup failed", details: await deleteOldToken.text() }, 400);
    }

    const saveToken = await rest(
      SUPABASE_URL, SERVICE,
      "youtube_oauth_tokens",
      {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: user.id, customer_id: customer.id, refresh_token: refreshToken })
      }
    );
    if (!saveToken.ok) return J(req, { error: "YouTube token save failed", details: await saveToken.text() }, 400);

    const thumb = ch.snippet?.thumbnails?.high?.url || ch.snippet?.thumbnails?.default?.url || "";
    const stats = ch.statistics || {};

    // Preserve the existing Manager Access state during reconnect.
    // Reconnecting YouTube must not revoke an access state already granted by Admin.
    const existingAccessRes = await rest(
      SUPABASE_URL, SERVICE,
      `channel_access?customer_id=eq.${encodeURIComponent(customer.id)}&select=manager_access&limit=1`
    );
    const existingAccess = existingAccessRes.ok ? await existingAccessRes.json() : [];
    const managerAccess = existingAccess?.[0]?.manager_access === true;

    const accessPayload = {
      customer_id: customer.id,
      google_connected: true,
      channel_id: ch.id,
      channel_name: ch.snippet?.title || "",
      channel_thumbnail: thumb,
      subscribers: Number(stats.subscriberCount || 0),
      views: Number(stats.viewCount || 0),
      videos: Number(stats.videoCount || 0),
      manager_access: managerAccess,
      updated_at: new Date().toISOString()
    };

    const saveAccess = await rest(
      SUPABASE_URL, SERVICE,
      "channel_access?on_conflict=customer_id",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(accessPayload)
      }
    );
    if (!saveAccess.ok) return J(req, { error: "Channel Access save failed", details: await saveAccess.text() }, 400);

    // Keep customer channel display in sync.
    await rest(
      SUPABASE_URL, SERVICE,
      `customers?id=eq.${encodeURIComponent(customer.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          channel_name: ch.snippet?.title || "",
          channel_url: `https://www.youtube.com/channel/${ch.id}`
        })
      }
    );

    return J(req, {
      success: true,
      channel: {
        id: ch.id,
        name: ch.snippet?.title || "",
        thumbnail: thumb,
        subscribers: stats.subscriberCount || "0",
        views: stats.viewCount || "0",
        videos: stats.videoCount || "0"
      }
    });
  } catch (e) {
    console.error(e);
    return J(req, { error: "Server error", details: String(e) }, 500);
  }
});
