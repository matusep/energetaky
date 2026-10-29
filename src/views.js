import { config, STORES } from './config.js';
import { BRANDS } from './brands.js';
import { escapeHtml as e, formatPrice, formatDate, discountPercent, storeLocative } from './format.js';
import { today } from './db.js';

const HEALTH_NOTE = 'Vysoký obsah kofeínu. Nevhodné pre deti, tehotné a dojčiace ženy.';
const CONTACT = () =>
  config.contactEmail ? `<a href="mailto:${e(config.contactEmail)}">${e(config.contactEmail)}</a>` : '<em>[doplň kontaktný e-mail]</em>';
const fmtDateTime = (iso) => new Date(iso).toLocaleString('sk-SK', { timeZone: 'Europe/Bratislava', dateStyle: 'short', timeStyle: 'short' });

export function layout({ title, body, noindex = false }) {
  const fullTitle = title ? `${title} · ${config.siteName}` : `${config.siteName} – je tvoj energeťák v akcii?`;
  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
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
        <a href="/sukromie">Ochrana súkromia</a>
        <a href="/podmienky">Podmienky používania</a>
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
  const upcoming = deal.valid_from > today();
  return `
  <article class="deal deal--${e(deal.store)}">
    <div class="deal__top">
      <span class="chips"><span class="chip chip--${e(deal.store)}">${e(STORES[deal.store])}</span><span class="chip chip--brand">${e(BRANDS[deal.brand]?.name ?? '')}</span></span>
      ${pct ? `<span class="deal__pct">−${pct} %</span>` : ''}
    </div>
    <h3 class="deal__name">${e(deal.product)}</h3>
    <div class="deal__price">
      <strong>${e(formatPrice(deal.price_cents))}</strong>
      ${deal.regular_price_cents ? `<s>${e(formatPrice(deal.regular_price_cents))}</s>` : ''}
    </div>
    ${deal.note ? `<p class="deal__note">${e(deal.note)}</p>` : ''}
    <p class="deal__valid">${upcoming ? 'Od ' : 'Platí '}${e(formatDate(deal.valid_from))} do ${e(formatDate(deal.valid_to))}${upcoming ? ' <span class="tag">čoskoro</span>' : ''}</p>
    ${deal.source_url ? `<a class="deal__link" href="${e(deal.source_url)}" target="_blank" rel="noopener noreferrer nofollow">Overiť v letáku →</a>` : ''}
  </article>`;
}

export function homePage({ deals, notice, lastCheck }) {
  const now = today();
  const live = deals.filter((d) => d.valid_from <= now);
  const cheapest = live.reduce((min, d) => (!min || d.price_cents < min.price_cents ? d : min), null);

  const answer = cheapest
    ? `<p class="hero__answer hero__answer--yes">Áno! <span>${e(BRANDS[cheapest.brand]?.name)} od ${e(formatPrice(cheapest.price_cents))} v ${storeLocative(cheapest.store)}</span></p>`
    : deals.length
      ? `<p class="hero__answer">Čoskoro! <span>Akcia začína ${e(formatDate(deals[0].valid_from))}</span></p>`
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
        ${lastCheck ? `<p class="hero__check">Posledná kontrola letákov: ${e(fmtDateTime(lastCheck))}</p>` : ''}
      </div>
      ${signupCard(notice)}
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
        <li><strong>Zadáš e-mail</strong><span>Vyberieš obchody a značky, ktoré ťa zaujímajú.</span></li>
        <li><strong>Potvrdíš odber</strong><span>Klikneš na odkaz v e-maile – bez potvrdenia ti nič nepošleme.</span></li>
        <li><strong>Dostaneš upozornenie</strong><span>Keď sa plechovka objaví v letáku v akcii, príde ti krátka správa.</span></li>
      </ol>
    </div>
  </section>

  <section class="section" id="faq">
    <div class="wrap faq">
      <h2>Časté otázky</h2>
      <details><summary>Koľko e-mailov mi príde?</summary><p>Iba keď nájdeme novú akciu na značky, ktoré si si vybral(a) – zvyčajne nanajvýš pár správ mesačne. Viac akcií naraz spojíme do jedného e-mailu.</p></details>
      <details><summary>Ako sa odhlásim?</summary><p>V každom e-maile je odkaz „Odhlásiť sa“. Po odhlásení tvoju adresu okamžite a natrvalo vymažeme.</p></details>
      <details><summary>Odkiaľ beriete ceny?</summary><p>Dvakrát denne automaticky prečítame verejne dostupné letáky na stránkach Kauflandu a Billy. Program sa môže pomýliť, preto pri každej akcii nájdeš odkaz na overenie v letáku. Záväzná je vždy cena na predajni.</p></details>
      <details><summary>Ste oficiálna stránka niektorej značky alebo obchodu?</summary><p>Nie. Sme nezávislý fanúšikovský projekt a so žiadnou z týchto spoločností nie sme prepojení.</p></details>
      <details><summary>Čo robíte s mojím e-mailom?</summary><p>Používame ho len na tieto upozornenia. Nikomu ho nepredávame ani nezdieľame. Podrobnosti sú v <a href="/sukromie">zásadách ochrany súkromia</a>.</p></details>
    </div>
  </section>`,
  });
}

function signupCard(notice) {
  return `
  <div class="card signup" id="odber">
    <h2>Chcem upozornenie</h2>
    ${notice ? `<p class="notice notice--${e(notice.type)}" role="status">${e(notice.text)}</p>` : ''}
    <form method="post" action="/prihlasit" class="form">
      <label class="field">
        <span>E-mail</span>
        <input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="ty@example.sk">
      </label>
      <fieldset class="stores">
        <legend>Obchody</legend>
        ${Object.entries(STORES).map(([k, name]) => `<label class="pill"><input type="checkbox" name="stores" value="${k}" checked><span>${e(name)}</span></label>`).join('')}
      </fieldset>
      <fieldset class="stores">
        <legend>Značky</legend>
        ${Object.entries(BRANDS).map(([k, b]) => `<label class="pill"><input type="checkbox" name="brands" value="${k}" checked><span>${e(b.name)}</span></label>`).join('')}
      </fieldset>
      <label class="hp" aria-hidden="true">Web<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
      <label class="check">
        <input type="checkbox" name="consent" value="1" required>
        <span>Súhlasím so spracovaním mojej e-mailovej adresy na zasielanie upozornení na akcie podľa <a href="/sukromie" target="_blank">zásad ochrany súkromia</a>. Súhlas môžem kedykoľvek odvolať.</span>
      </label>
      <label class="check">
        <input type="checkbox" name="age" value="1" required>
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

export function actionPage({ title, text, action, token, button, danger = false }) {
  return layout({
    title,
    noindex: true,
    body: `<section class="section"><div class="wrap narrow"><div class="card message">
      <h1>${e(title)}</h1><p>${e(text)}</p>
      <form method="post" action="${e(action)}">
        <input type="hidden" name="t" value="${e(token)}">
        <button class="btn${danger ? ' btn--danger' : ''}" type="submit">${e(button)}</button>
      </form>
    </div></div></section>`,
  });
}

export function privacyPage() {
  const operator = [config.operatorName, config.operatorAddress].filter(Boolean).map(e).join(', ') || '<em>[doplň meno prevádzkovateľa]</em>';
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
    <li>výber obchodov a značiek, o ktorých chceš dostávať upozornenia,</li>
    <li>dátum a čas registrácie a potvrdenia odberu a verziu textu súhlasu (ako dôkaz, že si súhlas udelil(a)).</li>
  </ul>
  <p>Neukladáme tvoju IP adresu do databázy, nepoužívame cookies, analytické ani reklamné nástroje a nevytvárame žiadne profily.</p>

  <h2>3. Účel a právny základ</h2>
  <p>Údaje spracúvame výlučne na zasielanie e-mailových upozornení na akcie energetických nápojov v obchodoch Kaufland a BILLA. Právnym základom je tvoj súhlas podľa čl. 6 ods. 1 písm. a) nariadenia GDPR a § 13 ods. 1 písm. a) zákona č. 18/2018 Z. z. o ochrane osobných údajov. Zasielanie e-mailov na základe súhlasu je v súlade aj s § 116 zákona č. 452/2021 Z. z. o elektronických komunikáciách.</p>
  <p>Súhlas udeľuješ dvojstupňovo: zaškrtnutím políčka a potvrdením odkazu v e-maile (double opt-in). Služba je určená len osobám starším ako 18 rokov.</p>

  <h2>4. Ako dlho údaje uchovávame</h2>
  <ul>
    <li>Nepotvrdené registrácie automaticky mažeme do 48 hodín.</li>
    <li>Potvrdený odber uchovávame, kým sa neodhlásiš. Po odhlásení tvoj záznam okamžite a natrvalo vymažeme.</li>
  </ul>

  <h2>5. Kto ďalší má k údajom prístup</h2>
  <p>Údaje nepredávame ani neposkytujeme tretím stranám na marketing. Na prevádzku využívame len nevyhnutných sprostredkovateľov – poskytovateľa hostingu a poskytovateľa služby na odosielanie e-mailov – ktorí údaje spracúvajú iba podľa našich pokynov. Údaje sa spracúvajú v Európskej únii alebo s primeranými zárukami podľa kapitoly V GDPR.</p>

  <h2>6. Tvoje práva</h2>
  <p>Máš právo kedykoľvek odvolať súhlas (odkazom „Odhlásiť sa“ v každom e-maile), právo na prístup k údajom, ich opravu, vymazanie, obmedzenie spracúvania a prenosnosť. Odvolanie súhlasu nemá vplyv na zákonnosť spracúvania pred jeho odvolaním. Žiadosti posielaj na ${CONTACT()}; vybavíme ich bez zbytočného odkladu, najneskôr do jedného mesiaca.</p>
  <p>Ak sa domnievaš, že spracúvaním porušujeme predpisy, môžeš podať sťažnosť na <a href="https://dataprotection.gov.sk" target="_blank" rel="noopener noreferrer">Úrad na ochranu osobných údajov Slovenskej republiky</a>, Hraničná 12, 820 07 Bratislava.</p>

  <h2>7. Zabezpečenie</h2>
  <p>Stránka je dostupná len cez šifrované spojenie (HTTPS), prístup k databáze má iba prevádzkovateľ a odkazy na potvrdenie a odhlásenie obsahujú náhodné, neuhádnuteľné kódy.</p>

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
  <p>Údaje zisťuje program automaticky z verejne dostupných stránok a letákov obchodov, najviac niekoľkokrát denne, v súlade so súbormi robots.txt a bez obchádzania akýchkoľvek technických opatrení. Automatické čítanie letákov sa môže pomýliť, akcia sa môže líšiť podľa predajne alebo môže byť tovar vypredaný. Záväzné sú vždy informácie obchodu (leták, cenovka, pokladnica). Za rozhodnutia urobené na základe údajov zo služby nezodpovedáme v rozsahu, v akom to právne predpisy dovoľujú.</p>

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

function scrapeStatus(report, running) {
  if (running) return '<p class="notice notice--ok">Kontrola práve prebieha…</p>';
  if (!report) return '<p>Kontrola letákov ešte neprebehla.</p>';
  const line = (name, r) =>
    !r ? '' : r.ok
      ? `<li><strong>${name}:</strong> ${r.skipped ? 'leták sa nezmenil' : `nájdené ${r.found}, nové ${r.added}`}</li>`
      : `<li class="is-error"><strong>${name}:</strong> chyba – ${e(r.error)}</li>`;
  return `<p>Posledná kontrola: <strong>${e(fmtDateTime(report.at))}</strong></p>
    <ul class="status">${line('Kaufland', report.kaufland)}${line('BILLA', report.billa)}${report.removed ? `<li><strong>Zmazané neplatné akcie:</strong> ${report.removed}</li>` : ''}${report.notify ? `<li><strong>E-maily:</strong> ${e(report.notify)}</li>` : ''}</ul>`;
}

export function adminPage({ deals, stats, flash, report, running }) {
  const rows = deals
    .map(
      (d) => `
    <tr class="${d.valid_to < today() || d.hidden ? 'is-expired' : ''}">
      <td><span class="chip chip--${e(d.store)}">${e(STORES[d.store])}</span><br><small>${d.auto ? 'automaticky' : 'ručne'}${d.hidden ? ' · skryté' : ''}</small></td>
      <td><strong>${e(BRANDS[d.brand]?.name ?? d.brand)}</strong><br>${e(d.product)}${d.note ? `<br><small>${e(d.note)}</small>` : ''}</td>
      <td>${e(formatPrice(d.price_cents))}${d.regular_price_cents ? `<br><small><s>${e(formatPrice(d.regular_price_cents))}</s></small>` : ''}</td>
      <td>${e(formatDate(d.valid_from))} – ${e(formatDate(d.valid_to))}</td>
      <td class="actions">
        ${
          d.notified_at
            ? `<small>E-maily ${e(fmtDateTime(d.notified_at))}</small>`
            : d.hidden ? '' : `<form method="post" action="/admin/deals/${d.id}/notify"><button class="btn btn--small" type="submit">Odoslať e-maily</button></form>`
        }
        ${
          d.hidden
            ? `<form method="post" action="/admin/deals/${d.id}/unhide"><button class="btn btn--small btn--ghost" type="submit">Zobraziť</button></form>`
            : `<form method="post" action="/admin/deals/${d.id}/delete"><button class="btn btn--small btn--ghost" type="submit">${d.auto ? 'Skryť' : 'Zmazať'}</button></form>`
        }
      </td>
    </tr>`,
    )
    .join('');

  return layout({
    title: 'Administrácia',
    noindex: true,
    body: `<section class="section"><div class="wrap admin">
  <h1>Administrácia</h1>
  ${flash ? `<p class="notice notice--${e(flash.type)}">${e(flash.text)}</p>` : ''}
  <div class="stats">
    <div><strong>${stats.confirmed}</strong><span>potvrdených odberateľov</span></div>
    <div><strong>${stats.kaufland}</strong><span>Kaufland</span></div>
    <div><strong>${stats.billa}</strong><span>BILLA</span></div>
    <div><strong>${stats.pending}</strong><span>čaká na potvrdenie</span></div>
  </div>

  <div class="card">
    <h2>Automatická kontrola letákov</h2>
    ${scrapeStatus(report, running)}
    <form method="post" action="/admin/scrape"><button class="btn btn--small" type="submit"${running ? ' disabled' : ''}>Skontrolovať letáky teraz</button></form>
    <p class="form__hint">Kontroluje sa každých ${config.scrapeIntervalHours} h. E-maily sa po nájdení novej akcie posielajú ${config.autoNotify ? 'automaticky' : 'len ručne (AUTO_NOTIFY=0)'}. Ak program niečo prečíta zle, akciu skry.</p>
  </div>

  <div class="card">
    <h2>Akcie</h2>
    ${deals.length ? `<div class="table-wrap"><table><thead><tr><th>Obchod</th><th>Produkt</th><th>Cena</th><th>Platnosť</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p>Zatiaľ žiadne akcie.</p>'}
  </div>

  <div class="card">
    <h2>Pridať akciu ručne</h2>
    <form method="post" action="/admin/deals" class="form form--grid">
      <label class="field"><span>Obchod</span>
        <select name="store" required>${Object.entries(STORES).map(([k, n]) => `<option value="${k}">${e(n)}</option>`).join('')}</select>
      </label>
      <label class="field"><span>Značka</span>
        <select name="brand" required>${Object.entries(BRANDS).map(([k, b]) => `<option value="${k}">${e(b.name)}</option>`).join('')}</select>
      </label>
      <label class="field field--wide"><span>Produkt</span>
        <input name="product" required maxlength="120" placeholder="Monster Energy 0,5 l, rôzne druhy">
      </label>
      <label class="field"><span>Akciová cena (€)</span><input name="price" required inputmode="decimal" placeholder="0,99"></label>
      <label class="field"><span>Bežná cena (€)</span><input name="regular_price" inputmode="decimal" placeholder="1,49"></label>
      <label class="field"><span>Platí od</span><input type="date" name="valid_from" required></label>
      <label class="field"><span>Platí do</span><input type="date" name="valid_to" required></label>
      <label class="field field--wide"><span>Poznámka</span><input name="note" maxlength="200" placeholder="napr. s Kaufland Card, pri kúpe 4 ks"></label>
      <label class="field field--wide"><span>Odkaz na leták (https)</span><input type="url" name="source_url" maxlength="500" placeholder="https://predajne.kaufland.sk/aktualna-ponuka/letak.html"></label>
      <button class="btn" type="submit">Uložiť akciu</button>
    </form>
  </div>
</div></section>`,
  });
}
