CACHE-BUST FINAL FIX

Why the same old message was still visible:
The browser/site was still loading the old cached assets/js/google-callback.js.

This patch avoids that completely:
- google-callback.html now loads a NEW file:
  assets/js/google-callback-fixed.js?v=20260828-1425
- The new JS contains NO 30-second timeout and NO old timeout message.

Upload BOTH files:
1) google-callback.html
2) assets/js/google-callback-fixed.js

Do not delete other files.
No Supabase redeploy needed for this patch.
