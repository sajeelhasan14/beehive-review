-- Beehive Reviews: logins (our own auth, no outside service).
-- Applied by `npm run db:migrate`.

-- One row per person who can sign in.
--   admin  = Mario / EMRG ops, sees every client (client_id empty)
--   client = a business owner or manager, sees only their own client
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null check (email = lower(email) and email like '%_@_%'),
  name          text not null,
  password_hash text not null,      -- scrypt hash from lib/auth/password.ts, never the password
  role          text not null check (role in ('admin', 'client')),
  client_id     uuid references public.clients (id) on delete cascade,
  disabled_at   timestamptz,        -- set = can't sign in, existing sessions stop working
  created_at    timestamptz not null default now(),
  constraint users_role_matches_client check (
    (role = 'admin' and client_id is null) or (role = 'client' and client_id is not null)
  )
);
create unique index users_email_key on public.users (email);

-- One row per signed in browser. The cookie holds a random code; we store only its SHA-256 hash,
-- so someone reading this table still can't use a session.
create table public.sessions (
  id         text primary key,      -- sha256(cookie code), hex
  user_id    uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user_id_idx on public.sessions (user_id);

-- Every sign in attempt, used to block password guessing (5 failures in 15 minutes).
create table public.login_attempts (
  id         bigint generated always as identity primary key,
  email      text not null,
  success    boolean not null,
  created_at timestamptz not null default now()
);
create index login_attempts_email_created_idx on public.login_attempts (email, created_at desc);
