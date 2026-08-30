import { supabase } from "./supabase.js";

const FUNCTION_URL = "https://ncxexmekzlrliicaqfcl.supabase.co/functions/v1/youtube-oauth";
const PUBLISHABLE_KEY = "sb_publishable_mayjwNbdFk6xltqcgbfLqA_dbTjSd7q";

const params = new URLSearchParams(location.search);
const box = document.getElementById("callbackMessage");
const title = document.getElementById("callbackTitle");
const details = document.getElementById("channelDetails");

function show(text, ok=false) {
  box.textContent = text;
  box.className = ok ? "message ok" : "message";
}

function getCookie(name) {
  const prefix = name + "=";
  for (const part of document.cookie.split(";")) {
    const item = part.trim();
    if (item.startsWith(prefix)) return decodeURIComponent(item.slice(prefix.length));
  }
  return null;
}

function clearOAuthCookie(name) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const domain = (location.hostname === "khobragade.online" || location.hostname === "www.khobragade.online")
    ? "; Domain=.khobragade.online"
    : "";
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${secure}${domain}`;
}

function readOAuthValue(name) {
  return sessionStorage.getItem(name) || getCookie(name);
}

function clearOAuthSession() {
  ["yt_pkce_verifier", "yt_oauth_state", "yt_oauth_redirect_uri"].forEach((name) => {
    sessionStorage.removeItem(name);
    clearOAuthCookie(name);
  });
}

async function run() {
  const error = params.get("error");
  const code = params.get("code");
  const state = params.get("state");
  const expectedState = readOAuthValue("yt_oauth_state");
  const verifier = readOAuthValue("yt_pkce_verifier");
  const redirectUri = readOAuthValue("yt_oauth_redirect_uri")
    || ((location.hostname === "khobragade.online" || location.hostname === "www.khobragade.online")
      ? "https://khobragade.online/google-callback.html"
      : "https://sumitkhobragade088-dotcom.github.io/yt-creator-pro/google-callback.html");

  if (error) {
    title.textContent = "Google Connect Failed";
    show("Google authorization failed: " + error);
    return;
  }

  if (!code) {
    title.textContent = "No Authorization Found";
    show("No Google authorization code was received.");
    return;
  }

  if (!expectedState || state !== expectedState) {
    title.textContent = "Security Check Failed";
    show("OAuth security state did not match. Please connect again.");
    return;
  }

  if (!verifier) {
    title.textContent = "Session Expired";
    show("OAuth session expired. Please return to Dashboard and connect again.");
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    title.textContent = "Login Required";
    show("Please login to YT Creator Pro again before connecting YouTube.");
    setTimeout(() => location.href = "login.html", 1800);
    return;
  }

  title.textContent = "Connecting YouTube…";
  show("Google permission approved. Saving your channel securely…", true);

  let response;
  let result = {};
  try {
    response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + session.access_token,
        "apikey": PUBLISHABLE_KEY
      },
      body: JSON.stringify({
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri
      })
    });

    result = await response.json().catch(() => ({}));
  } catch (e) {
    title.textContent = "YouTube Connect Failed";
    show("Could not reach YouTube connection backend: " + (e?.message || e));
    return;
  }

  if (!response.ok || !result.success) {
    title.textContent = "YouTube Connect Failed";
    const detail = typeof result.details === "string"
      ? result.details
      : (result.details ? JSON.stringify(result.details) : "");
    show(detail || result.error || `Could not connect YouTube (HTTP ${response.status}).`);
    return;
  }

  clearOAuthSession();

  const c = result.channel || {};
  title.textContent = "YouTube Connected ✅";
  show("Your YouTube channel has been connected successfully.", true);

  details.innerHTML = `
    <div class="channel-card">
      ${c.thumbnail ? `<img src="${c.thumbnail}" alt="Channel thumbnail">` : ""}
      <div>
        <h2>${c.name || "YouTube Channel"}</h2>
        <p><b>Subscribers:</b> ${c.subscribers ?? "-"}</p>
        <p><b>Views:</b> ${c.views ?? "-"}</p>
        <p><b>Videos:</b> ${c.videos ?? "-"}</p>
      </div>
    </div>
  `;

  sessionStorage.setItem("yt_user_view", "access");
  setTimeout(() => {
    location.replace("dashboard.html");
  }, 1400);
}

run();