YT CREATOR PRO - PAYU PAYMENT PATCH

IMPORTANT:
- Existing 2 PayU websites are NOT changed by this patch.
- This project does NOT contain your Merchant Key or Salt.
- Existing YouTube/Manager/Refresh/Login flows are preserved.

1) Supabase SQL Editor:
   Run PAYU-PAYMENT-SETUP.sql

2) Supabase Edge Function Secrets:
   PAYU_KEY = your existing PayU merchant key
   PAYU_SALT = your existing PayU salt
   PAYU_MODE = production
   SITE_URL = your YT Creator Pro public base URL
   Example:
   https://sumitkhobragade088-dotcom.github.io/yt-creator-pro

3) Deploy functions:
   supabase functions deploy payu-initiate
   supabase functions deploy payu-callback --no-verify-jwt

4) Admin -> Services:
   Enter amount -> Create Payment.
   No service price is guessed in code.

5) User -> My Requests:
   Pay Now appears only after Admin creates the payment amount.
   PayU hosted checkout opens.
   PayU callback verifies reverse SHA-512 hash and amount before marking Paid.

SECURITY:
- PAYU_SALT stays only in Supabase secrets.
- Never put PAYU_SALT in GitHub Pages / frontend JS.
