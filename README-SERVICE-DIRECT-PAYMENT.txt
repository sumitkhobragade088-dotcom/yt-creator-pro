YT CREATOR PRO - SERVICE CMS + DIRECT PAYMENT

WHAT CHANGED
- Admin > Services now has Add/Edit/Delete Service.
- Admin can select Customer + Service + Amount and create payment directly.
- No user-created request is required first.
- Direct payment automatically creates a payment_pending request internally so the existing PayU flow stays compatible.
- User > Services now loads active services from Supabase automatically.
- User > My Requests shows Pay Now for assigned direct payments.
- Existing YouTube / Manager Access / Login / Refresh / PayU Edge Functions are not changed.

ONE REQUIRED STEP
Supabase > SQL Editor:
Run SERVICE-CATALOG-DIRECT-PAYMENT.sql once.

Then refresh Admin Dashboard > Services.
