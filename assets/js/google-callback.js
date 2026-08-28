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

async function run() {
  const error = params.get("error");
  const code = params.get("code");
  const state = params.get("state");
  const expectedState = sessionStorage.getItem("yt_oauth_state");
  const verifier = sessionStorage.getItem("yt_pkce_verifier");

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

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + session.access_token,
      "apikey": PUBLISHABLE_KEY
    },
    body: JSON.stringify({
      code,
      code_verifier: verifier,
      redirect_uri: `${location.origin}/google-callback.html`
    })
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    title.textContent = "YouTube Connect Failed";
    show(result.details || result.error || "Could not connect YouTube.");
    return;
  }

  sessionStorage.removeItem("yt_pkce_verifier");
  sessionStorage.removeItem("yt_oauth_state");

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
}

run();