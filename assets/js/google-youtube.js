const CLIENT_ID = "699096777627-ch5ds0kau6qej3m91mfi0mk7dbdjgppe.apps.googleusercontent.com";
const REDIRECT_URI = `${location.origin}/google-callback.html`;
const SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

function randomString(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[values[i] % chars.length];
  return out;
}

async function sha256(text) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
}

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

window.connectYouTube = async function () {
  const verifier = randomString(96);
  const state = randomString(32);
  const challenge = base64url(await sha256(verifier));

  sessionStorage.setItem("yt_pkce_verifier", verifier);
  sessionStorage.setItem("yt_oauth_state", state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state
  });

  location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
};