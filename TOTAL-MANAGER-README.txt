YT Creator Pro - TOTAL YouTube Manager

Included:
- Channel stats + description/keywords update
- Existing video list
- Video title/description/tags/category/privacy update
- Thumbnail update
- Video delete
- Resumable new video upload
- Playlist create/update/list
- Refresh/sync
- Admin-only backend check using admin_users.id
- OAuth refresh-token handling stays server-side
- Copyright/Restrictions panel: exact copyright claims are NOT exposed by YouTube Data API.
  The UI shows API-visible restrictions/status and clearly directs exact claim checks to YouTube Studio.

IMPORTANT:
1) Replace/upload website files to GitHub.
2) Replace youtube-manage Edge Function code with supabase/functions/youtube-manage/index.ts and Deploy.
3) Keep Verify JWT OFF (function verifies the Supabase session itself).
4) GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets must already be correct.
5) Existing OAuth scope youtube.force-ssl supports these management operations.
