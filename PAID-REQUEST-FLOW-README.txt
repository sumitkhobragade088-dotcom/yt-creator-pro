YT CREATOR PRO - PAYMENT + USER REQUEST FLOW FINAL

Implemented exactly:
USER
- New Payments sidebar button.
- Services -> Submit Request & Pay -> PayU opens immediately.
- My Requests shows ONLY requests whose payment status is PAID.
- Pending / Initiated / Failed / Cancelled payments stay in Payments.
- Payments shows service, amount, status and Pay Now / Retry Payment / Pay Again.
- Successful PayU callback returns user to My Requests.
- Failed/cancelled callback returns user to Payments.

ADMIN
- New User Requests button directly below Users / Customers.
- User Requests shows PAID customer requests only.
- Admin can set: Pending, Processing, On Hold, Completed, Rejected.
- User sees the same updated request status in My Requests.
- Services contains service list only.
- Payments / PayU contains payment state / transaction records only.
- Service Charge remains the global service/charge management section.

PRESERVED
- Existing login/auth files were NOT edited.
- Existing YouTube connect/reconnect files were NOT edited.
- Existing Manage Channel flow was NOT edited.
- Existing PayU initiate function was NOT edited.
- Existing Admin/User refresh behavior was NOT edited.

DEPLOY
1. Upload FULL ZIP contents to GitHub Pages repo.
2. Supabase SQL Editor: run PAID-REQUEST-FLOW-SETUP.sql once.
3. Redeploy ONLY payu-callback Edge Function because cancelled status mapping was added.
4. Do NOT change PayU secrets, SITE_URL, Google OAuth, youtube-oauth, or youtube-manage.
