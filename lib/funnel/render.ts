// Customer facing funnel, moved from Mario's demo (renderFunnel in beehive-multitenant-demo.html).
// Returns one complete HTML page as a string (~12KB, no React). Served by app/c/[slug]/route.ts.
// Templates: midnight (restaurant/bar), ivory (dental/professional), marquee (nightlife), trade.
// Brand tokens inject as CSS variables. Copy slots fill per client. Layout never changes.

export type Template = 'midnight' | 'ivory' | 'marquee' | 'trade';
export type FontPairing = 'classic' | 'modern' | 'editorial' | 'bold' | 'quiet' | 'trade';

// Optional wording overrides stored in funnels.copy_slots.
export interface CopySlots {
  club_headline?: string;
  club_sub?: string;
  reassure?: string;
  thanks?: string;
}

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
}

const FONT_PAIRINGS: Record<FontPairing, { display: string; body: string; gf: string }> = {
  classic:   { display: `'Playfair Display', Georgia, serif`, body: `'Inter', -apple-system, sans-serif`, gf: 'Playfair+Display:wght@700&family=Inter:wght@400;600' },
  modern:    { display: `'Space Grotesk', sans-serif`,        body: `'Inter', -apple-system, sans-serif`, gf: 'Space+Grotesk:wght@700&family=Inter:wght@400;600' },
  editorial: { display: `'Fraunces', Georgia, serif`,         body: `'Source Sans 3', sans-serif`,        gf: 'Fraunces:wght@700&family=Source+Sans+3:wght@400;600' },
  bold:      { display: `'Archivo Black', sans-serif`,        body: `'Archivo', sans-serif`,              gf: 'Archivo+Black&family=Archivo:wght@400;600' },
  quiet:     { display: `'Libre Baskerville', Georgia, serif`,body: `'Inter', -apple-system, sans-serif`, gf: 'Libre+Baskerville:wght@700&family=Inter:wght@400;600' },
  trade:     { display: `'Oswald', sans-serif`,               body: `'Inter', -apple-system, sans-serif`, gf: 'Oswald:wght@600;700&family=Inter:wght@400;600' },
};

const THEMES: Record<Template, { bg: string; surface: string; text: string; dim: string; border: string }> = {
  midnight: { bg: '#0D0C0B', surface: '#171512', text: '#F5F1E8', dim: '#9C948A', border: '#2A261F' },
  ivory:    { bg: '#FAF9F5', surface: '#FFFFFF', text: '#1B1A17', dim: '#6E6A61', border: '#E4E0D6' },
  marquee:  { bg: '#050505', surface: '#111111', text: '#FFFFFF', dim: '#8A8A8A', border: '#222222' },
  trade:    { bg: '#12161C', surface: '#1A1F27', text: '#F3F6FA', dim: '#9AA4B2', border: '#283039' },
};

const esc = (s: string = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function renderFunnel(f: FunnelView | null): string {
  if (!f) return `<!doctype html><meta charset="utf-8"><title>Not found</title>
    <body style="font-family:sans-serif;background:#0D0C0B;color:#F5F1E8;display:grid;place-items:center;min-height:100vh;margin:0">
    <p>This page is not available right now.</p></body>`;

  const theme = THEMES[f.template] || THEMES.midnight;
  const fonts = FONT_PAIRINGS[f.font_pairing] || FONT_PAIRINGS.classic;
  const slots = f.copy_slots || {};
  const professional = f.industry === 'professional' || f.industry === 'dental' || f.industry === 'legal';
  const trade = f.industry === 'roofing' || f.industry === 'home-services';
  const formal = professional || trade;
  const labels = formal
    ? ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent']
    : ['TERRIBLE', 'POOR', 'OKAY', 'GOOD', 'AMAZING'];
  const emojis = ['\u{1F625}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F601}'];
  const question = f.rating_question || 'How was your visit?';
  const listHeadline = professional ? 'Join our client appreciation list'
    : trade ? 'Join our customer care list'
    : 'Join our Birthday Club! \u{1F382}';
  const clubHeadline = slots.club_headline || listHeadline;
  const clubSub = slots.club_sub || `Leave your info and we'll take you to Google Reviews.`;
  const reassure = slots.reassure || 'Your honest feedback helps us improve. Every response is read by our team.';
  const unhappyMsg = f.unhappy_message || 'Thank you for the honest feedback. A manager will follow up with you personally.';
  const thanks = slots.thanks || 'Thank you! Taking you to Google…';
  const happyFrom = f.okay_routes_happy ? 3 : 4;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(f.client_name)} — Feedback</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${fonts.gf}&display=swap" rel="stylesheet">
<style>
:root{--brand:${esc(f.brand_primary)};--accent:${esc(f.brand_accent)};--bg:${theme.bg};--surface:${theme.surface};--text:${theme.text};--dim:${theme.dim};--border:${theme.border}}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--text);font-family:${fonts.body};min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px 20px 40px}
header{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:8px;text-align:center}
.logo{width:56px;height:56px;border-radius:50%;object-fit:contain;padding:6px;background:#fff;border:2px solid var(--brand)}
.logofallback{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;background:var(--brand);color:var(--bg);font-weight:700;font-size:24px;font-family:${fonts.display}}
.bizname{font-family:${fonts.display};font-size:22px;letter-spacing:.02em}
.powered{font-size:10px;letter-spacing:.28em;color:var(--dim);text-transform:uppercase}
main{width:100%;max-width:560px;flex:1;display:flex;flex-direction:column;justify-content:center}
.screen{display:none;animation:fade .25s ease}
.screen.active{display:block}
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.screen{animation:none}}
h1{font-family:${fonts.display};font-size:clamp(26px,7vw,40px);text-align:center;line-height:1.15}
.sub{text-align:center;color:var(--dim);margin:14px 0 34px;font-size:17px}
.faces{display:flex;justify-content:space-between;gap:6px}
.face{background:none;border:0;color:var(--dim);font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:10px;cursor:pointer;padding:8px 2px;min-width:52px;min-height:88px;border-radius:14px;transition:transform .1s}
.face span.e{font-size:clamp(34px,9vw,48px);line-height:1}
.face span.l{font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.face:active{transform:scale(1.15)}
.face:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.reassure{margin-top:40px;border:1px solid var(--border);background:var(--surface);border-radius:14px;padding:18px 20px;text-align:center;color:var(--dim);font-size:15px;line-height:1.5}
form{display:grid;gap:16px;margin-top:26px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
label{font-size:14px;font-weight:600;display:grid;gap:7px}
label small{font-weight:400;color:var(--dim)}
input,select{width:100%;padding:15px 14px;font-size:16px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:inherit}
input:focus,select:focus{outline:2px solid var(--brand);border-color:var(--brand)}
.consent{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--dim);font-weight:400}
.consent input{width:20px;height:20px;margin-top:1px}
.cta{margin-top:6px;padding:18px;font-size:18px;font-weight:700;border:0;border-radius:12px;background:var(--brand);color:var(--bg);cursor:pointer;min-height:56px}
.cta:active{filter:brightness(.9)}
.cta:disabled{opacity:.6}
.privacy{text-align:center;color:var(--dim);font-size:12px;margin-top:12px}
input.miss,select.miss{border-color:#E05252;outline:2px solid #E05252}
.formerr{display:none;background:rgba(224,82,82,.12);border:1px solid #E05252;color:var(--text);border-radius:10px;padding:12px 14px;font-size:14px;text-align:center}
.formerr.show{display:block}
.hp{position:absolute;left:-9999px}
.center{text-align:center}
.big{font-size:56px;margin-bottom:16px}
footer{margin-top:36px;font-size:10px;letter-spacing:.3em;color:var(--dim);text-transform:uppercase;display:flex;align-items:center;gap:14px;width:100%;max-width:560px}
footer::before,footer::after{content:"";flex:1;height:1px;background:var(--border)}
.spin{width:26px;height:26px;border:3px solid var(--border);border-top-color:var(--brand);border-radius:50%;margin:18px auto 0;animation:rot .8s linear infinite}
@keyframes rot{to{transform:rotate(360deg)}}
</style></head>
<body>
<header>
  ${f.logo_url ? `<img class="logo" src="${esc(f.logo_url)}" alt="">` : `<div class="logofallback">${esc(f.client_name[0] || 'B')}</div>`}
  <div class="bizname">${esc(f.client_name)}</div>
  <div class="powered">Powered by EMRG Media</div>
</header>
<main>
  <section class="screen active" id="s-rate">
    <h1>${esc(question)}</h1>
    <p class="sub">Tap a face to get started</p>
    <div class="faces" role="group" aria-label="Rate your experience">
      ${emojis.map((e, i) => `<button class="face" data-r="${i + 1}" aria-label="${esc(labels[i])}"><span class="e">${e}</span><span class="l">${esc(labels[i])}</span></button>`).join('')}
    </div>
    <div class="reassure">${esc(reassure)}</div>
  </section>

  <section class="screen" id="s-club">
    <h1 class="center">${esc(clubHeadline)}</h1>
    <p class="sub">${esc(clubSub)}</p>
    <form id="f-club" autocomplete="on" novalidate>
      <input class="hp" type="text" name="bh_verify" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="formerr" role="alert"></div>
      <div class="row">
        <label>First name<input required name="first_name" autocomplete="given-name" placeholder="John"></label>
        <label>Last name <small>(optional)</small><input name="last_name" autocomplete="family-name" placeholder="Doe"></label>
      </div>
      <label>Cell phone<input required name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(555) 123-4567"></label>
      <label>Email <small>(optional, for offers)</small><input name="email" type="email" autocomplete="email" placeholder="john@example.com"></label>
      ${f.birthday_active ? `<div class="row">
        <label>Birthday month<select required name="birthday_month"><option value="">Month</option>${months.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></label>
        <label>Birthday day<select required name="birthday_day"><option value="">Day</option>${Array.from({ length: 31 }, (_, i) => `<option>${i + 1}</option>`).join('')}</select></label>
      </div>` : ''}
      <label class="consent"><input type="checkbox" name="sms_consent"><span>Text me occasional offers${f.birthday_active ? ' and birthday treats' : ''}. Message and data rates may apply. Reply STOP to opt out.</span></label>
      <button class="cta" type="submit">Submit &amp; Leave a Review →</button>
      <p class="privacy">Your information will be kept private.</p>
    </form>
  </section>

  <section class="screen" id="s-unhappy">
    <h1 class="center">${formal ? 'We want to make this right.' : 'We’re sorry to hear that.'}</h1>
    <p class="sub">Tell us what happened and we’ll take care of it.</p>
    <form id="f-unhappy" novalidate>
      <input class="hp" type="text" name="bh_verify" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="formerr" role="alert"></div>
      <label>Your name<input name="first_name" autocomplete="given-name" placeholder="John"></label>
      <label>Cell phone <small>(so we can follow up)</small><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(555) 123-4567"></label>
      <label>What happened?<input name="feedback_text" placeholder="Tell us briefly…"></label>
      <button class="cta" type="submit">Send to the manager</button>
    </form>
  </section>

  <section class="screen center" id="s-redirect">
    <div class="big">\u{1F31F}</div>
    <h1>${esc(thanks)}</h1>
    <div class="spin" aria-hidden="true"></div>
  </section>

  <section class="screen center" id="s-back">
    <div class="big">\u{1F44B}</div>
    <h1>Welcome back<span id="backname"></span>!</h1>
    <p class="sub">Great to see you again. Taking you to Google…</p>
    <div class="spin" aria-hidden="true"></div>
  </section>

  <section class="screen center" id="s-done">
    <div class="big">\u{1F91D}</div>
    <h1>Thank you.</h1>
    <p class="sub">${esc(unhappyMsg)}</p>
  </section>
</main>
<footer>Beehive Reviews by EMRG Media</footer>
<script>
(function(){
  var slug=${JSON.stringify(f.slug)}, climbo=${JSON.stringify(f.climbo_url || '')}, happyFrom=${happyFrom}, rating=0;
  function show(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active')});document.getElementById(id).classList.add('active');window.scrollTo(0,0)}
  function digits(p){return (p||'').replace(/\\D/g,'')}
  document.querySelectorAll('.face').forEach(function(b){
    b.addEventListener('click',function(){
      rating=+b.dataset.r;
      b.style.transform='scale(1.2)';
      setTimeout(function(){show(rating>=happyFrom?'s-club':'s-unhappy')},120);
    });
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
      if(isBot){go({});return}
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
      var n=document.getElementById('backname');
      if(res.first_name){n.textContent=', '+res.first_name}
      show('s-back');
    } else { show('s-redirect'); }
    if(climbo){setTimeout(function(){location.href=climbo},1200)}
  });
  submit(document.getElementById('f-unhappy'),'unhappy',[],function(){show('s-done')});
})();
<\/script>
</body></html>`;
}
