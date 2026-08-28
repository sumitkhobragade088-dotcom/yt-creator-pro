LOGIN TIMEOUT RELATED FIX ONLY

Replace only:
1. assets/js/auth.js
2. assets/js/admin-auth.js

Changed:
- Removed artificial 10-second wrapper from User signInWithPassword.
- Removed artificial 10-second wrapper from Admin signInWithPassword.

Not changed:
- PayU callback
- Payments
- User Requests
- YouTube OAuth / Manage Channel
- Dashboard lazy-loading/timeouts
- SQL / Supabase secrets

No SQL run and no Edge Function redeploy is needed for this patch.
