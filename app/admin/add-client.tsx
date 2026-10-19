'use client';

import { useActionState, useState, useTransition } from 'react';
import { createClient, publishFunnel } from './actions';
import { PasswordOnce } from './add-login';

// "+ Add client" from the demo's factory: describe -> fill -> save as draft -> preview -> publish.

const EXAMPLE =
  'EXAMPLE: Figlia & Sons, Italian restaurant in Midtown, warm family feel, review link https://review.beehivereviews.com/figlia---sons?r=69d92b934280d6dd661ab03b, tier 2, average ticket 65';

const EMPTY = {
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
// (An AI version can replace this later; the form doesn't change.)
function smartFill(text: string): Partial<Fields> {
  const t = text.replace(/^EXAMPLE:\s*/i, '');
  const found: Partial<Fields> = {
    name: t.split(',')[0].trim(),
    review_link: t.match(/https?:\/\/[^\s,]+/)?.[0] ?? '',
    tier: t.match(/tier\s*([123])/i)?.[1] ?? '',
    avg_ticket: t.match(/(?:ticket|visit|average)\D{0,12}(\d{2,4})/i)?.[1] ?? '',
    owner_email: t.match(/[^\s,@]+@[^\s,@]+\.[a-z]{2,}/i)?.[0] ?? '',
    vertical: /dent|dds|orthodont|smile/i.test(t) ? 'dental' : 'hospitality',
  };
  return Object.fromEntries(Object.entries(found).filter(([, v]) => v));
}

const input = 'w-full rounded-lg border bg-surface px-2.5 py-2 text-text placeholder:text-dim';
const button = 'rounded-lg border border-border bg-surface2 px-3.5 py-2 text-[13px] font-medium hover:border-dim';
const primary = 'rounded-lg border border-text bg-text px-3.5 py-2 text-[13px] font-semibold text-bg disabled:opacity-60';

export function AddClient() {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0); // new number = fresh empty form ("Add another")

  if (!open) {
    return (
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => setOpen(true)} className={primary}>
          + Add client
        </button>
      </div>
    );
  }
  return <Factory key={round} onClose={() => setOpen(false)} onAnother={() => setRound((r) => r + 1)} />;
}

function Factory({ onClose, onAnother }: { onClose: () => void; onAnother: () => void }) {
  const [state, formAction, saving] = useActionState(createClient, undefined);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [filled, setFilled] = useState<string[]>([]);
  const [smart, setSmart] = useState('');
  const [note, setNote] = useState('');
  const [published, setPublished] = useState(false);
  const [publishing, startPublish] = useTransition();

  const set = (key: keyof Fields) => (e: { target: { value: string } }) => setFields((f) => ({ ...f, [key]: e.target.value }));
  const border = (key: string) => (filled.includes(key) ? 'border-ok' : 'border-border');

  function fill() {
    if (!smart.trim()) return setNote('Describe the client first, or tap Show me an example.');
    const found = smartFill(smart);
    setFields((f) => ({ ...f, ...found }));
    setFilled(Object.keys(found));
    setNote('Filled. Green means it was filled for you, you confirm it.');
  }

  // Saved: show the draft funnel in a phone frame, then Publish.
  if (state && 'created' in state) {
    const c = state.created;
    return (
      <div className="mb-4 rounded-xl border border-dashed border-border bg-surface2 p-5">
        <h3 className="text-[15px] font-semibold">
          {c.name} {published ? 'is live.' : 'is saved as a draft.'}
        </h3>
        <p className="mb-3 mt-1 text-[13px] text-dim">
          {published
            ? `Funnel: /c/${c.funnelSlug}`
            : 'Check the funnel below. Preview submissions are not saved. Publish when it looks right.'}
        </p>

        <div className="flex flex-wrap items-start gap-5">
          <div className="h-[640px] w-[360px] max-w-full overflow-hidden rounded-[28px] border-[6px] border-border bg-black">
            <iframe src={`/admin/preview/${c.funnelSlug}`} title={`${c.name} funnel preview`} className="size-full" />
          </div>
          <div className="grid max-w-sm gap-3">
            {!published && (
              <button
                type="button"
                disabled={publishing}
                onClick={() => startPublish(async () => {
                  await publishFunnel(c.funnelId);
                  setPublished(true);
                })}
                className={primary}
              >
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            )}
            {c.login ? (
              <PasswordOnce login={c.login} />
            ) : (
              <p className="text-xs text-dim">No login created. Use “+ Add login” on the client card when you have the owner’s email.</p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onAnother} className={button}>Add another client</button>
              <button type="button" onClick={onClose} className={button}>Close</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="mb-4 rounded-xl border border-dashed border-border bg-surface2 p-5">
      <h3 className="mb-2 text-[15px] font-semibold">New client</h3>
      <ol className="mb-3.5 grid gap-1.5 text-sm">
        <li><b className="text-metric">1.</b> Describe the client, or fill the form yourself.</li>
        <li><b className="text-metric">2.</b> Paste their review link. That is the only thing that changes per client.</li>
        <li><b className="text-metric">3.</b> Save and preview, then Publish. Their funnel is live.</li>
      </ol>

      <textarea
        value={smart}
        onChange={(e) => setSmart(e.target.value)}
        placeholder="Example: Sachar Dental NYC, dentist in Midtown, review link https://..., tier 2, average visit 400, owner dr@sachar.com"
        className="min-h-[76px] w-full resize-y rounded-[10px] border border-border bg-surface p-3 text-text placeholder:text-dim"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        <button type="button" className={button} onClick={() => { setSmart(EXAMPLE); setNote('Sample client. Edit it or replace it, then tap Fill.'); }}>
          Show me an example
        </button>
        <button type="button" className={button} onClick={fill}>Fill the form from this</button>
        <span className="text-[13px] text-ok">{note}</span>
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3 text-xs font-medium text-dim sm:grid-cols-2">
        <label className="grid gap-1.5">Business name *
          <input name="name" required value={fields.name} onChange={set('name')} placeholder="Business name" className={`${input} ${border('name')}`} />
        </label>
        <label className="grid gap-1.5">Vertical
          <select name="vertical" value={fields.vertical} onChange={set('vertical')} className={`${input} ${border('vertical')}`}>
            <option value="hospitality">Hospitality (restaurant, bar, lounge, club)</option>
            <option value="dental">Dental</option>
          </select>
        </label>
        <label className="grid gap-1.5 sm:col-span-2">Review link * (Climbo or Google, where happy customers go)
          <input name="review_link" required value={fields.review_link} onChange={set('review_link')} placeholder="https://review.beehivereviews.com/..." className={`${input} ${border('review_link')}`} />
        </label>
        <label className="grid gap-1.5">Tier
          <select name="tier" value={fields.tier} onChange={set('tier')} className={`${input} ${border('tier')}`}>
            <option value="1">1 · Capture (no dashboard)</option>
            <option value="2">2 · Command (dashboard + alerts + birthday texts)</option>
            <option value="3">3 · Revenue (everything + win back + money report)</option>
          </select>
        </label>
        <label className="grid gap-1.5">Average ticket ($, for the money view)
          <input name="avg_ticket" type="number" min="0" value={fields.avg_ticket} onChange={set('avg_ticket')} placeholder="60 for dinner, 400 for a dental visit" className={`${input} ${border('avg_ticket')}`} />
        </label>
        <label className="grid gap-1.5">Brand color
          <input name="brand_color" type="color" value={fields.brand_color} onChange={set('brand_color')} className={`${input} h-[38px] p-1 ${border('brand_color')}`} />
        </label>
        <label className="grid gap-1.5">Rating question (optional)
          <input name="rating_question" value={fields.rating_question} onChange={set('rating_question')} placeholder="Auto written if blank" className={`${input} ${border('rating_question')}`} />
        </label>
        <label className="grid gap-1.5">Owner name (for their login)
          <input name="owner_name" value={fields.owner_name} onChange={set('owner_name')} placeholder="Optional" className={`${input} ${border('owner_name')}`} />
        </label>
        <label className="grid gap-1.5">Owner email (for their login)
          <input name="owner_email" type="email" value={fields.owner_email} onChange={set('owner_email')} placeholder="Optional, can be added later" className={`${input} ${border('owner_email')}`} />
        </label>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
        <button type="submit" disabled={saving} className={primary}>{saving ? 'Saving…' : 'Save and preview'}</button>
        <button type="button" onClick={onClose} className={button}>Cancel</button>
        {state && 'error' in state && <span className="text-[13px] text-alert">{state.error}</span>}
      </div>
    </form>
  );
}
