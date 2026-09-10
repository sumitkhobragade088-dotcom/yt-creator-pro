create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Run this after replacing ADMIN_USER_UUID with your actual Supabase Auth admin user UUID:
-- insert into public.admin_users(user_id) values ('ADMIN_USER_UUID') on conflict do nothing;
