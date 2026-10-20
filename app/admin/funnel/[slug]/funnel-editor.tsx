'use client';

import { useEffect, useMemo, useState, useTransition, type FocusEvent, type ReactNode } from 'react';
import {
  FONT_PAIRINGS,
  STYLE_DEFAULTS,
  THEMES,
  funnelDefaults,
  renderFunnel,
  type CopySlots,
  type FontPairing,
  type FunnelView,
  type Screen,
  type Template,
} from '@/lib/funnel/render';
import { saveFunnelDesign, type FunnelDesign } from '../../actions';

// The settings on the left, the page as a customer sees it on the right. The preview is the
// real renderFunnel() output in a sandboxed iframe, rebuilt as settings change, so what you see is what ships.

const input =
  'w-full rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[14px] text-text placeholder:text-dim/70 focus:border-text';
const button = 'rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium hover:border-dim disabled:opacity-60';

const SCREENS: { value: Screen; label: string }[] = [
  { value: 'rate', label: 'Rating' },
  { value: 'club', label: 'Happy' },
  { value: 'redirect', label: 'To Google' },
  { value: 'unhappy', label: 'Unhappy' },
  { value: 'done', label: 'Sent' },
];

// Every Google font the font tiles show, loaded once for the editor.
const TILE_FONTS =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Space+Grotesk:wght@700&family=Fraunces:wght@700&family=Archivo+Black&family=Libre+Baskerville:wght@700&family=Oswald:wght@700&display=swap';

function toDesign(v: FunnelView): FunnelDesign {
  return {
    template: v.template,
    font_pairing: v.font_pairing,
    brand_color: v.brand_primary,
    logo_url: v.logo_url,
    rating_question: v.rating_question,
    unhappy_message: v.unhappy_message,
    birthday_active: v.birthday_active,
    okay_routes_happy: v.okay_routes_happy,
    copy_slots: { ...v.copy_slots },
    style: { ...STYLE_DEFAULTS, ...v.style },
  };
}

export function FunnelEditor({ funnelId, live, view }: { funnelId: string; live: boolean; view: FunnelView }) {
  const [saved, setSaved] = useState(() => toDesign(view));
  const [design, setDesign] = useState(saved);
  const [screen, setScreen] = useState<Screen>('rate');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSave] = useTransition();

  const dirty = JSON.stringify(design) !== JSON.stringify(saved);
  const defaults = funnelDefaults({ industry: view.industry, birthday_active: design.birthday_active, rating_style: design.style.rating_style });

  const set = <K extends keyof FunnelDesign>(key: K, value: FunnelDesign[K]) => {
    setDesign((d) => ({ ...d, [key]: value }));
    setMessage(null);
  };
  const setStyle = <K extends keyof FunnelDesign['style']>(key: K, value: FunnelDesign['style'][K]) =>
    set('style', { ...design.style, [key]: value });
  const setCopy = (key: keyof CopySlots, value: string) => set('copy_slots', { ...design.copy_slots, [key]: value });

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // The preview rebuilds a moment after typing stops, so it doesn't flicker on every key.
  const html = useMemo(
    () =>
      renderFunnel({
        ...view,
        template: design.template,
        font_pairing: design.font_pairing,
        brand_primary: /^#[0-9a-f]{6}$/i.test(design.brand_color) ? design.brand_color : view.brand_primary,
        logo_url: design.logo_url?.trim() || null,
        rating_question: design.rating_question,
        unhappy_message: design.unhappy_message,
        birthday_active: design.birthday_active,
        okay_routes_happy: design.okay_routes_happy,
        copy_slots: design.copy_slots,
        style: { ...design.style, cover_url: design.style.cover_url?.trim() || null },
        preview: true,
        screen,
      }),
    [view, design, screen],
  );
  const [shown, setShown] = useState(html);
  useEffect(() => {
    const t = setTimeout(() => setShown(html), 250);
    return () => clearTimeout(t);
  }, [html]);

  function save() {
    startSave(async () => {
      const result = await saveFunnelDesign(funnelId, design);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setSaved(design);
        setMessage({ ok: true, text: live ? 'Saved. The live page has the changes now.' : 'Saved.' });
      }
    });
  }

  // Typing in a section shows that section's screen in the preview (innermost section wins).
  const focus = (s: Screen) => (e: FocusEvent) => {
    e.stopPropagation();
    setScreen(s);
  };

  return (
    <>
      <link rel="stylesheet" href={TILE_FONTS} precedence="default" />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid gap-5">
          <Group title="Look" hint="Theme, color and type. Pick what matches their place.">
            <Field label="Page color">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(THEMES) as Template[]).map((t) => (
                  <Tile key={t} selected={design.template === t} onClick={() => set('template', t)}>
                    <span
                      className="mb-2 flex h-10 items-end gap-1 rounded-md border p-1.5"
                      style={{ background: THEMES[t].bg, borderColor: THEMES[t].border }}
                    >
                      <span className="h-full flex-1 rounded-[3px]" style={{ background: THEMES[t].surface }} />
                      <span className="h-2.5 w-5 rounded-[3px]" style={{ background: design.brand_color }} />
                    </span>
                    {THEMES[t].label}
                  </Tile>
                ))}
              </div>
            </Field>

            <Field label="Brand color" hint="Buttons, the header band and the stars use it.">
              <ColorField value={design.brand_color} onChange={(c) => set('brand_color', c)} />
            </Field>

            <Field label="Background">
              <Segments
                value={design.style.background}
                onChange={(v) => setStyle('background', v)}
                options={[
                  { value: 'plain', label: 'Plain' },
                  { value: 'tinted', label: 'Tinted with brand color' },
                ]}
              />
            </Field>

            <Field label="Fonts">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {(Object.keys(FONT_PAIRINGS) as FontPairing[]).map((p) => (
                  <Tile key={p} selected={design.font_pairing === p} onClick={() => set('font_pairing', p)}>
                    <span className="block text-[26px] leading-none" style={{ fontFamily: FONT_PAIRINGS[p].display }}>
                      Aa
                    </span>
                    <span className="mt-2 block">{FONT_PAIRINGS[p].label}</span>
                  </Tile>
                ))}
              </div>
            </Field>

            <Field label="Corners">
              <Segments
                value={design.style.corners}
                onChange={(v) => setStyle('corners', v)}
                options={[
                  { value: 'round', label: 'Round' },
                  { value: 'soft', label: 'Soft' },
                  { value: 'square', label: 'Square' },
                ]}
              />
            </Field>
          </Group>

          <Group title="Header and logo" onFocus={focus('rate')}>
            <Field label="Header">
              <Segments
                value={design.style.header}
                onChange={(v) => setStyle('header', v)}
                options={[
                  { value: 'band', label: 'Brand color band' },
                  { value: 'photo', label: 'Cover photo' },
                  { value: 'simple', label: 'Just the logo' },
                ]}
              />
            </Field>
            {design.style.header === 'photo' && (
              <Field label="Cover photo link" hint="A wide photo of the room, the bar or the food. Copy the image address from their website or Instagram.">
                <input
                  className={input}
                  inputMode="url"
                  placeholder="https://…/dining-room.jpg"
                  value={design.style.cover_url ?? ''}
                  onChange={(e) => setStyle('cover_url', e.target.value)}
                />
              </Field>
            )}
            <Field label="Logo link" hint="Leave empty to show their first letter instead.">
              <input
                className={input}
                inputMode="url"
                placeholder="https://…/logo.png"
                value={design.logo_url ?? ''}
                onChange={(e) => set('logo_url', e.target.value)}
              />
            </Field>
            <Field label="Logo shape" hint="Auto puts wide logos on a white card in place of the name, and square ones in a circle.">
              <Segments
                value={design.style.logo_shape}
                onChange={(v) => setStyle('logo_shape', v)}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'circle', label: 'Circle' },
                  { value: 'square', label: 'Rounded square' },
                  { value: 'wide', label: 'Wordmark' },
                ]}
              />
            </Field>
          </Group>

          <Group title="Rating" onFocus={focus('rate')}>
            <Field label="How customers rate">
              <Segments
                value={design.style.rating_style}
                onChange={(v) => setStyle('rating_style', v)}
                options={[
                  { value: 'faces', label: '😐 Faces' },
                  { value: 'stars', label: '★ Stars' },
                  { value: 'numbers', label: '1 to 5' },
                ]}
              />
            </Field>
            <Words label="Question" value={design.rating_question} placeholder={defaults.rating_question} max={140} onChange={(v) => set('rating_question', v)} />
            <Words label="Hint under the question" value={design.copy_slots.rate_sub} placeholder={defaults.rate_sub} onChange={(v) => setCopy('rate_sub', v)} />
            <Words label="Note at the bottom" value={design.copy_slots.reassure} placeholder={defaults.reassure} multiline onChange={(v) => setCopy('reassure', v)} />
            <Check
              checked={design.okay_routes_happy}
              onChange={(v) => set('okay_routes_happy', v)}
              label="Treat “Okay” (3 out of 5) as happy"
              hint="Off: 3 goes to the manager. On: 3 is asked for a Google review too."
            />
          </Group>

          <Group title="Happy customers" hint="4 and 5 ratings: they leave their details, then go to Google." onFocus={focus('club')}>
            <Check
              checked={design.birthday_active}
              onChange={(v) => set('birthday_active', v)}
              label="Ask for their birthday"
              hint="Needed for birthday texts on the Revenue plan."
            />
            <Words label="Headline" value={design.copy_slots.club_headline} placeholder={defaults.club_headline} onChange={(v) => setCopy('club_headline', v)} />
            <Words label="Text under the headline" value={design.copy_slots.club_sub} placeholder={defaults.club_sub} multiline onChange={(v) => setCopy('club_sub', v)} />
            <Words label="Button" value={design.copy_slots.cta} placeholder={defaults.cta} max={60} onChange={(v) => setCopy('cta', v)} />
            <div onFocus={focus('redirect')}>
              <Words label="While going to Google" value={design.copy_slots.thanks} placeholder={defaults.thanks} max={80} onChange={(v) => setCopy('thanks', v)} />
            </div>
          </Group>

          <Group title="Unhappy customers" hint="1 to 3 ratings: their note goes to the manager, never to Google." onFocus={focus('unhappy')}>
            <Words label="Headline" value={design.copy_slots.unhappy_headline} placeholder={defaults.unhappy_headline} onChange={(v) => setCopy('unhappy_headline', v)} />
            <Words label="Text under the headline" value={design.copy_slots.unhappy_sub} placeholder={defaults.unhappy_sub} multiline onChange={(v) => setCopy('unhappy_sub', v)} />
            <Words label="Button" value={design.copy_slots.unhappy_cta} placeholder={defaults.unhappy_cta} max={60} onChange={(v) => setCopy('unhappy_cta', v)} />
            <div onFocus={focus('done')}>
              <Words label="After they send it" value={design.unhappy_message} placeholder={defaults.unhappy_message} max={300} multiline onChange={(v) => set('unhappy_message', v)} />
            </div>
          </Group>

          <Group title="Footer">
            <Check
              checked={design.style.show_powered}
              onChange={(v) => setStyle('show_powered', v)}
              label="Show “Beehive Reviews by EMRG Media”"
            />
          </Group>
        </div>

        <div className="lg:sticky lg:top-6">
          <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Preview screen">
            {SCREENS.map((s) => (
              <button
                key={s.value}
                type="button"
                role="tab"
                aria-selected={screen === s.value}
                onClick={() => setScreen(s.value)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                  screen === s.value ? 'bg-text text-bg' : 'text-dim hover:text-text'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="mx-auto h-[720px] max-h-[80vh] w-full max-w-[390px] overflow-hidden rounded-[36px] border-[8px] border-text bg-black shadow-[0_20px_50px_rgba(27,26,23,0.18)]">
            <iframe srcDoc={shown} sandbox="allow-scripts" title="Review page preview" className="size-full bg-white" />
          </div>
          <p className="mt-3 text-center text-[12px] text-dim">Tap through it like a customer. Nothing is saved or sent from the preview.</p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-end gap-3 px-5 py-3">
          <p role="status" className={`mr-auto text-[13px] ${message ? (message.ok ? 'text-ok' : 'text-alert') : 'text-dim'}`}>
            {message?.text ?? (dirty ? 'You have unsaved changes.' : 'All changes saved.')}
          </p>
          <button type="button" className={button} disabled={!dirty || saving} onClick={() => { setDesign(saved); setMessage(null); }}>
            Undo changes
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={save}
            className="rounded-lg bg-text px-5 py-2 text-[13px] font-semibold text-bg hover:opacity-90 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}

function Group({ title, hint, children, onFocus }: { title: string; hint?: string; children: ReactNode; onFocus?: (e: FocusEvent) => void }) {
  return (
    <section onFocus={onFocus} className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="font-serif text-[18px] font-bold">{title}</h2>
      {hint && <p className="mt-1 text-[13px] text-dim">{hint}</p>}
      <div className="mt-5 grid gap-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-[12px] text-dim">{hint}</p>}
    </div>
  );
}

function Tile({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-xl border p-2.5 text-left text-[12px] font-medium ${
        selected ? 'border-text bg-surface2 shadow-[inset_0_0_0_1px_var(--color-text)]' : 'border-border hover:border-dim'
      }`}
    >
      {children}
    </button>
  );
}

function Segments<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg border px-3 py-2 text-[13px] font-medium ${
            value === o.value ? 'border-text bg-text text-bg' : 'border-border bg-surface hover:border-dim'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Words({
  label,
  value,
  placeholder,
  onChange,
  max = 200,
  multiline,
}: {
  label: string;
  value: string | null | undefined;
  placeholder: string;
  onChange: (value: string) => void;
  max?: number;
  multiline?: boolean;
}) {
  return (
    <label className="grid gap-2 text-[13px] font-medium">
      <span className="flex items-baseline justify-between gap-3">
        {label}
        {value ? (
          <button type="button" onClick={() => onChange('')} className="text-[12px] font-normal text-dim underline underline-offset-2 hover:text-text">
            Use the default
          </button>
        ) : (
          <span className="text-[12px] font-normal text-dim">Default wording</span>
        )}
      </span>
      {multiline ? (
        <textarea rows={2} maxLength={max} className={`${input} resize-y font-normal`} placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input maxLength={max} className={`${input} font-normal`} placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[13px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4" />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] text-dim">{hint}</span>}
      </span>
    </label>
  );
}

// Color picker plus a hex box. The hex box can hold a half typed value; only a full #RRGGBB is kept.
function ColorField({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  // Picker or Undo changed the color: show it in the hex box too.
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Pick brand color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-surface p-1"
      />
      <input
        aria-label="Brand color hex"
        className={`${input} max-w-32 font-mono uppercase`}
        value={text}
        maxLength={7}
        onChange={(e) => {
          const t = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
          setText(t);
          if (/^#[0-9a-f]{6}$/i.test(t)) onChange(t.toUpperCase());
        }}
      />
    </div>
  );
}
