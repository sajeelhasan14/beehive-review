-- Beehive Reviews: upgrade requests from the Tier 1 wall, and Google Sheet sync status.
-- Applied by `npm run db:migrate`.

-- Set when a client taps "Upgrade" on their dashboard wall. Cleared when the admin changes tier or turns the dashboard on.
alter table public.clients add column upgrade_requested_at timestamptz;

-- Last Google Sheet error for this client (create or append). Null = working or not set up yet.
alter table public.clients add column sheet_error text;
