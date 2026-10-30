import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { today } from './format.js';
import * as store from './store.js';
import * as pages from './pages.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

/** Vygeneruje statickú stránku do priečinka dist/ (ten nasadí GitHub Pages). */
export function build() {
  const hidden = store.loadHidden();
  const deals = store
    .loadDeals()
    .filter((d) => !hidden.has(d.id) && d.validTo >= today())
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom) || a.priceCents - b.priceCents);
  const { lastCheck } = store.loadState();

  fs.rmSync(dist, { recursive: true, force: true });
  fs.cpSync(path.join(root, 'public'), dist, { recursive: true });

  const write = (file, html) => {
    fs.mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
    fs.writeFileSync(path.join(dist, file), html);
  };

  write('index.html', pages.homePage({ deals, lastCheck: lastCheck?.at }));
  write('sukromie/index.html', pages.privacyPage());
  write('podmienky/index.html', pages.termsPage());
  // Na tieto stránky presmeruje Brevo (nastavuje sa vo formulári v Brevo).
  write('skontroluj-email/index.html', pages.messagePage({ title: 'Skontroluj si e-mail', text: 'Poslali sme ti e-mail s odkazom na potvrdenie odberu. Odber začne až po kliknutí naň. Ak e-mail nevidíš, pozri aj priečinok Spam.', tone: 'ok' }));
  write('odber-aktivny/index.html', pages.subscribedPage({ deals }));
  write('odhlasene/index.html', pages.messagePage({ title: 'Odhlásené', text: 'Už ti nepošleme žiadny e-mail. Ak si to rozmyslíš, môžeš sa kedykoľvek prihlásiť znova.', tone: 'ok' }));
  write('404.html', pages.messagePage({ title: 'Stránka neexistuje', text: 'Táto stránka tu nie je. Možno hľadáš aktuálne akcie na úvodnej stránke.' }));
  write('CNAME', `${new URL(config.baseUrl).host}\n`);

  console.log(`Stránka zostavená do dist/ – počet akcií: ${deals.length}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
