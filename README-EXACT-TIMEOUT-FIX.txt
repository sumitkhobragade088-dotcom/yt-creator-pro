EXACT FIX ONLY

Problem:
The frontend itself was aborting youtube-oauth after 30 seconds and showing:
"Connection save timed out. Please reconnect once."

Fix:
- Removed the artificial 30-second AbortController timeout.
- Callback now waits for the real youtube-oauth response.
- If backend returns an actual error, that exact error will be shown.
- OAuth redirect/token logic is unchanged.
- No Supabase Edge Function change required for THIS patch.

Upload only:
assets/js/google-callback.js
