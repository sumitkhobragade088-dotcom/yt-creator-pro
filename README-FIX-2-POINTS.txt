YT Creator Pro — 2-POINT SERVICE FIX

Base: latest YT-Creator-Pro-FINAL-2-ERRORS-CLEARED.zip

FIX 1 — Admin > Free User Service
- Existing/old customers are allowed by the admin customer-list RLS policy.
- Customer selection loads first; then connected YouTube channels load.
- After channel selection, all active services appear with individual checkboxes.
- Admin can select any number of services, Select All, or Clear Services.
- Fixed service_charges column mismatch: uses charge (not amount).

FIX 2 — User > Services
- All active services appear with individual checkboxes.
- User can select any number of services independently.
- Select All / Clear All supported.
- Total is calculated from service_charges.charge.
- Fixed service_charges.amount error by using charge.
- Multi-service request/payment trigger remains based on service names joined with |.

IMPORTANT:
Run FINAL-MULTI-SERVICE-ERROR-FIX.sql in Supabase SQL Editor once so the admin RLS and multi-service payment trigger are in place.

Only changed/required files are included in this patch ZIP.
