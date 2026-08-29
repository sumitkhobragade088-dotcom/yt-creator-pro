import { supabase } from "./supabase.js";

const CLIENT_ID = "699096777627-ch5ds0kau6qej3m91mfi0mk7dbdjgppe.apps.googleusercontent.com";
function getYouTubeRedirectUri() {
  if (location.hostname === "khobragade.online" || location.hostname === "www.khobragade.online") {
    return "https://khobragade.online/google-callback.html";
  }
  return "https://sumitkhobragade088-dotcom.github.io/yt-creator-pro/google-callback.html";
}
const REDIRECT_URI = getYouTubeRedirectUri();
const SCOPE = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly"
].join(" ");

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
  sessionStorage.setItem("yt_oauth_redirect_uri", REDIRECT_URI);

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

function channelAccessMessage(text="", ok=false){
  const el=document.getElementById("channelAccessActionMessage");
  if(!el)return;
  el.textContent=text;
  el.className="yt-channel-access-message "+(ok?"ok":"bad");
}

window.deleteExistingChannelAccess = async function(){
  if(!confirm("Delete connected YouTube channel access? You can reconnect later."))return;
  const btn=document.getElementById("deleteChannelAccessBtn");
  const old=btn?.textContent||"Delete Channel Access";
  if(btn){btn.disabled=true;btn.textContent="Deleting...";}
  channelAccessMessage("Deleting channel access...");
  try{
    const {data,error}=await supabase.functions.invoke("youtube-oauth",{body:{action:"disconnect"}});
    if(error)throw error;
    if(!data?.success)throw new Error(data?.error||"Delete failed.");
    channelAccessMessage("Channel access deleted successfully.",true);
    sessionStorage.setItem("yt_user_view","access");
    setTimeout(()=>location.reload(),700);
  }catch(e){
    channelAccessMessage(e?.message||"Channel access delete failed.");
    if(btn){btn.disabled=false;btn.textContent=old;}
  }
};

window.updateExistingChannelAccess = async function(){
  const btn=document.getElementById("updateChannelAccessBtn");
  const old=btn?.textContent||"Update Channel Data";
  if(btn){btn.disabled=true;btn.textContent="Updating...";}
  channelAccessMessage("Updating latest YouTube channel data...");
  try{
    const {data,error}=await supabase.functions.invoke("youtube-oauth",{body:{action:"refresh"}});
    if(error)throw error;
    if(!data?.success)throw new Error(data?.error||data?.details||"Update failed.");
    channelAccessMessage("Channel data updated successfully.",true);
    sessionStorage.setItem("yt_user_view","access");
    setTimeout(()=>location.reload(),700);
  }catch(e){
    channelAccessMessage(e?.message||"Channel data update failed.");
    if(btn){btn.disabled=false;btn.textContent=old;}
  }
};
