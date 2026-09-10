YT CREATOR PRO - PAYMENTS / PAYU + SERVICE CHARGE

DONE:
1. Admin sidebar: new Payments / PayU button.
2. Payments / PayU page:
   - Total Collection
   - Success
   - Pending
   - Failed
   - Secure PayU integration status
   - Transaction records
3. Admin sidebar: new Service Charge button.
4. Service Charge page:
   - Total Services
   - Active / Inactive count
   - Current Charge
   - New Service
   - Edit
   - Update Existing
   - Delete
   - Active / Inactive
5. Admin Services page is service requests only. Payment controls removed from it.
6. User Services loads active services + current charge automatically.
7. New service request automatically gets payment amount from the current service charge (when charge > 0).
8. Existing PayU Edge Functions, YouTube management, login and refresh flow are untouched.

REQUIRED:
Supabase > SQL Editor > run SERVICE-CHARGE-SETUP.sql once.
Then upload the included web files.
