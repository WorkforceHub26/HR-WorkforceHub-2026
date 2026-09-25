Bell notification read-state persistence fix

Files to overwrite:
- js/auth-guard.js
- js/index-user.js
- js/leave-history.js

What changed:
1. Notification read-state is scoped per user with pvt_user_notification_read_state_<userId>.
2. Global logout preserves only notification read-state while clearing auth/session data.
3. index-user and leave-history share the same read-state format.
4. Supabase update results are checked for errors; local read-state remains valid even if DB update fails.
5. Mark-all stores a lastReadAt timestamp so old generated leave-status notifications do not return after login.
