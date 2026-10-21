-- Beehive Reviews: one row per time a customer opens a funnel page (the QR code scan), so the
-- client dashboard can show scans -> ratings -> sent to Google. Written by app/c/[slug]/route.ts.
-- Applied by `npm run db:migrate`.
create table public.funnel_scans (
  id         uuid primary key default gen_random_uuid(),
  funnel_id  uuid not null references public.funnels (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index funnel_scans_client_created_idx on public.funnel_scans (client_id, created_at desc);
