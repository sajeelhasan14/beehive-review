'use client';

import { createContext, use, useActionState, useState, useTransition, type ReactNode } from 'react';
import { createClient, findOnGoogle, publishFunnel, readClientWebsite, smartFillWithAi } from './actions';
import type { GooglePlace } from '@/lib/google/places';
import { PasswordOnce } from './add-login';

// "+ Add client" from the demo's factory: describe -> fill -> save as draft -> preview -> publish.

const EXAMPLE =
  'EXAMPLE: Figlia & Sons, Italian restaurant in Midtown, warm family feel, review link https://review.beehivereviews.com/figlia---sons?r=69d92b934280d6dd661ab03b, tier 2, average ticket 65';

const EMPTY = {
  website: '',
  logo_url: '',
  font_pairing: '',
  template: '',
  name: '',
  vertical: 'hospitality',
  review_link: '',
  tier: '2',
  avg_ticket: '',
  brand_color: '#E8B54D',
  rating_question: '',
  owner_name: '',
  owner_email: '',
};
type Fields = typeof EMPTY;

// The demo's smartFill(): pulls the obvious pieces out of one sentence, instantly, in the browser.
// Used when the AI fill isn't available (no ANTHROPIC_API_KEY on the server, or it failed).
function smartFill(text: string): Partial<Fields> {
  const t = text.replace(/^EXAMPLE:\s*/i, '');
  const found: Partial<Fields> = {
    name: t.split(',')[0].trim(),
    review_link: t.match(/https?:\/\/[^\s,]+/)?.[0] ?? '',
    tier: t.match(/tier\s*([123])/i)?.[1] ?? (/\bcapture\b/i.test(t) ? '1' : /\bcommand\b/i.test(t) ? '2' : /\brevenue\b/i.test(t) ? '3' : ''),
    avg_ticket: t.match(/(?:ticket|visit|average)\D{0,12}(\d{2,4})/i)?.[1] ?? '',
    owner_email: t.match(/[^\s,@]+@[^\s,@]+\.[a-z]{2,}/i)?.[0] ?? '',
    vertical: /dent|dds|orthodont|smile/i.test(t) ? 'dental' : 'hospitality',
  };
  return Object.fromEntries(Object.entries(found).filter(([, v]) => v));
}

// AI answers go through the same checks as typed input: anything that doesn't look right is left blank.
function keepValid(ai: Partial<Fields>): Partial<Fields> {
  const ok: Partial<Fields> = {
    ...ai,
    review_link: /^https?:\/\/\S+$/.test(ai.review_link ?? '') ? ai.review_link : '',
    owner_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ai.owner_email ?? '') ? ai.owner_email : '',
    brand_color: /^#[0-9a-f]{6}$/i.test(ai.brand_color ?? '') ? ai.brand_color : '',
    avg_ticket: /^\d{1,6}$/.test(ai.avg_ticket ?? '') ? ai.avg_ticket : '',
  };
  return Object.fromEntries(Object.entries(ok).filter(([k, v]) => v && k in EMPTY));
}

const input = 'w-full rounded-[10px] border px-3.5 py-3 text-[15px] text-text placeholder:text-dim focus:border-text';
const button = 'rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium hover:border-dim disabled:opacity-60';
const primary = 'rounded-lg border border-text bg-text px-3.5 py-2 text-[13px] font-semibold text-bg disabled:opacity-60';
const bigPrimary = 'rounded-xl bg-text px-6 py-3 text-[15px] font-semibold text-bg hover:opacity-90 disabled:opacity-60';

// Plan prices per type of business (from the handoff's tier tables).
const PLANS = [
  { tier: '1', name: 'Capture', adds: 'QR funnel, review routing and the contact list.', price: { hospitality: 299, dental: 499 } },
  { tier: '2', name: 'Command', adds: 'Adds the dashboard, unhappy alerts and birthday texts.', price: { hospitality: 499, dental: 999 } },
  { tier: '3', name: 'Revenue', adds: 'Adds win back texts, blasts and the money report.', price: { hospitality: 799, dental: 1499 } },
] as const;

const FONT_STYLES = [
  { value: 'classic', label: 'Classic serif', sample: 'Playfair Display' },
  { value: 'quiet', label: 'Quiet serif', sample: 'Libre Baskerville' },
  { value: 'editorial', label: 'Editorial serif', sample: 'Fraunces' },
  { value: 'modern', label: 'Modern sans', sample: 'Space Grotesk' },
  { value: 'bold', label: 'Bold display', sample: 'Archivo Black' },
] as const;

const THEMES = [
  { value: 'midnight', label: 'Dark' },
  { value: 'ivory', label: 'Light' },
  { value: 'marquee', label: 'Nightlife' },
] as const;

const DEFAULTS = {
  hospitality: { ticket: 60, question: 'How was your visit?' },
  dental: { ticket: 400, question: 'How was your visit today?' },
} as const;

// The button sits in the tab row and the form opens below it, so the two share open/closed state.
const OpenContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

export function AddClientProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <OpenContext value={{ open, setOpen }}>{children}</OpenContext>;
}

function useOpen() {
  const ctx = use(OpenContext);
  if (!ctx) throw new Error('AddClient must be inside AddClientProvider');
  return ctx;
}

export function AddClient() {
  const { open, setOpen } = useOpen();
  if (open) return null;
  return (
    <button type="button" onClick={() => setOpen(true)} className={primary}>
      Add client
    </button>
  );
}

export function AddClientSlot({ googleSearch }: { googleSearch: boolean }) {
  const { open, setOpen } = useOpen();
  const [round, setRound] = useState(0); // new number = fresh empty form ("Add another")
  if (!open) return null;
  return <Factory key={round} googleSearch={googleSearch} onClose={() => setOpen(false)} onAnother={() => setRound((r) => r + 1)} />;
}

function Factory({ googleSearch, onClose, onAnother }: { googleSearch: boolean; onClose: () => void; onAnother: () => void }) {
  const [state, formAction, saving] = useActionState(createClient, undefined);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [filled, setFilled] = useState<string[]>([]);
  const [smart, setSmart] = useState('');
  const [note, setNote] = useState('');
  const [more, setMore] = useState(false);
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publishing, startPublish] = useTransition();
  const [filling, startFill] = useTransition();
  const [reading, startRead] = useTransition();
  const [siteNote, setSiteNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [fontName, setFontName] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const [placeQuery, setPlaceQuery] = useState<string | null>(null); // null = follow the business name
  const [places, setPlaces] = useState<GooglePlace[] | null>(null);
  const [placeNote, setPlaceNote] = useState('');
  const [searching, startSearch] = useTransition();

  const [, startSave] = useTransition();

  const set = (key: keyof Fields) => (e: { target: { value: string } }) => setFields((f) => ({ ...f, [key]: e.target.value }));
  // Fields the quick fill wrote get a soft green tint until the admin edits them.
  const tint = (key: string) => (filled.includes(key) ? 'border-ok/60 bg-ok/5' : 'border-border bg-surface');
  const vertical = fields.vertical === 'dental' ? 'dental' : 'hospitality';
  const defaults = DEFAULTS[vertical];

  function fill() {
    if (!smart.trim()) return setNote('Paste a few details first, or try the example.');
    setNote('');
    startFill(async () => {
      const ai = await smartFillWithAi(smart.replace(/^EXAMPLE:\s*/i, '')).catch(() => null);
      const found = ai ? keepValid(ai) : smartFill(smart);
      setFields((f) => ({ ...f, ...found }));
      setFilled(Object.keys(found));
      if (found.avg_ticket || found.rating_question || found.brand_color) setMore(true);
      setNote(`Filled in ${Object.keys(found).length} fields. Check the green ones below.`);
    });
  }

  function readSite() {
    if (!fields.website.trim()) return setSiteNote({ ok: false, text: 'Type their website address first.' });
    setSiteNote(null);
    startRead(async () => {
      const res = await readClientWebsite(fields.website).catch(() => ({ error: 'Could not read that website. Fill the form by hand.' }));
      if ('error' in res) return setSiteNote({ ok: false, text: res.error });
      const { look } = res;
      const found: Partial<Fields> = Object.fromEntries(
        Object.entries({
          website: look.website,
          logo_url: look.logo_url ?? '',
          brand_color: look.brand_color ?? '',
          font_pairing: look.font_pairing ?? '',
          template: look.template ?? '',
          name: res.fields.name ?? '',
          vertical: res.fields.vertical ?? '',
          rating_question: res.fields.rating_question ?? '',
        }).filter(([, v]) => v),
      );
      setLogoBroken(false);
      setFontName(look.font_name);
      setFields((f) => ({ ...f, ...found }));
      setFilled((prev) => [...new Set([...prev, ...Object.keys(found)])]);
      const missing = [!look.logo_url && 'logo', !look.brand_color && 'brand color'].filter(Boolean);
      setSiteNote({
        ok: true,
        text: missing.length
          ? `Got their look. We couldn’t find a ${missing.join(' or ')}, so set ${missing.length > 1 ? 'those' : 'it'} under More options if you like.`
          : 'Got their look. Check it below and change anything that’s off.',
      });
    });
  }

  function searchGoogle() {
    const q = (placeQuery ?? fields.name).trim();
    setPlaceNote('');
    startSearch(async () => {
      const res = await findOnGoogle(q).catch(() => ({ error: 'Google search failed. Try again.' }));
      if ('error' in res) {
        setPlaces(null);
        return setPlaceNote(res.error);
      }
      setPlaces(res.places);
      if (!res.places.length) setPlaceNote('No match on Google. Add the area, e.g. "Kyma Flatiron NYC".');
    });
  }

  // Step 2 and 3: the draft funnel in a phone frame, then Publish, then what to do next.
  if (state && 'created' in state) {
    const c = state.created;
    const funnelUrl = `${typeof window === 'undefined' ? '' : window.location.origin}/c/${c.funnelSlug}`;
    const kit = `/admin/kit/${c.slug}`;
    return (
      <section className="mb-8 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <Steps at={published ? 3 : 2} />
        <h3 className="font-serif text-[24px] font-bold leading-tight">
          {published ? `${c.name} is live` : `Check ${c.name}’s funnel`}
        </h3>
        <p className="mb-6 mt-1.5 max-w-[60ch] text-[14px] text-dim">
          {published
            ? `Print the QR code and put it ${vertical === 'dental' ? 'at the front desk' : 'on the tables'}. Every scan lands on this funnel.`
            : 'Tap through it like a customer would. Nothing you submit here is saved. Publish when it looks right.'}
        </p>

        <div className="flex flex-wrap items-start gap-8">
          <div className="h-[600px] w-[340px] max-w-full overflow-hidden rounded-[32px] border-[8px] border-text bg-black shadow-sm">
            <iframe src={`/admin/preview/${c.funnelSlug}`} title={`${c.name} funnel preview`} className="size-full" />
          </div>

          <div className="grid max-w-sm flex-1 gap-5">
            {!published ? (
              <div className="grid gap-2">
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => startPublish(async () => {
                    await publishFunnel(c.funnelId);
                    setPublished(true);
                  })}
                  className={bigPrimary}
                >
                  {publishing ? 'Publishing…' : 'Publish funnel'}
                </button>
                <a href={`/admin/funnel/${c.funnelSlug}`} className={button + ' text-center'}>
                  Customize the page first
                </a>
                <a href={`/admin/preview/${c.funnelSlug}`} target="_blank" rel="noreferrer" className="text-center text-[13px] text-dim underline underline-offset-2 hover:text-text">
                  Open the preview in a new tab
                </a>
              </div>
            ) : (
              <>
                <div>
                  <p className="mb-1.5 text-[13px] font-medium">Funnel link</p>
                  <div className="flex gap-2">
                    <input readOnly value={funnelUrl} className={`${input} border-border bg-surface2 py-2 text-[13px]`} />
                    <button
                      type="button"
                      className={button}
                      onClick={() => {
                        navigator.clipboard?.writeText(funnelUrl);
                        setCopied(true);
                      }}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[13px] font-medium">Print kit</p>
                  <div className="flex flex-wrap gap-2">
                    <a href={`${kit}/qr.png`} target="_blank" rel="noreferrer" className={button}>QR code</a>
                    <a href={`${kit}/table-tent.pdf`} target="_blank" rel="noreferrer" className={button}>Table tent</a>
                    <a href={`${kit}/stickers.pdf`} target="_blank" rel="noreferrer" className={button}>Stickers</a>
                  </div>
                </div>
              </>
            )}

            {c.login ? (
              <PasswordOnce login={c.login} />
            ) : (
              <p className="text-[13px] text-dim">No owner login yet. Add one from the client card when you have their email.</p>
            )}

            <div className="flex gap-2 border-t border-border pt-5">
              <button type="button" onClick={onAnother} className={button}>Add another client</button>
              <button type="button" onClick={onClose} className={button}>Done</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    // Submitted by hand, not with action={...}: React resets a form after its action runs, which would snap
    // the controlled fields back to their first option while state still holds the choice.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startSave(() => formAction(data));
      }}
      className="mb-8 rounded-2xl border border-border bg-surface p-6 sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <Steps at={1} />
          <h3 className="font-serif text-[24px] font-bold leading-tight">New client</h3>
        </div>
        <button type="button" onClick={onClose} className="text-[13px] text-dim hover:text-text">Cancel</button>
      </div>

      <div className="mt-6 rounded-xl bg-surface2 p-4 sm:p-5">
        <label htmlFor="website" className="text-[14px] font-medium">Their website</label>
        <p className="mb-3 mt-0.5 text-[13px] text-dim">
          We read it for their name, logo, brand color and fonts, and style the funnel to match.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="website"
            name="website"
            type="text"
            inputMode="url"
            autoComplete="off"
            value={fields.website}
            onChange={set('website')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                readSite();
              }
            }}
            placeholder="figliaandsons.com"
            className={`${input} flex-1 ${tint('website')}`}
          />
          <button type="button" onClick={readSite} disabled={reading} className={`${primary} shrink-0 px-5 sm:py-3`}>
            {reading ? 'Reading their site…' : 'Get their look'}
          </button>
        </div>
        {siteNote && (
          <p role="status" className={`mt-2 text-[13px] ${siteNote.ok ? 'text-ok' : 'text-alert'}`}>{siteNote.text}</p>
        )}

        {(fields.logo_url || fields.font_pairing || fields.template || filled.includes('brand_color')) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4">
            <span
              className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-surface2 font-serif text-xl font-bold"
              style={{ borderColor: fields.brand_color }}
            >
              {fields.logo_url && !logoBroken ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote logo from the client's own site
                <img src={fields.logo_url} alt="" className="size-full bg-white object-contain p-1.5" onError={() => setLogoBroken(true)} />
              ) : (
                (fields.name || '?').charAt(0)
              )}
            </span>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
              <dt className="text-dim">Brand color</dt>
              <dd className="flex items-center gap-2">
                <span className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: fields.brand_color }} />
                <span className="tabular-nums">{fields.brand_color.toUpperCase()}</span>
              </dd>
              <dt className="text-dim">Fonts</dt>
              <dd>
                {FONT_STYLES.find((f) => f.value === fields.font_pairing)?.label ?? 'Default for this type'}
                {fontName && <span className="text-dim"> (their site uses {fontName})</span>}
              </dd>
              <dt className="text-dim">Funnel</dt>
              <dd>{THEMES.find((t) => t.value === fields.template)?.label ?? 'Default'} theme</dd>
            </dl>
            <button type="button" onClick={() => setMore(true)} className="text-[13px] text-dim underline underline-offset-2 hover:text-text sm:ml-auto">
              Change
            </button>
          </div>
        )}

        <div className="mt-4 border-t border-border pt-3">
          {!showPaste ? (
            <button type="button" onClick={() => setShowPaste(true)} className="text-[13px] text-dim underline underline-offset-2 hover:text-text">
              No website? Paste a note about them instead
            </button>
          ) : (
            <>
              <label htmlFor="quick" className="text-[13px] font-medium">Paste a note</label>
              <p className="mb-2 mt-0.5 text-[12px] text-dim">
                An email, a message, anything with their details.{' '}
                <button type="button" className="text-text underline underline-offset-2" onClick={() => { setSmart(EXAMPLE); setNote(''); }}>
                  Try an example
                </button>
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <textarea
                  id="quick"
                  rows={2}
                  value={smart}
                  onChange={(e) => setSmart(e.target.value)}
                  placeholder="Figlia & Sons, Italian restaurant, review link https://…, Command plan, owner maria@figlia.com"
                  className="min-h-[52px] flex-1 resize-y rounded-[10px] border border-border bg-surface px-3.5 py-3 text-[14px] leading-relaxed placeholder:text-dim focus:border-text"
                />
                <button type="button" onClick={fill} disabled={filling} className={`${button} shrink-0 px-5 sm:self-start sm:py-3`}>
                  {filling ? 'Filling in…' : 'Fill in for me'}
                </button>
              </div>
              {note && <p role="status" className="mt-2 text-[13px] text-ok">{note}</p>}
            </>
          )}
        </div>
      </div>

      <div className="mt-8 grid max-w-[760px] gap-8">
        <Group title="The business">
          <Field label="Business name">
            <input name="name" required value={fields.name} onChange={set('name')} placeholder="Figlia & Sons" className={`${input} ${tint('name')}`} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium">Type of business</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'hospitality', label: 'Restaurant, bar or club' },
                { value: 'dental', label: 'Dental office' },
              ].map((o) => (
                <label
                  key={o.value}
                  className={`cursor-pointer rounded-[10px] border px-4 py-3 text-[14px] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-text ${
                    fields.vertical === o.value ? 'border-text bg-text text-bg' : 'border-border bg-surface hover:border-dim'
                  }`}
                >
                  <input type="radio" name="vertical" value={o.value} checked={fields.vertical === o.value} onChange={set('vertical')} className="sr-only" />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
        </Group>

        <Group title="Where happy customers go">
          {googleSearch && (
            <div className="rounded-xl border border-border p-4">
              <label htmlFor="place-search" className="text-[13px] font-medium">Find them on Google</label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  id="place-search"
                  type="search"
                  value={placeQuery ?? fields.name}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      searchGoogle();
                    }
                  }}
                  placeholder="Business name and area, e.g. Kyma Flatiron NYC"
                  className={`${input} flex-1 border-border bg-surface`}
                />
                <button type="button" onClick={searchGoogle} disabled={searching} className={`${button} shrink-0 sm:py-3`}>
                  {searching ? 'Searching…' : 'Search Google'}
                </button>
              </div>
              {placeNote && <p className="mt-2 text-[13px] text-alert">{placeNote}</p>}
              {places && places.length > 0 && (
                <ul className="mt-3 divide-y divide-border rounded-[10px] border border-border">
                  {places.map((p) => {
                    const chosen = fields.review_link === p.reviewLink;
                    return (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-medium">{p.name}</div>
                          <div className="truncate text-[12px] text-dim">{p.address}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFields((f) => ({ ...f, review_link: p.reviewLink }));
                            setFilled((prev) => [...new Set([...prev, 'review_link'])]);
                          }}
                          className={chosen ? `${primary} shrink-0` : `${button} shrink-0`}
                        >
                          {chosen ? 'Chosen' : 'Use this'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          <Field
            label="Review link"
            hint={
              googleSearch
                ? 'Filled when you pick a Google match, or paste a Climbo link. 4 and 5 star ratings are sent here.'
                : 'Paste the Climbo or Google review link. 4 and 5 star ratings are sent here.'
            }
          >
            <input name="review_link" type="url" required value={fields.review_link} onChange={set('review_link')} placeholder="https://review.beehivereviews.com/…" className={`${input} ${tint('review_link')}`} />
          </Field>
          {fields.review_link && /^https?:\/\//.test(fields.review_link) && (
            <a href={fields.review_link} target="_blank" rel="noreferrer" className="-mt-2 text-[13px] text-dim underline underline-offset-2 hover:text-text">
              Open the review link to check it
            </a>
          )}
        </Group>

        <Group title="Plan">
          <div className="grid gap-2 sm:grid-cols-3">
            {PLANS.map((p) => {
              const on = fields.tier === p.tier;
              return (
                <label
                  key={p.tier}
                  className={`cursor-pointer rounded-xl border p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-text ${
                    on ? `ring-1 ring-text ${filled.includes('tier') ? 'border-ok/60 bg-ok/5' : 'border-text bg-surface'}` : 'border-border bg-surface hover:border-dim'
                  }`}
                >
                  <input type="radio" name="tier" value={p.tier} checked={on} onChange={set('tier')} className="sr-only" />
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-serif text-[17px] font-bold">{p.name}</span>
                    <span className="figure text-[15px] font-bold">${p.price[vertical].toLocaleString('en-US')}<span className="font-sans text-xs font-normal text-dim">/mo</span></span>
                  </span>
                  <span className="mt-1.5 block text-[13px] leading-snug text-dim">{p.adds}</span>
                </label>
              );
            })}
          </div>
        </Group>

        <Group title="Owner login" optional hint="Gives the owner their own dashboard. We make the password and show it once on the next screen.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Owner name">
              <input name="owner_name" value={fields.owner_name} onChange={set('owner_name')} placeholder="Maria Rossi" className={`${input} ${tint('owner_name')}`} />
            </Field>
            <Field label="Owner email">
              <input name="owner_email" type="email" value={fields.owner_email} onChange={set('owner_email')} placeholder="maria@figlia.com" className={`${input} ${tint('owner_email')}`} />
            </Field>
          </div>
        </Group>

        <details open={more} onToggle={(e) => setMore(e.currentTarget.open)} className="group rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-[14px] font-medium">
            More options
            <span className="text-[13px] font-normal text-dim">Look, average spend, question</span>
          </summary>
          <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Logo" hint="A link to their logo image. Blank shows their first letter in their brand color.">
                <input name="logo_url" type="url" value={fields.logo_url} onChange={(e) => { setLogoBroken(false); set('logo_url')(e); }} placeholder="https://…/logo.png" className={`${input} ${tint('logo_url')}`} />
              </Field>
            </div>
            <Field label="Fonts">
              <select name="font_pairing" value={fields.font_pairing} onChange={set('font_pairing')} className={`${input} ${tint('font_pairing')}`}>
                <option value="">Default for this type</option>
                {FONT_STYLES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label} ({f.sample})</option>
                ))}
              </select>
            </Field>
            <Field label="Funnel theme">
              <select name="template" value={fields.template} onChange={set('template')} className={`${input} ${tint('template')}`}>
                <option value="">Default for this type</option>
                {THEMES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Average spend per visit" hint={`Used for the money estimate. Blank uses $${defaults.ticket}.`}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim">$</span>
                <input name="avg_ticket" type="number" min="0" inputMode="numeric" value={fields.avg_ticket} onChange={set('avg_ticket')} placeholder={String(defaults.ticket)} className={`${input} pl-7 ${tint('avg_ticket')}`} />
              </div>
            </Field>
            <Field label="Brand color" hint="Used on their dashboard and print kit.">
              <div className={`flex items-center gap-3 rounded-[10px] border px-2 py-1.5 ${tint('brand_color')}`}>
                <input name="brand_color" type="color" value={fields.brand_color} onChange={set('brand_color')} aria-label="Pick brand color" className="h-9 w-12 cursor-pointer rounded-md border-0 bg-transparent p-0" />
                <span className="font-medium tabular-nums uppercase">{fields.brand_color}</span>
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Rating question" hint="The first thing customers read. Blank uses the default shown.">
                <input name="rating_question" value={fields.rating_question} onChange={set('rating_question')} placeholder={defaults.question} className={`${input} ${tint('rating_question')}`} />
              </Field>
            </div>
          </div>
        </details>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-border pt-6">
        <button type="submit" disabled={saving} className={bigPrimary}>
          {saving ? 'Saving…' : 'Preview funnel'}
        </button>
        <span className="text-[13px] text-dim">Saved as a draft. Nothing goes live until you publish.</span>
        {state && 'error' in state && <p role="alert" className="w-full text-[14px] text-alert">{state.error}</p>}
      </div>
    </form>
  );
}

// Details -> Preview -> Live. A real sequence, so it gets numbers.
function Steps({ at }: { at: 1 | 2 | 3 }) {
  return (
    <ol className="mb-3 flex gap-4 text-[12px]">
      {['Details', 'Preview', 'Live'].map((label, i) => (
        <li key={label} className={`flex items-center gap-1.5 ${i + 1 <= at ? 'text-text' : 'text-dim'}`}>
          <span
            className={`grid size-5 place-items-center rounded-full text-[11px] font-semibold ${
              i + 1 < at ? 'bg-ok text-white' : i + 1 === at ? 'bg-text text-bg' : 'border border-border'
            }`}
          >
            {i + 1 < at ? '✓' : i + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function Group({ title, optional, hint, children }: { title: string; optional?: boolean; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <div>
        <h4 className="font-serif text-[17px] font-bold">
          {title}
          {optional && <span className="ml-2 font-sans text-[12px] font-normal text-dim">Optional</span>}
        </h4>
        {hint && <p className="mt-0.5 text-[13px] text-dim">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="text-[12px] leading-snug text-dim">{hint}</span>}
    </label>
  );
}
