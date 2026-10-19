-- Beehive Reviews: Phase 1 business tables (Railway Postgres).
-- Applied by `npm run db:migrate` (scripts/migrate.mjs). Never edit after it has run on a real database:
-- add a new numbered file instead (0002_..., 0003_...).

-- ============ TABLES ============

-- One row per business (restaurant, bar, dental office).
create table public.clients (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name              text not null,
  vertical          text not null check (vertical in ('hospitality', 'dental')),
  tier              smallint not null default 2 check (tier between 1 and 3),
  dashboard_enabled boolean not null default true,
  avg_ticket        numeric(10, 2) not null default 0,   -- for the money view
  brand_color       text not null default '#E8B54D',
  review_link       text not null check (review_link ~ '^https?://'),  -- Climbo or Google
  google_sheet_id   text,                                -- filled in Step 7
  status            text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  created_at        timestamptz not null default now()
);

-- One row per funnel (the QR page). One client can have several later (multi location).
create table public.funnels (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete cascade,
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),  -- URL: /c/{slug}
  template          text not null default 'midnight' check (template in ('midnight', 'ivory', 'marquee', 'trade')),
  font_pairing      text not null default 'classic' check (font_pairing in ('classic', 'modern', 'editorial', 'bold', 'quiet', 'trade')),
  brand_accent      text not null default '#1A1815',
  logo_url          text,
  rating_question   text,           -- blank = default question
  unhappy_message   text,           -- blank = default message
  copy_slots        jsonb not null default '{}'::jsonb,  -- optional wording overrides
  birthday_active   boolean not null default true,
  okay_routes_happy boolean not null default false,       -- true = a 3 rating counts as happy
  status            text not null default 'live' check (status in ('draft', 'live', 'paused')),
  created_at        timestamptz not null default now()
);
create index funnels_client_id_idx on public.funnels (client_id);

-- One row per person per client. Same phone at two clients = two separate rows (tenant isolation).
create table public.contacts (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete cascade,
  phone            text not null check (phone ~ '^[0-9]{10}$'),
  first_name       text,
  last_name        text,
  email            text,
  birthday_month   smallint check (birthday_month between 1 and 12),
  birthday_day     smallint check (birthday_day between 1 and 31),
  sms_consent      boolean not null default false,
  sms_consent_at   timestamptz,     -- proof of when they agreed
  sms_opted_out_at timestamptz,     -- set when they reply STOP (Phase 2)
  visits           integer not null default 1,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  unique (client_id, phone)
);

-- One row per rating that was submitted.
create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  funnel_id     uuid not null references public.funnels (id) on delete cascade,
  contact_id    uuid references public.contacts (id) on delete set null,
  rating        smallint not null check (rating between 1 and 5),
  path          text not null check (path in ('happy', 'unhappy')),
  first_name    text,               -- as typed this time (unhappy people may skip the phone)
  phone         text,
  feedback_text text,
  resolved_at   timestamptz,        -- unhappy alert marked resolved
  created_at    timestamptz not null default now()
);
create index submissions_client_created_idx on public.submissions (client_id, created_at desc);

-- ============ SAVE A FUNNEL SUBMISSION (one step, all or nothing) ============
-- Called by /api/public/submit. Finds the live funnel, creates or updates the contact
-- (visits + 1), saves the rating, and says whether this phone has been here before.

create function public.record_submission(
  p_funnel_slug    text,
  p_rating         smallint,
  p_path           text,
  p_first_name     text,
  p_last_name      text,
  p_phone          text,
  p_email          text,
  p_birthday_month smallint,
  p_birthday_day   smallint,
  p_sms_consent    boolean,
  p_feedback_text  text
) returns jsonb
language plpgsql as $$
declare
  v_client_id uuid;
  v_funnel_id uuid;
  v_contact   public.contacts%rowtype;
begin
  select f.id, f.client_id into v_funnel_id, v_client_id
  from public.funnels f
  join public.clients c on c.id = f.client_id
  where f.slug = p_funnel_slug and f.status = 'live' and c.status = 'active';

  if v_funnel_id is null then
    raise exception 'funnel_not_found' using errcode = 'P0002';
  end if;

  -- Only a full 10 digit phone becomes a contact. Blank fields never wipe saved ones.
  if p_phone ~ '^[0-9]{10}$' then
    insert into public.contacts as ct
      (client_id, phone, first_name, last_name, email, birthday_month, birthday_day, sms_consent, sms_consent_at)
    values
      (v_client_id, p_phone, p_first_name, p_last_name, p_email, p_birthday_month, p_birthday_day,
       coalesce(p_sms_consent, false), case when p_sms_consent then now() end)
    on conflict (client_id, phone) do update set
      first_name     = coalesce(excluded.first_name, ct.first_name),
      last_name      = coalesce(excluded.last_name, ct.last_name),
      email          = coalesce(excluded.email, ct.email),
      birthday_month = coalesce(excluded.birthday_month, ct.birthday_month),
      birthday_day   = coalesce(excluded.birthday_day, ct.birthday_day),
      sms_consent    = ct.sms_consent or excluded.sms_consent,
      sms_consent_at = case when excluded.sms_consent and not ct.sms_consent then now() else ct.sms_consent_at end,
      visits         = ct.visits + 1,
      last_seen_at   = now()
    returning * into v_contact;
  end if;

  insert into public.submissions
    (client_id, funnel_id, contact_id, rating, path, first_name, phone, feedback_text)
  values
    (v_client_id, v_funnel_id, v_contact.id, p_rating, p_path, p_first_name, p_phone, p_feedback_text);

  return jsonb_build_object(
    'returning_visitor', coalesce(v_contact.visits > 1, false),
    'first_name',        coalesce(v_contact.first_name, p_first_name)
  );
end;
$$;
