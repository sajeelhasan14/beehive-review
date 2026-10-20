-- Beehive Reviews: look options for the customer funnel, set in the admin page editor
-- (header style, cover photo, logo shape, rating style, corners, background, footer).
-- Keys and defaults: FunnelStyle / STYLE_DEFAULTS in lib/funnel/render.ts. Applied by `npm run db:migrate`.
alter table public.funnels add column style jsonb not null default '{}'::jsonb;
