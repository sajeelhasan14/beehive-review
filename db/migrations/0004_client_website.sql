-- Beehive Reviews: the client's own website, read in Add client to set their funnel's look.
-- Applied by `npm run db:migrate`.
alter table public.clients add column website text check (website ~ '^https?://');
