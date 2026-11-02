import { config, STORES } from './config.js';
import { BRANDS, SYRUP, productName } from './brands.js';
import { escapeHtml as e, formatPrice, formatDate, formatDateTime, shortDate, discountPercent, storeLocative, today } from './format.js';

const HEALTH_NOTE = 'Vysoký obsah kofeínu. Nevhodné pre deti, tehotné a dojčiace ženy.';
const CONTACT = () =>
  config.contactEmail ? `<a href="mailto:${e(config.contactEmail)}">${e(config.contactEmail)}</a>` : '<em>[doplň kontaktný e-mail]</em>';
const formOrigin = () => {
  try {
    return new URL(config.brevo.formUrl).origin;
  } catch {
    return '';
  }
};

// Výrezy plechoviek na stene v úvode sú z fotiek Wikimedia Commons (CC BY-SA 4.0) – licencia vyžaduje uviesť autora.
const PHOTO_CREDITS = [
  { title: 'Red Bull energy drinks', page: 'https://commons.wikimedia.org/wiki/File:Red_Bull_energy_drinks.jpg' },
  { title: 'Monster Energy drinks 04', page: 'https://commons.wikimedia.org/wiki/File:Monster_Energy_drinks_04.jpg' },
  { title: 'HELL energy drinks', page: 'https://commons.wikimedia.org/wiki/File:HELL_energy_drinks.jpg' },
];
const WALL = { redbull: 16, monster: 14, hell: 15 }; // počet výrezov v public/img/brands/wall/
const WALL_FIELDS = ['alu', 'acid', 'orange'];

const NAV = [
  ['/#akcie', 'Akcie'],
  ['/#odber', 'Odber'],
  ['/#otazky', 'Otázky'],
];

/** Čas poslednej kontroly. Bez skriptu dátum a čas, skript z neho urobí „dnes o 14:31“ podľa času návštevníka. */
const checkedAt = (iso) => `<time datetime="${e(iso)}" data-relative>${e(formatDateTime(iso))}</time>`;

const ARROW = '<svg class="arrow" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const DESCRIPTION = 'Automaticky sledujeme letáky Kauflandu, Billy, Lidla a COOP Jednoty a pošleme ti e-mail, keď sú Monster, Red Bull alebo Hell v akcii.';

export function layout({ title, body, noindex = false, home = false, samo = false, lastCheck = null, share = DESCRIPTION, path = '/' }) {
  const fullTitle = title ? `${title} · ${config.siteName}` : `${config.siteName} – je tvoj energeťák v akcii?`;
  // GitHub Pages nedovoľuje nastaviť hlavičky, preto je bezpečnostná politika v <meta>. Skript je len vlastný (animácie), žiadne cudzie.
  const csp = `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; form-action 'self' ${formOrigin()}; base-uri 'none'`;
  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${e(csp.trim())}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${e(fullTitle)}</title>
  <meta name="description" content="${e(DESCRIPTION)}">
  ${noindex ? '<meta name="robots" content="noindex">' : ''}
  <!-- Náhľad pri zdieľaní (Messenger, WhatsApp, Facebook, X). -->
  <meta property="og:type" content="website">
  <meta property="og:locale" content="sk_SK">
  <meta property="og:site_name" content="${e(config.siteName)}">
  <meta property="og:title" content="${e(samo ? 'Je tvoj sirup v akcii?' : home ? 'Je tvoj energeťák v akcii?' : fullTitle)}">
  <meta property="og:description" content="${e(share)}">
  <meta property="og:url" content="${e(config.baseUrl)}${e(path)}">
  <meta property="og:image" content="${e(config.baseUrl)}/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Plechovky Red Bull, Monster a Hell a otázka Je tvoj energeťák v akcii?">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#0b0b0c">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="/fonts/schibsted-grotesk-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">
  <script src="/app.js"></script>
</head>
<body>
  ${home || samo ? '' : topbar()}
  <main>${body}</main>
  ${footer(lastCheck, samo)}
</body>
</html>`;
}

function topbar() {
  return `<header class="bar">
    <a class="wordmark" href="/">${e(config.siteName)}</a>
    <nav class="bar__nav" aria-label="Hlavná navigácia">${NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}</nav>
    <a class="btn btn--small" href="/#odber">Chcem upozornenie</a>
  </header>`;
}

function footer(lastCheck, samo = false) {
  const credits = PHOTO_CREDITS.map((p) => `<a href="${p.page}">„${e(p.title)}“</a>`).join(', ');
  return `<footer class="footer">
    <div class="footer__top">
      <a class="footer__name" href="/">${e(config.siteName)}</a>
      <div class="footer__actions">
        ${samo
          ? `<a class="btn" href="/">Energeťáky v akcii ${ARROW}</a>`
          : `<a class="btn" href="/#odber">Chcem upozornenie ${ARROW}</a>`}
      </div>
    </div>
    <div class="footer__stores">
      <span>Sledujeme letáky</span>
      ${Object.entries(STORES).map(([key, name]) => `<img src="/img/stores/${key}.${key === 'coop' ? 'png' : 'svg'}" alt="${e(name)}" height="40" loading="lazy">`).join('')}
    </div>
    <div class="footer__grid">
      <nav class="footer__links" aria-label="Odkazy v pätičke">
        <a href="/#akcie">Aktuálne akcie</a>
        <a href="/#odber">Odber upozornení</a>
        <a href="/sukromie/">Ochrana súkromia</a>
        <a href="/podmienky/">Podmienky používania</a>
        ${samo
          ? `<a class="footer__samo" href="/">Energeťáky v akcii ${ARROW}</a>`
          : `<a class="footer__samo" href="/samo/">Zľavy pre Samka ${ARROW}</a>`}
        ${config.contactEmail ? `<a href="mailto:${e(config.contactEmail)}">${e(config.contactEmail)}</a>` : ''}
      </nav>
      <div class="footer__legal">
        <p>Nezávislý neoficiálny projekt. Nie sme prepojení so spoločnosťami Monster Energy Company, Red Bull GmbH, HELL ENERGY Magyarország Kft., Kaufland, BILLA, Lidl ani COOP Jednota, nie sme nimi sponzorovaní ani schválení. Uvedené názvy sú ochranné známky ich vlastníkov a používame ich len na označenie produktov a obchodov.</p>
        <p>Ceny zisťujeme automaticky z verejných letákov a môžu obsahovať chyby alebo sa líšiť podľa predajne. Záväzné sú vždy údaje v letáku a na predajni obchodu. ${HEALTH_NOTE}</p>
        <p>Letáky kontrolujeme dvakrát denne${lastCheck ? `, naposledy ${checkedAt(lastCheck)}` : ''}. Bez cookies a sledovania.</p>
        <p class="footer__credits">Fotky produktov pochádzajú z verejnej ponuky obchodov a výrobcov. Stena plechoviek v úvode: ${credits}, autor Oto Zapletal, <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.sk">CC BY-SA 4.0</a>, Wikimedia Commons, orezané. Písmo Schibsted Grotesk, SIL Open Font License.</p>
      </div>
    </div>
  </footer>`;
}

// --- Akcie ---

/** Objem jednej plechovky v litroch z názvu produktu („0,25 l“, „500 ml“). */
function volume(product) {
  const m = /(\d+(?:[.,]\d+)?)\s*(ml|l)\b/i.exec(product);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return m[2].toLowerCase() === 'ml' ? n / 1000 : n;
}

/** Plechovky stoja v skutočnom pomere výšok: 0,25 l je nižšia než 0,5 l. */
function canSize(product) {
  const l = volume(product);
  if (!l) return 'can--m';
  if (l <= 0.25) return 'can--s';
  if (l <= 0.355) return 'can--m';
  if (l <= 0.5) return 'can--l';
  return 'can--xl';
}

const DAY = 86_400_000;

/** „Bille, Kauflande a COOP Jednote“ */
const listJoin = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} a ${items.at(-1)}`);

/** Text do pásu obchodu: „Končí zajtra · do 3. 11.“, „Začína 4. 11.“ */
function when(deal) {
  const now = Date.parse(today());
  if (deal.validFrom > today()) {
    const days = Math.round((Date.parse(deal.validFrom) - now) / DAY);
    return days === 1 ? 'Začína zajtra' : `Začína ${shortDate(deal.validFrom)}`;
  }
  const days = Math.round((Date.parse(deal.validTo) - now) / DAY);
  const until = `do ${shortDate(deal.validTo)}`;
  if (days <= 0) return 'Dnes posledný deň';
  if (days === 1) return `Končí zajtra · ${until}`;
  return `Ešte ${days} ${days < 5 ? 'dni' : 'dní'} · ${until}`;
}

/** Ilustračný obrázok: plechovka značky, pri sirupe nakreslená fľaša. */
function can(brand, size) {
  const [file, alt] = brand === SYRUP ? ['sirup.svg', 'Ilustračný obrázok: fľaša sirupu'] : [`${brand}.webp`, `Plechovka ${BRANDS[brand]?.name ?? ''}`];
  return `<img class="can ${size}" src="/img/cans/${e(file)}" alt="${e(alt)}" width="350" height="900" loading="lazy" decoding="async">`;
}

function dealCard(deal, i) {
  const pct = discountPercent(deal);
  const size = canSize(deal.product);
  const picture = deal.image
    ? `<img class="can can--photo ${size}" src="/img/deals/${e(deal.image)}" alt="${e(deal.product)}" loading="lazy" decoding="async">`
    : can(deal.brand, size);
  return `
    <article class="deal deal--${e(deal.store)} reveal" data-delay="${i}">
      <header class="deal__where">
        <span class="deal__shop">${e(STORES[deal.store])}</span>
        <span class="deal__when">${e(when(deal))}</span>
      </header>
      <div class="deal__stage" data-tilt>
        ${pct ? `<span class="deal__badge">−${pct} %</span>` : ''}
        ${picture}
        <span class="deal__floor" aria-hidden="true"></span>
        ${deal.image ? '' : '<span class="deal__illus">Ilustračný obrázok</span>'}
      </div>
      <div class="deal__body">
        <h3 class="deal__name">${e(deal.product)}</h3>
        <p class="deal__price">
          <strong data-count-from="${deal.regularPriceCents ?? ''}" data-count-to="${deal.priceCents}">${e(formatPrice(deal.priceCents))}</strong>
          ${deal.regularPriceCents ? `<s>${e(formatPrice(deal.regularPriceCents))}</s>` : ''}
        </p>
        ${deal.note ? `<p class="deal__note">${e(deal.note[0].toUpperCase() + deal.note.slice(1))}</p>` : ''}
        ${deal.sourceUrl ? `<a class="deal__link" href="${e(deal.sourceUrl)}" target="_blank" rel="noopener noreferrer nofollow">Overiť v letáku ${ARROW}</a>` : ''}
      </div>
    </article>`;
}

/** Keď nič nie je v akcii, ukážeme, čo sledujeme: tri značky energeťákov alebo sirupy. */
function brandCard([key, name], i) {
  return `
    <article class="deal deal--idle reveal" data-delay="${i}">
      <div class="deal__stage" data-tilt>
        ${can(key, 'can--m')}
        <span class="deal__floor" aria-hidden="true"></span>
      </div>
      <div class="deal__body">
        <h3 class="deal__name">${e(name)}</h3>
        <p class="deal__status"><span class="dot"></span>Sledujeme, teraz nie je v akcii</p>
      </div>
    </article>`;
}

const ENERGY_IDLE = Object.entries(BRANDS).map(([key, b]) => [key, b.name]);

function deals(list, idle = ENERGY_IDLE) {
  const cls = list.length === 1 ? ' deals--one' : list.length === 2 ? ' deals--two' : '';
  return `<div class="deals${cls}">${list.length ? list.map(dealCard).join('') : idle.map(brandCard).join('')}</div>`;
}

/** Odpoveď na otázku z nadpisu: [„Áno.“, „Red Bull za 1,00 € v Bille, do 3. 11. 2026.“] */
function answerParts(list, nothing = 'Napíšeme ti, keď bude.') {
  const now = today();
  const live = list.filter((d) => d.validFrom <= now);
  const cheapest = live.reduce((min, d) => (!min || d.priceCents < min.priceCents ? d : min), null);
  if (cheapest) {
    return ['Áno.', `${productName(cheapest)} za ${formatPrice(cheapest.priceCents)} v ${storeLocative(cheapest.store)}, do ${formatDate(cheapest.validTo)}.`];
  }
  if (list.length) return ['Čoskoro.', `${productName(list[0])} od ${formatDate(list[0].validFrom)} v ${storeLocative(list[0].store)}.`];
  return ['Teraz nie.', nothing];
}

function answer(list, nothing) {
  const [lead, rest] = answerParts(list, nothing);
  return `<p class="panel__answer"><strong>${e(lead)}</strong> ${e(rest)}</p>`;
}

/** Stena plechoviek v úvode: riadky výrezov ako tehly, medzi nimi ploché farebné dlaždice. */
function wall() {
  const cans = Object.entries(WALL).flatMap(([brand, n]) => Array.from({ length: n }, (_, i) => `${brand}-${String(i).padStart(2, '0')}`));
  const rows = [];
  for (let r = 0; r < 5; r++) {
    const tiles = [];
    for (let c = 0; c < 15; c++) {
      if ((c * 7 + r * 3) % 9 === 0) {
        tiles.push(`<span class="wall__tile field--${WALL_FIELDS[(r + c) % WALL_FIELDS.length]}"></span>`);
      } else {
        const name = cans[(r * 17 + c * 5) % cans.length];
        tiles.push(`<img class="wall__tile" src="/img/brands/wall/${name}.webp" alt="" width="240" height="240" decoding="async">`);
      }
    }
    // Riadok je zdvojený, aby sa mohol plynule posúvať dokola.
    rows.push(`<div class="wall__row"><div class="wall__track">${tiles.join('')}${tiles.join('')}</div></div>`);
  }
  return `<div class="wall" aria-hidden="true">${rows.join('')}</div>`;
}

export function homePage({ deals: list, lastCheck }) {
  const stores = listJoin([...new Set(list.map((d) => storeLocative(d.store)))]);
  const count = list.length === 1 ? '1 akcia' : list.length < 5 ? `${list.length} akcie` : `${list.length} akcií`;

  return layout({
    home: true,
    lastCheck,
    share: `${answerParts(list).join(' ')} Upozorníme ťa e-mailom, keď je Monster, Red Bull alebo Hell v akcii v Kauflande, Bille, Lidli alebo COOP Jednote.`,
    body: `
  <section class="hero">
    ${wall()}
    <div class="panel">
      <div class="panel__text">
        <h1>Je tvoj energeťák v akcii?</h1>
        ${answer(list)}
      </div>
      <a class="btn btn--paper" href="#odber">Chcem upozornenie</a>
    </div>
  </section>

  <section class="section" id="akcie">
    <header class="section__head">
      <h2 data-split>V akcii práve teraz</h2>
      <p class="live reveal"><span class="dot"></span><span>${list.length ? `${count} v ${e(stores)}` : 'Monster, Red Bull ani Hell teraz nie sú v akcii'}${lastCheck ? ` · skontrolované ${checkedAt(lastCheck)}` : ''}</span></p>
    </header>
    ${deals(list)}
  </section>

  ${signup()}

  <section class="section faq" id="otazky">
    <header class="faq__head">
      <h2 data-split>Časté otázky</h2>
      <p class="reveal">Nenašiel si odpoveď? Napíš na ${CONTACT()}.</p>
    </header>
    <div class="faq__list">
      ${faqItem('Koľko e-mailov mi príde?', 'Iba keď nájdeme novú akciu na značky, ktoré si si vybral(a). Zvyčajne nanajvýš pár správ mesačne.', true)}
      ${faqItem('Čo robíte s mojím e-mailom?', 'Používame ho len na tieto upozornenia. Nikomu ho nepredávame. Podrobnosti sú v <a href="/sukromie/">zásadách ochrany súkromia</a>.')}
      ${faqItem('Ako sa odhlásim?', 'V každom e-maile je odkaz „Odhlásiť sa“. Jedným klikom sa odhlásiš a už ti nič nepošleme.')}
      ${faqItem('Odkiaľ beriete ceny?', 'Dvakrát denne automaticky prečítame verejne dostupné letáky a ponuky na stránkach Kauflandu, Billy, Lidla a COOP Jednoty. Program sa môže pomýliť, preto pri každej akcii nájdeš odkaz na overenie v letáku. Záväzná je vždy cena na predajni.')}
      ${faqItem('Ste oficiálna stránka niektorej značky alebo obchodu?', 'Nie. Sme nezávislý fanúšikovský projekt a so žiadnou z týchto spoločností nie sme prepojení.')}
    </div>
  </section>`,
  });
}

// Na /samo sa e-maily neposielajú, preto bez sľubu „napíšeme ti“.
const SAMO_NOTHING = 'Letáky kontrolujeme dvakrát denne, pozri sa sem znova.';

/** /samo – zľavy na sirupy pre Samka. Rovnaký úvod ako hlavná stránka, bez odberu e-mailom. */
export function samoPage({ deals: list, lastCheck }) {
  const stores = listJoin([...new Set(list.map((d) => storeLocative(d.store)))]);
  const count = list.length === 1 ? '1 sirup' : list.length < 5 ? `${list.length} sirupy` : `${list.length} sirupov`;

  return layout({
    title: 'Zľavy pre Samka',
    samo: true,
    lastCheck,
    path: '/samo/',
    share: `${answerParts(list, SAMO_NOTHING).join(' ')} Sirupy v akcii v Kauflande, Bille, Lidli a COOP Jednote.`,
    body: `
  <section class="hero">
    ${wall()}
    <div class="panel">
      <div class="panel__text">
        <h1>Je tvoj sirup v akcii?</h1>
        ${answer(list, SAMO_NOTHING)}
      </div>
      <a class="btn btn--paper" href="#akcie">Pozri akcie</a>
    </div>
  </section>

  <section class="section" id="akcie">
    <header class="section__head">
      <h2 data-split>Sirupy v akcii</h2>
      <p class="live reveal"><span class="dot"></span><span>${list.length ? `${count} v ${e(stores)}` : 'Teraz nie je v akcii žiadny sirup'}${lastCheck ? ` · skontrolované ${checkedAt(lastCheck)}` : ''}</span></p>
    </header>
    ${deals(list, [[SYRUP, 'Sirupy']])}
  </section>`,
  });
}

function faqItem(question, answerHtml, open = false) {
  return `<details class="qa reveal" name="otazky"${open ? ' open' : ''}><summary>${e(question)}<span class="qa__icon" aria-hidden="true"></span></summary><div class="qa__body"><p>${answerHtml}</p></div></details>`;
}

function signup() {
  const lists = Object.entries(BRANDS).filter(([k]) => Number(config.brevo.lists[k]) > 0);
  const head = `<header class="signup__head">
      <h2 data-split>Chcem vedieť o akcii ako prvý</h2>
      <p class="reveal">Vyber si plechovky. E-mail príde len vtedy, keď je niektorá z nich v letáku v zľave.</p>
      <ol class="signup__steps reveal">
        <li>Vyberieš plechovky a zadáš e-mail</li>
        <li>Potvrdíš odkaz v e-maile</li>
        <li>Príde správa, keď je akcia</li>
      </ol>
    </header>`;
  if (!config.brevo.formUrl || !lists.length) {
    return `<section class="signup" id="odber">${head}<p class="signup__soon reveal">Odber e-mailom spúšťame už čoskoro.</p></section>`;
  }
  // Formulár sa odosiela priamo do Brevo, ktoré pošle potvrdzovací e-mail (double opt-in).
  return `
  <section class="signup" id="odber">
    ${head}
    <form method="post" action="${e(config.brevo.formUrl)}" class="signup__form">
      <fieldset class="picks">
        <legend class="sr-only">Značky</legend>
        ${lists.map(([k, b], i) => `
        <label class="pick reveal" data-delay="${i}">
          <input type="checkbox" name="lists[]" value="${Number(config.brevo.lists[k])}" checked>
          <span class="pick__card">
            <img src="/img/cans/${k}.webp" alt="" width="350" height="900" loading="lazy" decoding="async">
            <span class="pick__name">${e(b.name)}</span>
            <span class="pick__check" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          </span>
        </label>`).join('')}
      </fieldset>
      <div class="signup__fields reveal">
        <label class="email">
          <span class="sr-only">Tvoj e-mail</span>
          <input type="email" name="EMAIL" required maxlength="254" autocomplete="email" placeholder="tvoj@email.sk">
          <button class="btn" type="submit">Prihlásiť odber ${ARROW}</button>
        </label>
        <label class="hp" aria-hidden="true">Nevypĺňaj<input type="text" name="email_address_check" value="" tabindex="-1" autocomplete="off"></label>
        <input type="hidden" name="locale" value="sk">
        <label class="check">
          <input type="checkbox" name="OPT_IN" value="1" required>
          <span>Súhlasím so spracovaním mojej e-mailovej adresy na zasielanie upozornení na akcie podľa <a href="/sukromie/" target="_blank">zásad ochrany súkromia</a>. Súhlas môžem kedykoľvek odvolať.</span>
        </label>
        <label class="check">
          <input type="checkbox" required>
          <span>Mám aspoň 18 rokov.</span>
        </label>
        <p class="signup__hint">Pošleme ti potvrdzovací e-mail. Odber začne až po kliknutí na odkaz v ňom. Adresu za nás uchováva a e-maily odosiela služba Brevo.</p>
      </div>
    </form>
  </section>`;
}

/** Sem presmeruje Brevo po potvrdení odberu. Akcie, ktoré už boli oznámené, ukážeme hneď tu – e-mailom príde až ďalšia. */
export function subscribedPage({ deals: list }) {
  return layout({
    title: 'Odber je aktívny',
    noindex: true,
    body: `${message('Odber je aktívny', 'Ďakujeme! E-mail ti pošleme vždy, keď v letákoch nájdeme novú akciu na tvoj energeťák. Odhlásiť sa môžeš v každom e-maile.')}
    ${
      list.length
        ? `<section class="section section--flush"><header class="section__head"><h2 data-split>Čo je v akcii práve teraz</h2></header>${deals(list)}</section>`
        : ''
    }`,
  });
}

export function messagePage({ title, text }) {
  return layout({ title, noindex: true, body: message(title, text) });
}

/** Krátka správa vľavo, tri plechovky vpravo. */
function message(title, text) {
  return `<section class="section message">
      <div class="message__text">
        <h1 data-split>${e(title)}</h1>
        <p class="reveal">${e(text)}</p>
        <a class="btn reveal" href="/">Späť na úvod ${ARROW}</a>
      </div>
      <div class="message__cans" aria-hidden="true">
        ${['redbull', 'monster', 'hell'].map((b, i) => `<img class="reveal" data-delay="${i}" src="/img/cans/${b}.webp" alt="" width="350" height="900" decoding="async">`).join('')}
      </div>
    </section>`;
}

export function privacyPage() {
  const operator = config.operatorName ? e(config.operatorName) : '<em>[doplň meno prevádzkovateľa v site.config.json]</em>';
  return layout({
    title: 'Ochrana súkromia',
    body: `<section class="section prose">
  <h1>Zásady ochrany súkromia</h1>
  <p class="muted">Platné od 30. 10. 2026</p>

  <h2>1. Kto spracúva tvoje údaje</h2>
  <p>Prevádzkovateľom je ${operator}. Kontakt: ${CONTACT()}.</p>

  <h2>2. Aké údaje spracúvame</h2>
  <ul>
    <li>tvoju e-mailovú adresu,</li>
    <li>výber značiek, o ktorých chceš dostávať upozornenia,</li>
    <li>záznam o udelení súhlasu a potvrdení odberu (dátum, čas a technické údaje, ktoré na tento účel ukladá Brevo),</li>
    <li>štatistiky doručenia e-mailov (napr. či bol e-mail doručený alebo otvorený), ktoré automaticky vytvára Brevo.</li>
  </ul>
  <p>Samotná stránka nepoužíva cookies, analytické ani reklamné nástroje a nevytvárame žiadne profily.</p>

  <h2>3. Účel a právny základ</h2>
  <p>Údaje spracúvame výlučne na zasielanie e-mailových upozornení na akcie energetických nápojov v obchodoch Kaufland, BILLA, Lidl a COOP Jednota. Právnym základom je tvoj súhlas podľa čl. 6 ods. 1 písm. a) nariadenia GDPR a § 13 ods. 1 písm. a) zákona č. 18/2018 Z. z. o ochrane osobných údajov. Zasielanie e-mailov na základe súhlasu je v súlade aj s § 116 zákona č. 452/2021 Z. z. o elektronických komunikáciách.</p>
  <p>Súhlas udeľuješ dvojstupňovo: zaškrtnutím políčka a potvrdením odkazu v e-maile (double opt-in). Služba je určená len osobám starším ako 18 rokov.</p>

  <h2>4. Kto ďalší má k údajom prístup</h2>
  <ul>
    <li><strong>Brevo</strong> (Sendinblue SAS, Francúzsko) – uchováva zoznam odberateľov a odosiela e-maily. Údaje spracúva v EÚ ako náš sprostredkovateľ.</li>
    <li><strong>GitHub Pages</strong> (GitHub, Inc., USA) – hosting stránky. Pri návšteve stránky môže z bezpečnostných dôvodov zaznamenať tvoju IP adresu. Prenos do USA je chránený rámcom EÚ – USA pre ochranu osobných údajov (Data Privacy Framework).</li>
  </ul>
  <p>Údaje nepredávame ani neposkytujeme nikomu ďalšiemu.</p>

  <h2>5. Ako dlho údaje uchovávame</h2>
  <ul>
    <li>Kým sa neodhlásiš. Odhlásiť sa môžeš kedykoľvek odkazom v každom e-maile.</li>
    <li>Po odhlásení zostane tvoja adresa len na zozname odhlásených, aby sme ti omylom už nič neposlali. Ak chceš úplné vymazanie, napíš nám.</li>
  </ul>

  <h2>6. Tvoje práva</h2>
  <p>Máš právo kedykoľvek odvolať súhlas, právo na prístup k údajom, ich opravu, vymazanie, obmedzenie spracúvania a prenosnosť. Odvolanie súhlasu nemá vplyv na zákonnosť spracúvania pred jeho odvolaním. Žiadosti posielaj na ${CONTACT()}; vybavíme ich bez zbytočného odkladu, najneskôr do jedného mesiaca.</p>
  <p>Ak sa domnievaš, že spracúvaním porušujeme predpisy, môžeš podať sťažnosť na <a href="https://dataprotection.gov.sk" target="_blank" rel="noopener noreferrer">Úrad na ochranu osobných údajov Slovenskej republiky</a>, Hraničná 12, 820 07 Bratislava.</p>

  <h2>7. Zabezpečenie</h2>
  <p>Stránka je dostupná len cez šifrované spojenie (HTTPS). Zoznam odberateľov nie je uložený na stránke ani v jej zdrojovom kóde – je len v zabezpečenom účte Brevo, ku ktorému má prístup iba prevádzkovateľ.</p>

  <h2>8. Zmeny</h2>
  <p>Pri podstatnej zmene týchto zásad ťa o nej vopred informujeme e-mailom.</p>
</section>`,
  });
}

export function termsPage() {
  return layout({
    title: 'Podmienky používania',
    body: `<section class="section prose">
  <h1>Podmienky používania</h1>
  <p class="muted">Platné od 2. 11. 2026</p>

  <h2>1. O službe</h2>
  <p>${e(config.siteName)} je bezplatný, nekomerčný a nezávislý projekt, ktorý informuje o akciách na energetické nápoje Monster, Red Bull a Hell a na sirupy v obchodoch Kaufland, BILLA, Lidl a COOP Jednota na Slovensku.</p>

  <h2>2. Nie sme oficiálna stránka</h2>
  <p>Služba nie je prepojená so spoločnosťami Monster Energy Company, Red Bull GmbH, HELL ENERGY Magyarország Kft., Kaufland Slovenská republika v.o.s., BILLA s.r.o., Lidl Slovenská republika, v.o.s. ani COOP Jednota Slovensko, spotrebné družstvo, nie je nimi sponzorovaná, podporovaná ani schválená. Uvedené názvy sú ochranné známky ich vlastníkov. Používame ich výlučne na pomenovanie produktov a obchodov, o ktorých informujeme, a ich logá ani grafiku nepoužívame na označenie tejto služby.</p>
  <p>Pri akcii zobrazujeme fotografiu produktu, aby bolo jasné, o ktorý výrobok ide: pri Kauflande a Lidli fotografiu z ich verejnej ponuky, inak ilustračný obrázok (fotografiu bežnej plechovky danej značky z verejnej ponuky obchodu alebo výrobcu, pri sirupoch nakreslenú fľašu), označený ako ilustračný. Fotografie plechoviek v úvode stránky sú z Wikimedia Commons pod licenciou CC BY-SA 4.0 s uvedením autora v pätičke. Z letákov inak uvádzame len stručné faktické údaje (názov produktu, cenu, platnosť) s odkazom na zdroj.</p>

  <h2>3. Ako zisťujeme akcie a ich presnosť</h2>
  <p>Údaje zisťuje program automaticky z verejne dostupných stránok a letákov obchodov, dvakrát denne, v súlade so súbormi robots.txt a bez obchádzania akýchkoľvek technických opatrení. Automatické čítanie letákov sa môže pomýliť, akcia sa môže líšiť podľa predajne alebo môže byť tovar vypredaný. Záväzné sú vždy informácie obchodu (leták, cenovka, pokladnica). Za rozhodnutia urobené na základe údajov zo služby nezodpovedáme v rozsahu, v akom to právne predpisy dovoľujú.</p>

  <h2>4. Používanie služby</h2>
  <p>Na odber môžeš prihlásiť len vlastnú e-mailovú adresu. Služba je určená len osobám starším ako 18 rokov. Je zakázané službu zneužívať, preťažovať ani sa pokúšať o neoprávnený prístup.</p>

  <h2>5. Zdravie</h2>
  <p>Energetické nápoje majú vysoký obsah kofeínu a nie sú vhodné pre deti, mládež do 18 rokov, tehotné a dojčiace ženy. Konzumuj ich zodpovedne.</p>

  <h2>6. Zmena a ukončenie</h2>
  <p>Službu môžeme kedykoľvek zmeniť alebo ukončiť. Pri ukončení vymažeme všetky uložené e-mailové adresy.</p>

  <h2>7. Kontakt</h2>
  <p>Otázky, pripomienky alebo žiadosť o opravu či odstránenie údajov posielaj na ${CONTACT()}. Ak ako vlastník práv alebo prevádzkovateľ zdrojovej stránky nesúhlasíš s niektorým obsahom, fotografiou alebo so spôsobom získavania údajov, napíš nám a bezodkladne to upravíme alebo zastavíme.</p>
</section>`,
  });
}
