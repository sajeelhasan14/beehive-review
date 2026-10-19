import 'server-only';
import { db } from '@/lib/db';
import type { CopySlots, FontPairing, FunnelView, Template } from '@/lib/funnel/render';

// The columns the query below returns (tables in db/migrations/0001_init.sql).
interface FunnelRow {
  slug: string;
  template: Template;
  font_pairing: FontPairing;
  brand_accent: string;
  logo_url: string | null;
  rating_question: string | null;
  unhappy_message: string | null;
  copy_slots: CopySlots;
  birthday_active: boolean;
  okay_routes_happy: boolean;
  client_name: string;
  vertical: 'hospitality' | 'dental';
  brand_color: string;
  review_link: string;
}

// Returns the funnel ready for renderFunnel(), or null if it doesn't exist or is paused.
export async function getLiveFunnel(slug: string): Promise<FunnelView | null> {
  const { rows } = await db().query<FunnelRow>(
    `select f.slug, f.template, f.font_pairing, f.brand_accent, f.logo_url, f.rating_question,
            f.unhappy_message, f.copy_slots, f.birthday_active, f.okay_routes_happy,
            c.name as client_name, c.vertical, c.brand_color, c.review_link
       from funnels f
       join clients c on c.id = f.client_id
      where f.slug = $1 and f.status = 'live' and c.status = 'active'`,
    [slug],
  );
  const row = rows[0];
  if (!row) return null;

  return {
    slug: row.slug,
    client_name: row.client_name,
    logo_url: row.logo_url,
    brand_primary: row.brand_color,
    brand_accent: row.brand_accent,
    font_pairing: row.font_pairing,
    industry: row.vertical === 'dental' ? 'dental' : 'restaurant',
    template: row.template,
    climbo_url: row.review_link,
    birthday_active: row.birthday_active,
    okay_routes_happy: row.okay_routes_happy,
    rating_question: row.rating_question,
    unhappy_message: row.unhappy_message,
    copy_slots: row.copy_slots ?? {},
  };
}
