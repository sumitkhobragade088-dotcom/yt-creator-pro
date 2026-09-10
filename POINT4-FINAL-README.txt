YT Creator Pro — Point 4 Final Connection Build

This build includes:
- Existing Supabase customer login/register
- Secure Admin login/dashboard
- Connect YouTube Channel button
- Google OAuth youtube.force-ssl permission
- PKCE + OAuth state protection
- Callback -> Supabase youtube-oauth Edge Function
- Channel details displayed after successful connection
- No Google Client Secret in frontend files

Test flow:
1. Upload all files to GitHub.
2. Login to creator account.
3. Dashboard -> Connect YouTube Channel.
4. Sign in with the Google test-user account that owns the YouTube channel.
5. Approve Google permission.
6. Callback should show "YouTube Connected".
