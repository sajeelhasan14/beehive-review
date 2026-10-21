-- Beehive Reviews: how each client's dashboard looks, set by EMRG from the admin bar on /d/{slug}.
-- dashboard_theme = light or dark, dashboard_style = layout, dashboard_sample = show made up demo numbers.
-- Applied by `npm run db:migrate`.
alter table public.clients
  add column dashboard_theme text not null default 'light' check (dashboard_theme in ('light', 'dark')),
  add column dashboard_style text not null default 'classic' check (dashboard_style in ('classic', 'spotlight', 'tiles')),
  add column dashboard_sample boolean not null default false;
