YT Creator Pro — Google OAuth 401 malformed fix

Changed only the Google/YouTube OAuth-related files.

Root cause addressed:
- The deployed website was using the stale OAuth Web Client ID:
  699096777627-ch5ds0kau6qej3m91mfi0mk7dbdjgppe.apps.googleusercontent.com
- The project contains the corrected Web Client ID:
  699096777627-on3eo7fsl0n2qij6il47vi0itkbbumpf.apps.googleusercontent.com

Deployment:
1. Replace the matching OAuth JS files in the website.
2. If deploying the Supabase youtube-oauth function from this patch, redeploy it.
3. In Supabase Edge Function secrets, GOOGLE_CLIENT_ID must be the corrected client ID above and GOOGLE_CLIENT_SECRET must belong to that SAME Web OAuth client.
4. In Google Cloud OAuth client settings, verify:
   Authorized JavaScript origin: https://khobragade.online
   Authorized redirect URI: https://khobragade.online/google-callback.html
5. Do not change the service-selection files or database/service flow.

The frontend still uses PKCE + state and the existing callback flow.
