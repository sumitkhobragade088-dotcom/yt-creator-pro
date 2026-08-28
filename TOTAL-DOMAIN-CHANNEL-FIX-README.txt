YT CREATOR PRO - TOTAL CUSTOM DOMAIN + CHANNEL ACCESS FIX

FIXED:
- User login auth.js duplicate variable syntax fix retained.
- User sidebar Logout hardened and working.
- Google OAuth redirect is now dynamic from current site origin:
  https://khobragade.online/google-callback.html
- Existing GitHub Pages OAuth redirect remains supported as fallback.
- Channel Access shows:
  Reconnect YouTube
  Delete Existing Channel Access
- Delete Existing Channel Access removes BOTH:
  channel_access row
  youtube_oauth_tokens row
- After delete, user can connect fresh again.
- New users and existing users use the same fixed OAuth flow.
- google-callback sends exact redirect_uri to backend token exchange.
- youtube-oauth Edge Function included with custom-domain redirect whitelist.
- youtube-manage CORS updated for khobragade.online, www, and old GitHub Pages.
- Existing Payments / PayU + Service Charge patch retained.
- Existing Admin/User refresh no-flash + fresh-login behavior retained.
- Old standalone Manage Channel flow is NOT restored.

DEPLOY:
1) Upload these web files:
   dashboard.html
   assets/js/auth.js
   assets/js/google-youtube.js
   assets/js/google-callback.js
   assets/css/style.css

2) Supabase Edge Functions:
   Redeploy youtube-oauth using included supabase/functions/youtube-oauth/index.ts
   Redeploy youtube-manage using included supabase/functions/youtube-manage/index.ts

3) JWT:
   youtube-oauth: keep the same JWT setting currently used for your working OAuth function.
   youtube-manage: keep existing JWT setting.

4) Google OAuth authorized redirect URI must contain:
   https://khobragade.online/google-callback.html

No PayU Key/Salt changes required.
