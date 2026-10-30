import { config, STORES } from './config.js';
import { BRANDS } from './brands.js';
import { escapeHtml as e, formatPrice, formatDate, formatDateTime, discountPercent, storeLocative, today } from './format.js';

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

export function layout({ title, body, noindex = false }) {
  const fullTitle = title ? `${title} · ${config.siteName}` : `${config.siteName} – je tvoj energeťák v akcii?`;
  // GitHub Pages nedovoľuje nastaviť hlavičky, preto je bezpečnostná politika v <meta>. Stránka nemá žiadny JavaScript.
  const csp = `default-src 'none'; style-src 'self'; img-src 'self' data:; form-action 'self' ${formOrigin()}; base-uri 'none'`;
  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${e(csp.trim())}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${e(fullTitle)}</title>
  <meta name="description" content="Automaticky sledujeme letáky Kauflandu a Billy a pošleme ti e-mail, keď sú Monster, Red Bull alebo Hell v akcii.">
  ${noindex ? '<meta name="robots" content="noindex">' : ''}
  <meta name="theme-color" content="#0f1220">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="topbar">
    <div class="wrap topbar__inner">
      <a class="brand" href="/"><span class="brand__bolt" aria-hidden="true">⚡</span>${e(config.siteName)}</a>
      <nav class="nav">
        <a href="/#akcie">Akcie</a>
        <a href="/#odber">Odber</a>
        <a href="/#faq">FAQ</a>
      </nav>
    </div>
  </header>
  <main>${body}</main>
  <footer class="footer">
    <div class="wrap">
      <p class="footer__links">
        <a href="/sukromie/">Ochrana súkromia</a>
        <a href="/podmienky/">Podmienky používania</a>
        ${config.contactEmail ? `<a href="mailto:${e(config.contactEmail)}">Kontakt</a>` : ''}
      </p>
      <p>Nezávislý neoficiálny projekt. Nie sme prepojení so spoločnosťami Monster Energy Company, Red Bull GmbH, HELL ENERGY Magyarország Kft., Kaufland ani BILLA, nie sme nimi sponzorovaní ani schválení. Uvedené názvy sú ochranné známky ich vlastníkov a používame ich len na označenie produktov a obchodov.</p>
      <p>Ceny zisťujeme automaticky z verejných letákov a môžu obsahovať chyby alebo sa líšiť podľa predajne. Záväzné sú vždy údaje v letáku a na predajni obchodu.</p>
      <p>${HEALTH_NOTE}</p>
      <p class="footer__muted">Táto stránka nepoužíva cookies ani sledovacie nástroje.</p>
    </div>
  </footer>
</body>
</html>`;
}

function dealCard(deal) {
  const pct = discountPercent(deal);
  const upcoming = deal.validFrom > today();
  return `
  <article class="deal deal--${e(deal.store)}">
    <div class="deal__top">
      <span class="chips"><span class="chip chip--${e(deal.store)}">${e(STORES[deal.store])}</span><span class="chip chip--brand">${e(BRANDS[deal.brand]?.name ?? '')}</span></span>
      ${pct ? `<span class="deal__pct">−${pct} %</span>` : ''}
    </div>
    <h3 class="deal__name">${e(deal.product)}</h3>
    <div class="deal__price">
      <strong>${e(formatPrice(deal.priceCents))}</strong>
      ${deal.regularPriceCents ? `<s>${e(formatPrice(deal.regularPriceCents))}</s>` : ''}
    </div>
    ${deal.note ? `<p class="deal__note">${e(deal.note)}</p>` : ''}
    <p class="deal__valid">${upcoming ? 'Od ' : 'Platí '}${e(formatDate(deal.validFrom))} do ${e(formatDate(deal.validTo))}${upcoming ? ' <span class="tag">čoskoro</span>' : ''}</p>
    ${deal.sourceUrl ? `<a class="deal__link" href="${e(deal.sourceUrl)}" target="_blank" rel="noopener noreferrer nofollow">Overiť v letáku →</a>` : ''}
  </article>`;
}

export function homePage({ deals, lastCheck }) {
  const now = today();
  const live = deals.filter((d) => d.validFrom <= now);
  const cheapest = live.reduce((min, d) => (!min || d.priceCents < min.priceCents ? d : min), null);

  const answer = cheapest
    ? `<p class="hero__answer hero__answer--yes">Áno! <span>${e(BRANDS[cheapest.brand]?.name)} od ${e(formatPrice(cheapest.priceCents))} v ${storeLocative(cheapest.store)}</span></p>`
    : deals.length
      ? `<p class="hero__answer">Čoskoro! <span>Akcia začína ${e(formatDate(deals[0].validFrom))}</span></p>`
      : `<p class="hero__answer hero__answer--no">Teraz nie. <span>Dáme ti vedieť, keď bude.</span></p>`;

  return layout({
    body: `
  <section class="hero">
    <div class="wrap hero__grid">
      <div>
        <p class="eyebrow">Monster · Red Bull · Hell</p>
        <h1>Je tvoj energeťák<br>v akcii?</h1>
        ${answer}
        <p class="hero__lead">Dvakrát denne automaticky prezrieme letáky Kauflandu a Billy a pošleme ti krátky e-mail, keď je tvoja obľúbená plechovka v zľave. Žiadny spam, žiadne cookies, odhlásenie jedným klikom.</p>
        ${lastCheck ? `<p class="hero__check">Posledná kontrola letákov: ${e(formatDateTime(lastCheck))}</p>` : ''}
      </div>
      ${signupCard()}
    </div>
  </section>

  <section class="section" id="akcie">
    <div class="wrap">
      <h2>Aktuálne akcie</h2>
      ${
        deals.length
          ? `<div class="deals">${deals.map(dealCard).join('')}</div>`
          : `<div class="empty"><div class="empty__can" aria-hidden="true"></div><p>V aktuálnych letákoch teraz nevidíme Monster, Red Bull ani Hell v akcii.<br>Prihlás sa na odber a dozvieš sa to medzi prvými.</p></div>`
      }
    </div>
  </section>

  <section class="section section--alt">
    <div class="wrap">
      <h2>Ako to funguje</h2>
      <ol class="steps">
        <li><strong>Zadáš e-mail</strong><span>Vyberieš značky, ktoré ťa zaujímajú.</span></li>
        <li><strong>Potvrdíš odber</strong><span>Klikneš na odkaz v e-maile – bez potvrdenia ti nič nepošleme.</span></li>
        <li><strong>Dostaneš upozornenie</strong><span>Keď sa plechovka objaví v letáku v akcii, príde ti krátka správa.</span></li>
      </ol>
    </div>
  </section>

  <section class="section" id="faq">
    <div class="wrap faq">
      <h2>Časté otázky</h2>
      <details><summary>Koľko e-mailov mi príde?</summary><p>Iba keď nájdeme novú akciu na značky, ktoré si si vybral(a) – zvyčajne nanajvýš pár správ mesačne.</p></details>
      <details><summary>Ako sa odhlásim?</summary><p>V každom e-maile je odkaz „Odhlásiť sa“. Jedným klikom sa odhlásiš a už ti nič nepošleme.</p></details>
      <details><summary>Odkiaľ beriete ceny?</summary><p>Dvakrát denne automaticky prečítame verejne dostupné letáky na stránkach Kauflandu a Billy. Program sa môže pomýliť, preto pri každej akcii nájdeš odkaz na overenie v letáku. Záväzná je vždy cena na predajni.</p></details>
      <details><summary>Ste oficiálna stránka niektorej značky alebo obchodu?</summary><p>Nie. Sme nezávislý fanúšikovský projekt a so žiadnou z týchto spoločností nie sme prepojení.</p></details>
      <details><summary>Čo robíte s mojím e-mailom?</summary><p>Používame ho len na tieto upozornenia. Nikomu ho nepredávame. Podrobnosti sú v <a href="/sukromie/">zásadách ochrany súkromia</a>.</p></details>
    </div>
  </section>`,
  });
}

function signupCard() {
  const lists = Object.entries(BRANDS).filter(([k]) => Number(config.brevo.lists[k]) > 0);
  if (!config.brevo.formUrl || !lists.length) {
    return `<div class="card signup" id="odber"><h2>Odber upozornení</h2><p class="notice notice--ok">Odber e-mailom spúšťame už čoskoro.</p></div>`;
  }
  // Formulár sa odosiela priamo do Brevo, ktoré pošle potvrdzovací e-mail (double opt-in).
  return `
  <div class="card signup" id="odber">
    <h2>Chcem upozornenie</h2>
    <form method="post" action="${e(config.brevo.formUrl)}" class="form">
      <label class="field">
        <span>E-mail</span>
        <input type="email" name="EMAIL" required maxlength="254" autocomplete="email" placeholder="ty@example.sk">
      </label>
      <fieldset class="stores">
        <legend>Značky</legend>
        ${lists.map(([k, b]) => `<label class="pill"><input type="checkbox" name="lists[]" value="${Number(config.brevo.lists[k])}" checked><span>${e(b.name)}</span></label>`).join('')}
      </fieldset>
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
      <button class="btn" type="submit">Prihlásiť odber</button>
      <p class="form__hint">Pošleme ti potvrdzovací e-mail. Odber začne až po kliknutí na odkaz.</p>
    </form>
  </div>`;
}

export function messagePage({ title, text, tone = 'info' }) {
  return layout({
    title,
    noindex: true,
    body: `<section class="section"><div class="wrap narrow"><div class="card message message--${e(tone)}"><h1>${e(title)}</h1><p>${e(text)}</p><p><a class="btn btn--ghost" href="/">Späť na úvod</a></p></div></div></section>`,
  });
}

export function privacyPage() {
  const operator = config.operatorName ? e(config.operatorName) : '<em>[doplň meno prevádzkovateľa v site.config.json]</em>';
  return layout({
    title: 'Ochrana súkromia',
    body: `<section class="section"><div class="wrap narrow prose">
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
  <p>Údaje spracúvame výlučne na zasielanie e-mailových upozornení na akcie energetických nápojov v obchodoch Kaufland a BILLA. Právnym základom je tvoj súhlas podľa čl. 6 ods. 1 písm. a) nariadenia GDPR a § 13 ods. 1 písm. a) zákona č. 18/2018 Z. z. o ochrane osobných údajov. Zasielanie e-mailov na základe súhlasu je v súlade aj s § 116 zákona č. 452/2021 Z. z. o elektronických komunikáciách.</p>
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
</div></section>`,
  });
}

export function termsPage() {
  return layout({
    title: 'Podmienky používania',
    body: `<section class="section"><div class="wrap narrow prose">
  <h1>Podmienky používania</h1>
  <p class="muted">Platné od 30. 10. 2026</p>

  <h2>1. O službe</h2>
  <p>${e(config.siteName)} je bezplatný, nekomerčný a nezávislý projekt, ktorý informuje o akciách na energetické nápoje Monster, Red Bull a Hell v obchodoch Kaufland a BILLA na Slovensku.</p>

  <h2>2. Nie sme oficiálna stránka</h2>
  <p>Služba nie je prepojená so spoločnosťami Monster Energy Company, Red Bull GmbH, HELL ENERGY Magyarország Kft., Kaufland Slovenská republika v.o.s. ani BILLA s.r.o., nie je nimi sponzorovaná, podporovaná ani schválená. Uvedené názvy sú ochranné známky ich vlastníkov. Používame ich výlučne na pomenovanie produktov a obchodov, o ktorých informujeme. Nepoužívame ich logá ani grafiku a nepreberáme obsah letákov – uvádzame len stručné faktické údaje (názov produktu, cenu, platnosť) s odkazom na zdroj.</p>

  <h2>3. Ako zisťujeme akcie a ich presnosť</h2>
  <p>Údaje zisťuje program automaticky z verejne dostupných stránok a letákov obchodov, dvakrát denne, v súlade so súbormi robots.txt a bez obchádzania akýchkoľvek technických opatrení. Automatické čítanie letákov sa môže pomýliť, akcia sa môže líšiť podľa predajne alebo môže byť tovar vypredaný. Záväzné sú vždy informácie obchodu (leták, cenovka, pokladnica). Za rozhodnutia urobené na základe údajov zo služby nezodpovedáme v rozsahu, v akom to právne predpisy dovoľujú.</p>

  <h2>4. Používanie služby</h2>
  <p>Na odber môžeš prihlásiť len vlastnú e-mailovú adresu. Služba je určená len osobám starším ako 18 rokov. Je zakázané službu zneužívať, preťažovať ani sa pokúšať o neoprávnený prístup.</p>

  <h2>5. Zdravie</h2>
  <p>Energetické nápoje majú vysoký obsah kofeínu a nie sú vhodné pre deti, mládež do 18 rokov, tehotné a dojčiace ženy. Konzumuj ich zodpovedne.</p>

  <h2>6. Zmena a ukončenie</h2>
  <p>Službu môžeme kedykoľvek zmeniť alebo ukončiť. Pri ukončení vymažeme všetky uložené e-mailové adresy.</p>

  <h2>7. Kontakt</h2>
  <p>Otázky, pripomienky alebo žiadosť o opravu či odstránenie údajov posielaj na ${CONTACT()}. Ak ako vlastník práv alebo prevádzkovateľ zdrojovej stránky nesúhlasíš s niektorým obsahom alebo so spôsobom získavania údajov, napíš nám a bezodkladne to upravíme alebo zastavíme.</p>
</div></section>`,
  });
}
