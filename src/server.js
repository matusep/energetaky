import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config, CONSENT_VERSION, STORES, adminEnabled } from './config.js';
import { BRANDS } from './brands.js';
import * as db from './db.js';
import { sendConfirmEmail, notifyDeals } from './mailer.js';
import { runScrape, startScheduler, lastScrape, isScraping } from './scraper.js';
import * as views from './views.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        ...(config.baseUrl.startsWith('https://') ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    strictTransportSecurity: config.baseUrl.startsWith('https://'),
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  next();
});

app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use((req, res, next) => {
  req.body ??= {};
  next();
});
app.use(express.static(path.resolve('public'), { maxAge: '1d', index: false }));

const tooMany = (req, res) =>
  res.status(429).send(views.messagePage({ title: 'Príliš veľa pokusov', text: 'Skús to prosím znova o niekoľko minút.', tone: 'error' }));

const subscribeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, handler: tooMany });
const tokenLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, handler: tooMany });

const token = (value) => (typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null);
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

// --- Verejné stránky ---

const NOTICES = {
  sent: { type: 'ok', text: 'Hotovo! Ak je adresa platná, poslali sme na ňu potvrdzovací e-mail. Odber začne po kliknutí na odkaz.' },
  invalid: { type: 'error', text: 'Zadaj platnú e-mailovú adresu.' },
  stores: { type: 'error', text: 'Vyber aspoň jeden obchod a jednu značku.' },
  consent: { type: 'error', text: 'Na odber potrebujeme tvoj súhlas a potvrdenie veku.' },
};

app.get('/', (req, res) => {
  res.send(views.homePage({ deals: db.activeDeals(), notice: NOTICES[req.query.stav], lastCheck: lastScrape()?.at }));
});

app.get('/sukromie', (req, res) => res.send(views.privacyPage()));
app.get('/podmienky', (req, res) => res.send(views.termsPage()));

app.post('/prihlasit', subscribeLimiter, async (req, res, next) => {
  const back = (stav) => res.redirect(303, `/?stav=${stav}#odber`);

  // Honeypot – boti vyplnia skryté pole. Tvárime sa, že je všetko v poriadku.
  if (req.body.website) return back('sent');

  const email = String(req.body.email ?? '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return back('invalid');

  const pick = (value, allowed) => [...new Set([value].flat().filter((v) => Object.hasOwn(allowed, v)))];
  const stores = pick(req.body.stores, STORES);
  const brands = pick(req.body.brands, BRANDS);
  if (!stores.length || !brands.length) return back('stores');
  if (req.body.consent !== '1' || req.body.age !== '1') return back('consent');

  try {
    const existing = db.findSubscriberByEmail(email);
    if (!existing) {
      await sendConfirmEmail(email, db.createSubscriber(email, stores, brands, CONSENT_VERSION));
    } else if (!existing.confirmed_at && Date.now() - Date.parse(existing.confirm_sent_at) > 10 * 60 * 1000) {
      await sendConfirmEmail(email, db.refreshPendingSubscriber(existing.id, stores, brands, CONSENT_VERSION));
    }
    // Rovnaká odpoveď vo všetkých prípadoch, aby sa nedalo zistiť, kto je prihlásený.
    back('sent');
  } catch (err) {
    next(err);
  }
});

// Potvrdenie a odhlásenie idú cez tlačidlo (POST), aby ich nespustili antivírusové skenery odkazov v e-mailoch.
app.get('/potvrdit', tokenLimiter, (req, res) => {
  const t = token(req.query.t);
  if (!t || !db.findPendingByConfirmToken(t)) {
    return res.status(404).send(views.messagePage({ title: 'Odkaz je neplatný', text: 'Odkaz už bol použitý alebo vypršal. Ak chceš upozornenia, prihlás sa znova.', tone: 'error' }));
  }
  res.send(views.actionPage({ title: 'Potvrdiť odber', text: 'Klikni na tlačidlo a začneme ti posielať upozornenia, keď bude Monster v akcii.', action: '/potvrdit', token: t, button: 'Potvrdiť odber' }));
});

app.post('/potvrdit', tokenLimiter, (req, res) => {
  const t = token(req.body.t);
  if (!t || !db.confirmSubscriber(t)) {
    return res.status(404).send(views.messagePage({ title: 'Odkaz je neplatný', text: 'Odkaz už bol použitý alebo vypršal.', tone: 'error' }));
  }
  res.send(views.messagePage({ title: 'Odber je aktívny ⚡', text: 'Ďakujeme! Keď bude Monster v akcii, pošleme ti e-mail. Odhlásiť sa môžeš v každom e-maile.', tone: 'ok' }));
});

app.get('/odhlasit', tokenLimiter, (req, res) => {
  const t = token(req.query.t);
  if (!t || !db.findSubscriberByUnsubToken(t)) {
    return res.send(views.messagePage({ title: 'Odber nie je aktívny', text: 'Táto adresa už v našej databáze nie je. Nič ti posielať nebudeme.' }));
  }
  res.send(views.actionPage({ title: 'Odhlásiť odber', text: 'Po odhlásení tvoju e-mailovú adresu okamžite a natrvalo vymažeme.', action: '/odhlasit', token: t, button: 'Odhlásiť a vymazať údaje', danger: true }));
});

app.post('/odhlasit', tokenLimiter, (req, res) => {
  const t = token(req.body.t);
  if (t) db.deleteSubscriberByUnsubToken(t);
  res.send(views.messagePage({ title: 'Odhlásené', text: 'Tvoju adresu sme vymazali. Už ti nepošleme žiadny e-mail. Ak si to rozmyslíš, môžeš sa kedykoľvek prihlásiť znova.', tone: 'ok' }));
});

// RFC 8058 – odhlásenie jedným klikom priamo z Gmailu/Outlooku.
app.post('/odhlasit/1klik', tokenLimiter, (req, res) => {
  const t = token(req.query.t);
  if (t) db.deleteSubscriberByUnsubToken(t);
  res.status(200).type('text').send('OK');
});

// --- Administrácia ---

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, handler: tooMany });

function requireAdmin(req, res, next) {
  if (!adminEnabled) return res.status(404).send(views.messagePage({ title: 'Stránka neexistuje', text: '' }));

  const [scheme, encoded] = (req.get('authorization') || '').split(' ');
  const [user, ...rest] = scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString().split(':') : [];
  const ok = user !== undefined && safeEqual(user, config.adminUser) & safeEqual(rest.join(':'), config.adminPassword);
  if (!ok) {
    res.set('WWW-Authenticate', 'Basic realm="admin", charset="UTF-8"');
    return res.status(401).send('Vyžaduje sa prihlásenie.');
  }

  // Ochrana proti CSRF: POST požiadavky musia prísť z našej vlastnej stránky.
  if (req.method === 'POST') {
    const origin = req.get('origin');
    const site = req.get('sec-fetch-site');
    if ((origin && origin !== new URL(config.baseUrl).origin) || (site && site !== 'same-origin')) {
      return res.status(403).send('Neplatný pôvod požiadavky.');
    }
  }
  res.set('Cache-Control', 'no-store');
  next();
}

app.use('/admin', adminLimiter, requireAdmin);

const FLASH = {
  saved: { type: 'ok', text: 'Akcia uložená. Skontroluj ju a odošli e-maily.' },
  deleted: { type: 'ok', text: 'Akcia odstránená zo stránky.' },
  sending: { type: 'ok', text: 'Odosielanie e-mailov sa začalo na pozadí.' },
  already: { type: 'error', text: 'Upozornenie na túto akciu už bolo odoslané.' },
  expired: { type: 'error', text: 'Akcia už skončila – e-maily sa neodošlú.' },
  invalid: { type: 'error', text: 'Skontroluj vyplnené údaje (cena, dátumy, odkaz musí začínať https://).' },
  scraping: { type: 'ok', text: 'Kontrola letákov sa spustila. Obnov stránku o minútu.' },
  shown: { type: 'ok', text: 'Akcia je znova viditeľná.' },
};

app.get('/admin', (req, res) => {
  res.send(
    views.adminPage({ deals: db.allDeals(), stats: db.subscriberStats(), flash: FLASH[req.query.ok], report: lastScrape(), running: isScraping() }),
  );
});

app.post('/admin/scrape', (req, res) => {
  runScrape({ force: true }).catch((err) => console.error(err));
  res.redirect(303, '/admin?ok=scraping');
});

function parsePrice(value) {
  const s = String(value ?? '').trim().replace(/\s|€/g, '').replace(',', '.');
  if (!s) return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

app.post('/admin/deals', (req, res) => {
  const b = req.body;
  const priceCents = parsePrice(b.price);
  const regularPriceCents = parsePrice(b.regular_price);
  const sourceUrl = String(b.source_url ?? '').trim();
  const product = String(b.product ?? '').trim().slice(0, 120);
  const valid =
    Object.hasOwn(STORES, b.store) &&
    Object.hasOwn(BRANDS, b.brand) &&
    product &&
    Number.isFinite(priceCents) && priceCents > 0 &&
    (regularPriceCents === null || Number.isFinite(regularPriceCents)) &&
    DATE_RE.test(b.valid_from) && DATE_RE.test(b.valid_to) && b.valid_from <= b.valid_to &&
    (!sourceUrl || /^https:\/\/[^\s"<>]+$/.test(sourceUrl));
  if (!valid) return res.redirect(303, '/admin?ok=invalid');

  db.createDeal({
    store: b.store,
    brand: b.brand,
    product,
    priceCents,
    regularPriceCents,
    validFrom: b.valid_from,
    validTo: b.valid_to,
    note: String(b.note ?? '').trim().slice(0, 200),
    sourceUrl: sourceUrl.slice(0, 500),
  });
  res.redirect(303, '/admin?ok=saved');
});

app.post('/admin/deals/:id/delete', (req, res) => {
  db.removeDeal(Number(req.params.id));
  res.redirect(303, '/admin?ok=deleted');
});

app.post('/admin/deals/:id/unhide', (req, res) => {
  db.unhideDeal(Number(req.params.id));
  res.redirect(303, '/admin?ok=shown');
});

app.post('/admin/deals/:id/notify', (req, res) => {
  const deal = db.getDeal(Number(req.params.id));
  if (!deal || deal.hidden) return res.redirect(303, '/admin');
  if (deal.valid_to < db.today()) return res.redirect(303, '/admin?ok=expired');
  if (!db.claimDealsForNotification([deal]).length) return res.redirect(303, '/admin?ok=already');

  notifyDeals(db.confirmedSubscribers(), [deal]).catch((err) => console.error(err));
  res.redirect(303, '/admin?ok=sending');
});

// --- Chyby ---

app.use((req, res) => {
  res.status(404).send(views.messagePage({ title: 'Stránka neexistuje', text: 'Táto stránka tu nie je. Možno hľadáš aktuálne akcie na úvodnej stránke.' }));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(views.messagePage({ title: 'Niečo sa pokazilo', text: 'Skús to prosím o chvíľu znova.', tone: 'error' }));
});

db.cleanup();
setInterval(db.cleanup, 60 * 60 * 1000).unref();
startScheduler();

app.listen(config.port, () => {
  console.log(`${config.siteName} beží na ${config.baseUrl} (port ${config.port})`);
  if (!adminEnabled) console.warn('Admin je vypnutý – nastav ADMIN_PASSWORD (aspoň 12 znakov).');
});
