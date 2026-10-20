'use client';

import { createContext, use, useActionState, useState, useTransition, type ReactNode } from 'react';
import { createClient, publishFunnel, smartFillWithAi } from './actions';
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
// Used when the AI fill isn't available (no ANTHROPIC_API_KEY on the server, or it failed).
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

const input = 'w-full rounded-[10px] border bg-surface px-3 py-2.5 text-[14px] text-text placeholder:text-dim focus:border-text';
const button = 'rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium hover:border-dim';
const primary = 'rounded-lg border border-text bg-text px-3.5 py-2 text-[13px] font-semibold text-bg disabled:opacity-60';

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

export function AddClientSlot() {
  const { open, setOpen } = useOpen();
  const [round, setRound] = useState(0); // new number = fresh empty form ("Add another")
  if (!open) return null;
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
  const [filling, startFill] = useTransition();
  const [, startSave] = useTransition();

  const set = (key: keyof Fields) => (e: { target: { value: string } }) => setFields((f) => ({ ...f, [key]: e.target.value }));
  const border = (key: string) => (filled.includes(key) ? 'border-ok' : 'border-border');

  function fill() {
    if (!smart.trim()) return setNote('Describe the client first, or tap Show me an example.');
    setNote('Reading it…');
    startFill(async () => {
      const ai = await smartFillWithAi(smart.replace(/^EXAMPLE:\s*/i, '')).catch(() => null);
      const found = ai ? keepValid(ai) : smartFill(smart);
      setFields((f) => ({ ...f, ...found }));
      setFilled(Object.keys(found));
      setNote(`Filled${ai ? ' by AI' : ''}. Green means it was filled for you, you confirm it.`);
    });
  }

  // Saved: show the draft funnel in a phone frame, then Publish.
  if (state && 'created' in state) {
    const c = state.created;
    return (
      <div className="mb-8 rounded-2xl border border-border bg-surface p-6 sm:p-7">
        <h3 className="font-serif text-[22px] font-bold">
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
    // Submitted by hand, not with action={...}: React resets a form after its action runs, which would snap
    // the controlled selects (tier, vertical) back to their first option while state still holds the choice.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startSave(() => formAction(data));
      }}
      className="mb-8 rounded-2xl border border-border bg-surface p-6 sm:p-7">
      <h3 className="mb-3 font-serif text-[22px] font-bold">New client</h3>
      <ol className="mb-3.5 grid gap-1.5 text-sm">
        <li><b className="figure mr-1 font-bold">1.</b> Describe the client, or fill the form yourself.</li>
        <li><b className="figure mr-1 font-bold">2.</b> Paste their review link. That is the only thing that changes per client.</li>
        <li><b className="figure mr-1 font-bold">3.</b> Save and preview, then Publish. Their funnel is live.</li>
      </ol>

      <textarea
        value={smart}
        onChange={(e) => setSmart(e.target.value)}
        placeholder="Example: Sachar Dental NYC, dentist in Midtown, review link https://..., tier 2, average visit 400, owner dr@sachar.com"
        className="min-h-[84px] w-full resize-y rounded-xl border border-border bg-surface2 p-3.5 text-[14px] leading-relaxed text-text placeholder:text-dim focus:border-text"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        <button type="button" className={button} onClick={() => { setSmart(EXAMPLE); setNote('Sample client. Edit it or replace it, then tap Fill.'); }}>
          Show me an example
        </button>
        <button type="button" className={button} onClick={fill} disabled={filling}>
          {filling ? 'Filling…' : 'Fill the form from this'}
        </button>
        <span className="text-[13px] text-ok">{note}</span>
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3 text-xs font-medium text-text sm:grid-cols-2">
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
