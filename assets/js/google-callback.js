const params = new URLSearchParams(location.search);
const box = document.getElementById("callbackMessage");
const title = document.getElementById("callbackTitle");

function show(text, ok=false) {
  box.textContent = text;
  box.className = ok ? "message ok" : "message";
}

const error = params.get("error");
const code = params.get("code");
const state = params.get("state");
const expectedState = sessionStorage.getItem("yt_oauth_state");

if (error) {
  title.textContent = "Google Connect Failed";
  show("Google authorization failed: " + error);
} else if (code) {
  if (expectedState && state !== expectedState) {
    title.textContent = "Security Check Failed";
    show("OAuth state did not match. Please try again.");
  } else {
    title.textContent = "Google Authorization Successful ✅";
    show("Authorization code received. Secure token exchange will be completed through a Supabase Edge Function.", true);
  }
} else {
  title.textContent = "No Authorization Found";
  show("No authorization response was found.");
}