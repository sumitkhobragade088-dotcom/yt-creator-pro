# Khobragade.online — FINAL LOCK

This package was cleaned from the current uploaded project only.

## Locked structure
- Public website: `index.html`
- User pages: `login.html`, `register.html`, `dashboard.html`, `contact.html`
- Admin: `admin/index.html`, `admin/login.html`, `admin/manage-channel.html`
- Canonical frontend assets: `assets/`
- Supabase Edge Functions: `supabase/functions/`
- Database SQL files are retained as deployment/migration material and were not deleted merely because they have historical names.

## Cleanup
- Removed duplicate root HTML copies.
- Removed duplicate root JS/CSS/SVG copies when canonical `assets/` copies exist.
- Removed obsolete root TypeScript scratch copies.
- Removed historical fix-note TXT clutter.
- Kept required Admin Manage Channel files.

## Important
This lock verifies package structure and static consistency. Live Supabase, OAuth, YouTube API, PayU and production hosting behavior still require deployment/runtime verification.
