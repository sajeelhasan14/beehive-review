import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

// AI smart fill for "+ Add client": one sentence about a business -> the form fields.
// Optional: without ANTHROPIC_API_KEY (or if the call fails) the form uses the instant
// pattern fill in add-client.tsx instead, so the factory always works.

const Fields = z.object({
  name: z.string().describe('Business name exactly as written'),
  vertical: z.enum(['hospitality', 'dental']).describe('dental for dentists/orthodontists/dental offices, otherwise hospitality'),
  review_link: z.string().describe('The review URL if one is given, else ""'),
  tier: z.enum(['1', '2', '3', '']).describe('Plan if stated: Capture or tier 1 = "1", Command or tier 2 = "2", Revenue or tier 3 = "3", else ""'),
  avg_ticket: z.string().describe('Average ticket or visit value in whole dollars, digits only, if stated, else ""'),
  owner_name: z.string().describe('Owner or manager name if given, else ""'),
  owner_email: z.string().describe('Owner or manager email if given, else ""'),
  rating_question: z.string().describe('A short, warm rating question for their QR page, under 60 characters'),
  brand_color: z.string().describe('A #RRGGBB color only if the text names a brand color, else ""'),
});

export type SmartFields = z.infer<typeof Fields>;

const SYSTEM = `You fill in the new client form for Beehive Reviews, a QR review funnel for restaurants, bars, lounges, clubs and dental offices.
Read the admin's description and return the fields. Never invent a review link, email, tier or price: use "" when the text doesn't say.
For rating_question, write one in the business's voice if none is given, e.g. "How was your night at Amber Room?" for a lounge or "How was your visit today?" for a dental office.`;

let client: Anthropic | undefined;

export async function aiSmartFill(description: string): Promise<SmartFields | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 });

  const response = await client.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: 'user', content: description }],
    output_config: { effort: 'low', format: zodOutputFormat(Fields) },
  });

  if (response.stop_reason === 'refusal') return null;
  return response.parsed_output ?? null;
}
