YT Creator Pro — Direct Staff Create

1) Run STAFF-DIRECT-CREATE-TOTAL-LOCK.sql in Supabase SQL Editor.
2) Deploy supabase/functions/create-admin-staff/index.ts as create-admin-staff.
3) Replace admin/index.html, assets/js/admin-control-suite.js and assets/js/admin-auth.js.
4) Admin Control Suite > Roles & Permissions > Create Staff Account.
5) Staff logs in from the same Admin Login page with the created email/password.
6) Staff list shows Role, Activity (Active/Inactive/Suspended), Save and Delete.
7) Delete removes Admin authorization/role only; it does not delete the Supabase Auth account.
8) Super Admin account is protected from status/delete actions.
