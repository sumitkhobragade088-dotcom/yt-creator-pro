YT Creator Pro — Point 4 Google/YouTube Connect

Included:
- Connect YouTube Channel button
- Google OAuth authorization using youtube.force-ssl
- PKCE challenge + state protection
- google-callback.html
- No OAuth client secret in frontend code
- POINT4-RLS.sql

Next:
1. Run POINT4-RLS.sql in Supabase SQL Editor.
2. Upload/replace website files in GitHub.
3. Then create the secure Supabase Edge Function for Google token exchange and YouTube channel data saving.

Important:
GitHub Pages is static hosting, so the OAuth client secret must never be placed in HTML/JS.
