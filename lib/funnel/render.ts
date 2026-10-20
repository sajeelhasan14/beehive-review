// Customer facing funnel, moved from Mario's demo (renderFunnel in beehive-multitenant-demo.html).
// Returns one complete HTML page as a string (no React). Served by app/c/[slug]/route.ts, and
// rendered in the browser too by the admin page editor (app/admin/funnel/[slug]) for its live preview,
// so this file must not import anything server only.
// Templates: midnight (dark), ivory (light), marquee (black), trade (slate). Brand tokens inject as
// CSS variables. Copy slots and style options fill per client.

export type Template = 'midnight' | 'ivory' | 'marquee' | 'trade';
export type FontPairing = 'classic' | 'modern' | 'editorial' | 'bold' | 'quiet' | 'trade';

// Optional wording overrides stored in funnels.copy_slots. Blank = the default in funnelDefaults().
export interface CopySlots {
  rate_sub?: string;
  reassure?: string;
  club_headline?: string;
  club_sub?: string;
  cta?: string;
  thanks?: string;
  unhappy_headline?: string;
  unhappy_sub?: string;
  unhappy_cta?: string;
}

// Look options stored in funnels.style (db/migrations/0005_funnel_style.sql). Missing = STYLE_DEFAULTS.
export interface FunnelStyle {
  header: 'band' | 'photo' | 'simple';   // brand color band, cover photo, or logo on the page color
  cover_url: string | null;              // photo for header 'photo'
  logo_shape: 'auto' | 'circle' | 'square' | 'wide';  // wide = wordmark on a white card; auto picks by the logo's shape
  rating_style: 'faces' | 'stars' | 'numbers';
  corners: 'round' | 'soft' | 'square';
  background: 'plain' | 'tinted';        // tinted = page color mixed with a little brand color
  show_powered: boolean;                 // "Beehive Reviews by EMRG Media" footer
}

export const STYLE_DEFAULTS: FunnelStyle = {
  header: 'band',
  cover_url: null,
  logo_shape: 'auto',
  rating_style: 'faces',
  corners: 'round',
  background: 'plain',
  show_powered: true,
};

export type Screen = 'rate' | 'club' | 'unhappy' | 'redirect' | 'done';

// Everything the renderer needs for one funnel. Built by lib/funnel/load.ts.
export interface FunnelView {
  slug: string;                 // funnel slug, sent back with each submission
  client_name: string;
  logo_url: string | null;
  brand_primary: string;
  brand_accent: string;
  font_pairing: FontPairing;
  industry: string;             // 'dental' switches to formal wording
  template: Template;
  climbo_url: string;           // review link happy customers are sent to
  birthday_active: boolean;
  okay_routes_happy: boolean;
  rating_question: string | null;
  unhappy_message: string | null;
  copy_slots: CopySlots;
  style: Partial<FunnelStyle>;
  preview?: boolean;            // admin preview: nothing is sent and nobody is redirected
  screen?: Screen;              // preview only: the screen to open on
}

export const FONT_PAIRINGS: Record<FontPairing, { label: string; display: string; body: string; gf: string }> = {
  classic:   { label: 'Classic',   display: `'Playfair Display', Georgia, serif`, body: `'Inter', -apple-system, sans-serif`, gf: 'Playfair+Display:wght@700&family=Inter:wght@400;500;600' },
  modern:    { label: 'Modern',    display: `'Space Grotesk', sans-serif`,        body: `'Inter', -apple-system, sans-serif`, gf: 'Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600' },
  editorial: { label: 'Editorial', display: `'Fraunces', Georgia, serif`,         body: `'Source Sans 3', sans-serif`,        gf: 'Fraunces:wght@600;700&family=Source+Sans+3:wght@400;500;600' },
  bold:      { label: 'Bold',      display: `'Archivo Black', sans-serif`,        body: `'Archivo', sans-serif`,              gf: 'Archivo+Black&family=Archivo:wght@400;500;600' },
  quiet:     { label: 'Quiet',     display: `'Libre Baskerville', Georgia, serif`,body: `'Inter', -apple-system, sans-serif`, gf: 'Libre+Baskerville:wght@700&family=Inter:wght@400;500;600' },
  trade:     { label: 'Sturdy',    display: `'Oswald', sans-serif`,               body: `'Inter', -apple-system, sans-serif`, gf: 'Oswald:wght@600;700&family=Inter:wght@400;500;600' },
};

export const THEMES: Record<Template, { label: string; bg: string; surface: string; text: string; dim: string; border: string }> = {
  midnight: { label: 'Dark',  bg: '#0D0C0B', surface: '#171512', text: '#F5F1E8', dim: '#A39B90', border: '#2A261F' },
  ivory:    { label: 'Light', bg: '#FAF9F5', surface: '#FFFFFF', text: '#1B1A17', dim: '#6E6A61', border: '#E4E0D6' },
  marquee:  { label: 'Black', bg: '#050505', surface: '#111111', text: '#FFFFFF', dim: '#8F8F8F', border: '#242424' },
  trade:    { label: 'Slate', bg: '#12161C', surface: '#1A1F27', text: '#F3F6FA', dim: '#9AA4B2', border: '#283039' },
};

const RADII = { round: [22, 14], soft: [12, 9], square: [3, 2] } as const;

const esc = (s: string = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// Ink or white, whichever reads better on the brand color (same rule as inkOn in app/ui/app-header.tsx).
function onColor(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return '#ffffff';
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#1b1a17' : '#ffffff';
}

function isFormal(industry: string) {
  return ['professional', 'dental', 'legal', 'roofing', 'home-services'].includes(industry);
}

// The wording used when a copy slot is blank. The editor shows these as placeholders.
export function funnelDefaults(f: Pick<FunnelView, 'industry' | 'birthday_active'> & { rating_style?: FunnelStyle['rating_style'] }) {
  const formal = isFormal(f.industry);
  const professional = ['professional', 'dental', 'legal'].includes(f.industry);
  const tapWhat = { faces: 'a face', stars: 'a star', numbers: 'a number' }[f.rating_style ?? 'faces'];
  return {
    rating_question: 'How was your visit?',
    rate_sub: `Tap ${tapWhat} to get started`,
    reassure: 'Your honest feedback helps us improve. Every response is read by our team.',
    club_headline: professional ? 'Join our client appreciation list'
      : formal ? 'Join our customer care list'
      : f.birthday_active ? 'Join our Birthday Club' : 'Join our guest list',
    club_sub: 'Leave your details and we’ll take you to Google to post your review.',
    cta: 'Submit and leave a review',
    thanks: 'Thank you! Taking you to Google…',
    unhappy_headline: formal ? 'We want to make this right.' : 'We’re sorry to hear that.',
    unhappy_sub: 'Tell us what happened and we’ll take care of it.',
    unhappy_cta: 'Send to the manager',
    unhappy_message: 'Thank you for the honest feedback. A manager will follow up with you personally.',
  };
}

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

export function renderFunnel(f: FunnelView | null): string {
  if (!f) return `<!doctype html><meta charset="utf-8"><title>Not found</title>
    <body style="font-family:sans-serif;background:#0D0C0B;color:#F5F1E8;display:grid;place-items:center;min-height:100vh;margin:0">
    <p>This page is not available right now.</p></body>`;

  const style: FunnelStyle = { ...STYLE_DEFAULTS, ...f.style };
  const theme = THEMES[f.template] || THEMES.midnight;
  const fonts = FONT_PAIRINGS[f.font_pairing] || FONT_PAIRINGS.classic;
  const brand = /^#[0-9a-f]{6}$/i.test(f.brand_primary) ? f.brand_primary : '#E8B54D';
  const onBrand = onColor(brand);
  const [rCard, rCtl] = RADII[style.corners] || RADII.round;
  const header = style.header === 'photo' && !style.cover_url ? 'band' : style.header;
  const slots = f.copy_slots || {};
  const d = funnelDefaults({ industry: f.industry, birthday_active: f.birthday_active, rating_style: style.rating_style });
  const formal = isFormal(f.industry);
  const labels = formal
    ? ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent']
    : ['Terrible', 'Poor', 'Okay', 'Good', 'Amazing'];
  const emojis = ['\u{1F625}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F601}'];
  const say = (key: keyof CopySlots) => esc(slots[key]?.trim() || d[key]);
  const question = esc(f.rating_question?.trim() || d.rating_question);
  const unhappyMsg = esc(f.unhappy_message?.trim() || d.unhappy_message);
  const happyFrom = f.okay_routes_happy ? 3 : 4;
  const start: Screen = (f.preview && f.screen) || 'rate';
  const on = (s: Screen) => (s === start ? ' active' : '');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const logo = f.logo_url
    ? `<img class="logo ${style.logo_shape}" src="${esc(f.logo_url)}" alt="${esc(f.client_name)}">`
    : `<div class="logo initial">${esc(f.client_name[0] || 'B')}</div>`;
  const wordmark = Boolean(f.logo_url) && style.logo_shape === 'wide';

  const rating = style.rating_style === 'stars'
    ? `<div class="stars" role="group" aria-label="Rate your experience">
        ${labels.map((l, i) => `<button class="rate star" data-r="${i + 1}" aria-label="${i + 1} star${i ? 's' : ''}, ${esc(l)}">${STAR}</button>`).join('')}
      </div>
      <p class="starlabel" aria-live="polite">&nbsp;</p>`
    : style.rating_style === 'numbers'
    ? `<div class="nums" role="group" aria-label="Rate your experience from 1 to 5">
        ${labels.map((l, i) => `<button class="rate num" data-r="${i + 1}" aria-label="${i + 1}, ${esc(l)}">${i + 1}</button>`).join('')}
      </div>
      <div class="ends"><span>${esc(labels[0])}</span><span>${esc(labels[4])}</span></div>`
    : `<div class="faces" role="group" aria-label="Rate your experience">
        ${emojis.map((e, i) => `<button class="rate face" data-r="${i + 1}" aria-label="${esc(labels[i])}"><span class="e">${e}</span><span class="l">${esc(labels[i])}</span></button>`).join('')}
      </div>`;

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="${header === 'band' ? brand : theme.bg}">
<title>${esc(f.client_name)} | Feedback</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${fonts.gf}&display=swap" rel="stylesheet">
<style>
:root{--brand:${brand};--on-brand:${onBrand};--base:${theme.bg};--bg:${style.background === 'tinted' ? `color-mix(in srgb,var(--brand) 10%,${theme.bg})` : theme.bg};--surface:${theme.surface};--text:${theme.text};--dim:${theme.dim};--border:${theme.border};--soft:color-mix(in srgb,var(--text) 6%,var(--surface));--r:${rCard}px;--rc:${rCtl}px;--display:${fonts.display}}
*{box-sizing:border-box;margin:0}
html{-webkit-text-size-adjust:100%}
body{background:var(--bg);color:var(--text);font-family:${fonts.body};min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit}

/* Header: brand band, cover photo or plain */
.hd{width:100%;display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:34px 20px 22px}
.hd.band{background:var(--brand);color:var(--on-brand);padding-bottom:64px}
.hd.photo{position:relative;padding:0 20px 18px}
.cover{position:relative;width:calc(100% + 40px);height:200px;margin:0 -20px -46px;overflow:hidden}
.cover img{width:100%;height:100%;object-fit:cover;display:block}
.cover::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0) 35%,var(--bg))}
.hd.photo .logo{position:relative}
.logo{display:block;object-fit:contain}
.logo{background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.28),0 6px 20px rgba(0,0,0,.18)}
.logo.circle,.logo.auto,.logo.square,.logo.initial{width:84px;height:84px;padding:9px}
.logo.circle,.logo.auto,.logo.initial{border-radius:50%}
.logo.square{border-radius:calc(var(--rc) + 6px)}
.logo.wide{max-width:260px;height:84px;width:auto;padding:12px 20px;border-radius:calc(var(--rc) + 6px)}
.hd.wordmark .bizname{display:none}
.logo.initial{display:grid;place-items:center;background:var(--surface);color:var(--brand);font:700 34px/1 var(--display);padding:0}
.hd.band .logo.initial{background:var(--on-brand);color:var(--brand)}
.bizname{font-family:var(--display);font-size:21px;line-height:1.2;max-width:22ch}

/* The card everything sits in */
main{width:100%;max-width:520px;flex:1;padding:0 16px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:30px 22px 26px;box-shadow:0 1px 2px rgba(0,0,0,.05),0 14px 40px rgba(0,0,0,.08)}
.band+main .card{margin-top:-42px}
.screen{display:none}
.screen.active{display:block;animation:in .28s ease}
@keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.screen.active{animation:none}*{transition:none!important}}
h1{font-family:var(--display);font-size:clamp(25px,6.6vw,34px);text-align:center;line-height:1.16;text-wrap:balance}
.sub{text-align:center;color:var(--dim);margin:12px auto 28px;font-size:16px;line-height:1.5;max-width:34ch;text-wrap:pretty}

/* Rating controls */
.faces{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.face{background:none;border:0;display:flex;flex-direction:column;align-items:center;gap:9px;cursor:pointer;padding:4px 0;border-radius:var(--rc);-webkit-tap-highlight-color:transparent}
.face .e{display:grid;place-items:center;width:min(58px,15vw);aspect-ratio:1;border-radius:50%;background:var(--soft);font-size:min(32px,8.4vw);line-height:1;transition:transform .15s,background .15s}
.face .l{font-size:12px;color:var(--dim);font-weight:500}
.face:hover .e{transform:translateY(-2px)}
.face.picked .e{background:var(--brand);transform:scale(1.12)}
.face.picked .l{color:var(--text)}
.stars{display:flex;justify-content:center;gap:4px}
.star{background:none;border:0;padding:4px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.star svg{display:block;width:min(52px,13.5vw);height:min(52px,13.5vw);fill:var(--soft);stroke:var(--border);stroke-width:1;stroke-linejoin:round;transition:fill .12s,transform .12s}
.star.lit svg{fill:var(--brand);stroke:var(--brand)}
.star.picked svg{transform:scale(1.12)}
.starlabel{text-align:center;color:var(--dim);font-size:14px;font-weight:500;margin-top:8px;min-height:1.4em}
.nums{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.num{aspect-ratio:1;max-height:64px;border:1px solid var(--border);background:var(--soft);border-radius:var(--rc);font:700 22px/1 var(--display);cursor:pointer;transition:background .12s,transform .12s}
.num:hover{border-color:var(--brand)}
.num.picked{background:var(--brand);border-color:var(--brand);color:var(--on-brand);transform:scale(1.06)}
.ends{display:flex;justify-content:space-between;color:var(--dim);font-size:12px;margin-top:9px;font-weight:500}
.rate:focus-visible{outline:2px solid var(--brand);outline-offset:3px;border-radius:var(--rc)}
.reassure{margin-top:30px;padding-top:20px;border-top:1px solid var(--border);text-align:center;color:var(--dim);font-size:14px;line-height:1.55;text-wrap:pretty}

/* Forms */
.back{display:inline-flex;align-items:center;gap:6px;background:none;border:0;color:var(--dim);font-size:14px;cursor:pointer;padding:4px 0;margin:-8px 0 14px}
.back:hover{color:var(--text)}
.mark{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;margin:0 auto 18px;background:color-mix(in srgb,var(--brand) 16%,var(--surface));color:var(--brand)}
.mark svg{width:28px;height:28px}
form{display:grid;gap:15px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
label{font-size:14px;font-weight:600;display:grid;gap:7px}
label small{font-weight:400;color:var(--dim)}
input,select,textarea{width:100%;padding:14px;font:inherit;font-size:16px;font-weight:400;border-radius:var(--rc);border:1px solid var(--border);background:var(--base);color:var(--text);-webkit-appearance:none;appearance:none}
textarea{min-height:104px;resize:vertical;line-height:1.45}
select{background-image:linear-gradient(45deg,transparent 50%,var(--dim) 50%),linear-gradient(135deg,var(--dim) 50%,transparent 50%);background-position:calc(100% - 19px) 50%,calc(100% - 14px) 50%;background-size:5px 5px;background-repeat:no-repeat;padding-right:34px}
input:focus,select:focus,textarea:focus{outline:2px solid color-mix(in srgb,var(--brand) 55%,transparent);border-color:var(--brand)}
::placeholder{color:color-mix(in srgb,var(--dim) 75%,transparent)}
.consent{display:flex;gap:11px;align-items:flex-start;font-size:13px;color:var(--dim);font-weight:400;line-height:1.45}
.consent input{flex:none;width:20px;height:20px;padding:0;margin-top:1px;border-radius:5px;accent-color:var(--brand);-webkit-appearance:checkbox;appearance:auto}
.cta{margin-top:4px;padding:17px;font-size:17px;font-weight:600;border:0;border-radius:var(--rc);background:var(--brand);color:var(--on-brand);cursor:pointer;min-height:56px;box-shadow:0 6px 18px color-mix(in srgb,var(--brand) 30%,transparent);transition:filter .12s}
.cta:hover{filter:brightness(1.05)}
.cta:active{filter:brightness(.92)}
.cta:disabled{opacity:.6}
.cta:focus-visible{outline:2px solid var(--text);outline-offset:3px}
.privacy{text-align:center;color:var(--dim);font-size:12px}
input.miss,select.miss{border-color:#E05252;outline:2px solid #E05252}
.formerr{display:none;background:rgba(224,82,82,.12);border:1px solid #E05252;color:var(--text);border-radius:var(--rc);padding:12px 14px;font-size:14px;text-align:center}
.formerr.show{display:block}
.hp{position:absolute;left:-9999px}
.center{text-align:center}
.spin{width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--brand);border-radius:50%;margin:22px auto 0;animation:rot .8s linear infinite}
@keyframes rot{to{transform:rotate(360deg)}}
.golink{display:block;text-align:center;margin-top:18px;color:var(--dim);font-size:14px}
.golink a{color:var(--text)}
footer{padding:28px 16px 30px;font-size:12px;color:var(--dim);text-align:center}
footer b{font-weight:600;color:var(--text)}
@media(min-width:560px){main{padding:0 20px}.card{padding:38px 36px 32px}.hd{padding-top:44px}.cover{height:240px}}
</style></head>
<body>
<header class="hd ${header}${wordmark ? ' wordmark' : ''}">
  ${header === 'photo' ? `<div class="cover"><img src="${esc(style.cover_url ?? '')}" alt=""></div>` : ''}
  ${logo}
  <div class="bizname">${esc(f.client_name)}</div>
</header>
<main>
<div class="card">
  <section class="screen${on('rate')}" id="s-rate">
    <h1>${question}</h1>
    <p class="sub">${say('rate_sub')}</p>
    ${rating}
    <div class="reassure">${say('reassure')}</div>
  </section>

  <section class="screen${on('club')}" id="s-club">
    <button class="back" type="button">← Change rating</button>
    <h1>${say('club_headline')}</h1>
    <p class="sub">${say('club_sub')}</p>
    <form id="f-club" autocomplete="on" novalidate>
      <input class="hp" type="text" name="bh_verify" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="formerr" role="alert"></div>
      <div class="row">
        <label>First name<input required name="first_name" autocomplete="given-name" placeholder="John"></label>
        <label><span>Last name <small>(optional)</small></span><input name="last_name" autocomplete="family-name" placeholder="Doe"></label>
      </div>
      <label>Cell phone<input required name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(555) 123-4567"></label>
      <label><span>Email <small>(optional, for offers)</small></span><input name="email" type="email" autocomplete="email" placeholder="john@example.com"></label>
      ${f.birthday_active ? `<div class="row">
        <label>Birthday month<select required name="birthday_month"><option value="">Month</option>${months.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></label>
        <label>Birthday day<select required name="birthday_day"><option value="">Day</option>${Array.from({ length: 31 }, (_, i) => `<option>${i + 1}</option>`).join('')}</select></label>
      </div>` : ''}
      <label class="consent"><input type="checkbox" name="sms_consent"><span>Text me occasional offers${f.birthday_active ? ' and birthday treats' : ''}. Message and data rates may apply. Reply STOP to opt out.</span></label>
      <button class="cta" type="submit">${say('cta')}</button>
      <p class="privacy">Your information is kept private.</p>
    </form>
  </section>

  <section class="screen${on('unhappy')}" id="s-unhappy">
    <button class="back" type="button">← Change rating</button>
    <h1>${say('unhappy_headline')}</h1>
    <p class="sub">${say('unhappy_sub')}</p>
    <form id="f-unhappy" novalidate>
      <input class="hp" type="text" name="bh_verify" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="formerr" role="alert"></div>
      <label>What happened?<textarea name="feedback_text" maxlength="1000" placeholder="Tell us briefly…"></textarea></label>
      <div class="row">
        <label>Your name<input name="first_name" autocomplete="given-name" placeholder="John"></label>
        <label>Cell phone<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(555) 123-4567"></label>
      </div>
      <p class="privacy">Leave your number if you’d like a call back. This goes to the manager, not online.</p>
      <button class="cta" type="submit">${say('unhappy_cta')}</button>
    </form>
  </section>

  <section class="screen center${on('redirect')}" id="s-redirect">
    <div class="mark">${CHECK}</div>
    <h1 id="go-title">${say('thanks')}</h1>
    <div class="spin" aria-hidden="true"></div>
    <p class="golink">${f.preview ? 'Preview: customers go to your Google review page here.' : `Nothing happening? <a href="${esc(f.climbo_url)}">Open Google reviews</a>`}</p>
  </section>

  <section class="screen center${on('done')}" id="s-done">
    <div class="mark">${HEART}</div>
    <h1>Thank you.</h1>
    <p class="sub" style="margin-bottom:0">${unhappyMsg}</p>
  </section>
</div>
</main>
<footer>${style.show_powered ? 'Beehive Reviews by <b>EMRG Media</b>' : ''}</footer>
<script>
(function(){
  var slug=${JSON.stringify(f.slug)}, climbo=${JSON.stringify(f.climbo_url || '')}, happyFrom=${happyFrom}, preview=${f.preview ? 'true' : 'false'}, rating=0;
  var labels=${JSON.stringify(labels)};
  // Logo shape "auto": a wide logo (a wordmark) gets the white card and replaces the name.
  var auto=document.querySelector('img.logo.auto');
  function fit(){if(auto.naturalWidth>auto.naturalHeight*1.6){auto.classList.replace('auto','wide');auto.parentNode.classList.add('wordmark')}}
  if(auto){auto.complete?fit():auto.addEventListener('load',fit)}
  function show(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active')});document.getElementById(id).classList.add('active');window.scrollTo(0,0)}
  function digits(p){return (p||'').replace(/\\D/g,'')}
  var rates=[].slice.call(document.querySelectorAll('.rate')), starlabel=document.querySelector('.starlabel');
  function light(n){
    rates.forEach(function(b){b.classList.toggle('lit',+b.dataset.r<=n)});
    if(starlabel)starlabel.innerHTML=n?labels[n-1]:'&nbsp;';
  }
  rates.forEach(function(b){
    if(b.classList.contains('star')){
      b.addEventListener('mouseenter',function(){light(+b.dataset.r)});
      b.addEventListener('mouseleave',function(){light(rating)});
      b.addEventListener('focus',function(){light(+b.dataset.r)});
    }
    b.addEventListener('click',function(){
      rating=+b.dataset.r;
      rates.forEach(function(x){x.classList.toggle('picked',x===b)});
      light(rating);
      setTimeout(function(){show(rating>=happyFrom?'s-club':'s-unhappy')},260);
    });
  });
  document.querySelectorAll('.back').forEach(function(b){
    b.addEventListener('click',function(){rating=0;rates.forEach(function(x){x.classList.remove('picked')});light(0);show('s-rate')});
  });
  document.querySelectorAll('input[type=tel]').forEach(function(i){
    i.addEventListener('input',function(){
      var d=digits(i.value).slice(0,10);
      i.value=d.length>6?'('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6):d.length>3?'('+d.slice(0,3)+') '+d.slice(3):d;
    });
  });
  function validate(form,rules){
    var err=form.querySelector('.formerr'),missing=[];
    form.querySelectorAll('.miss').forEach(function(el){el.classList.remove('miss')});
    rules.forEach(function(r){
      var el=form.elements[r.name];if(!el)return;
      var v=(el.value||'').trim();
      var bad=!v||(r.min&&digits(v).length<r.min);
      if(bad){el.classList.add('miss');missing.push(r.label)}
    });
    if(missing.length){
      err.textContent='Almost there! Please add: '+missing.join(', ')+'.';
      err.classList.add('show');form.querySelector('.miss').focus();return false;
    }
    err.classList.remove('show');return true;
  }
  function submit(form,path,rules,after){
    form.addEventListener('submit',function(e){
      e.preventDefault();
      if(!validate(form,rules))return;
      var fd=new FormData(form),body={rating:rating,path:path,slug:slug};
      fd.forEach(function(v,k){body[k]=v});
      body.phone=digits(body.phone);
      body.sms_consent=fd.get('sms_consent')==='on';
      var btn=form.querySelector('.cta');btn.disabled=true;btn.textContent='One moment\\u2026';
      var isBot=!!body.bh_verify;delete body.bh_verify;
      var advanced=false;
      function go(res){if(advanced)return;advanced=true;after(res||{})}
      if(isBot||preview){setTimeout(function(){go({})},300);return}
      setTimeout(function(){go({})},4000);
      fetch('/api/public/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
        .then(function(r){return r.json()}).then(go).catch(function(){go({})});
    });
  }
  var clubRules=[{name:'first_name',label:'your first name'},{name:'phone',label:'your cell phone',min:10}];
  if(document.querySelector('#f-club select[name=birthday_month]')){
    clubRules.push({name:'birthday_month',label:'your birthday month'},{name:'birthday_day',label:'your birthday day'});
  }
  submit(document.getElementById('f-club'),'happy',clubRules,function(res){
    if(res.returning_visitor){
      document.getElementById('go-title').textContent='Welcome back'+(res.first_name?', '+res.first_name:'')+'! Taking you to Google\\u2026';
    }
    show('s-redirect');
    if(climbo&&!preview){setTimeout(function(){location.href=climbo},1200)}
  });
  submit(document.getElementById('f-unhappy'),'unhappy',[],function(){show('s-done')});
})();
<\/script>
</body></html>`;
}
