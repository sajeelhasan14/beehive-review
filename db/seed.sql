-- Mario's 5 live clients and their funnels (from beehive-multitenant-demo.html and kyma.html).
-- Applied by `npm run db:seed`. Safe to run twice: existing slugs are skipped.

insert into public.clients (slug, name, vertical, tier, dashboard_enabled, avg_ticket, brand_color, review_link) values
  ('amber-room',    'Amber Room',        'hospitality', 3, true,  85,  '#E8B54D', 'https://review.beehivereviews.com/amber-room?r=69d918dae9332b25cb179f12'),
  ('kyma',          'Kyma',              'hospitality', 2, true,  70,  '#1C6EA4', 'https://review.beehivereviews.com/kyma?r=69d91c3e24ec40b0973863f0'),
  ('sony-hall',     'Sony Hall',         'hospitality', 2, true,  60,  '#E50914', 'https://review.beehivereviews.com/sony-hall?r=69d91fb5a6af8c0a88b5f423'),
  ('crumbly',       'Crumbly Bake Shop', 'hospitality', 1, false, 18,  '#D98BA0', 'https://review.beehivereviews.com/crumbly-cafe---bakery?r=69d9208f7421e4eb916e08f5'),
  ('sachar-dental', 'Sachar Dental NYC', 'dental',      3, true,  400, '#0E9AA7', 'https://review.beehivereviews.com/sachar-dental-nyc?r=69d928da24ec40b0973869c7')
on conflict (slug) do nothing;

insert into public.funnels (client_id, slug, template, font_pairing, brand_accent, rating_question, unhappy_message, copy_slots)
select c.id, c.slug || '-review', v.template, v.font_pairing, v.brand_accent, v.question, v.unhappy, v.slots::jsonb
from (values
  ('amber-room',    'midnight', 'classic',   '#1A1815', 'How was your night at Amber Room?', null, '{}'),
  ('kyma',          'midnight', 'classic',   '#F0EAD6', 'How was your meal today?',          null,
     '{"reassure":"Every review is read by our team. Thank you for dining with us."}'),
  ('sony-hall',     'midnight', 'classic',   '#1A1815', 'How was your night at Sony Hall?',  null, '{}'),
  ('crumbly',       'midnight', 'classic',   '#1A1815', 'How was your treat today?',         null, '{}'),
  ('sachar-dental', 'ivory',    'editorial', '#1B4965', 'How was your visit today?',
     'Thank you for sharing. Our office manager will follow up with you personally.',
     '{"club_headline":"Join our patient perks list","club_sub":"Leave your info for reminders, offers, and a birthday surprise.","reassure":"Your comfort is everything to us. Every review is read by the doctor and the team."}')
) as v (client_slug, template, font_pairing, brand_accent, question, unhappy, slots)
join public.clients c on c.slug = v.client_slug
on conflict (slug) do nothing;
