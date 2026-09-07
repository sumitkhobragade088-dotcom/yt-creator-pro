YT Creator Pro - Multi Service Update

Included related files only.

1) Admin Free User Service:
   Customer -> YouTube Channel -> multiple services -> Select All -> Grant Free Service.
2) User Dashboard Services:
   Multiple services -> Select All -> one combined payment request.
3) Database:
   Run MULTI-SERVICE-REQUESTS-SETUP.sql after the existing PAID-REQUEST-FLOW-SETUP.sql.
   It keeps the existing service_requests/payments tables and calculates the combined active service charges.
4) If FREE-USER-SERVICE-SETUP.sql has not been run yet, run it once before using the Admin Free User Service page.

No PayU credentials or existing channel/auth configuration is changed.
