import { config } from './config.js';
import * as db from './db.js';
import { fetchKaufland } from './sources/kaufland.js';
import { fetchBilla } from './sources/billa.js';
import { notifyDeals } from './mailer.js';

// Ak by kontrola naraz našla viac nových akcií, je to skôr chyba parsera než realita – e-maily vtedy nepošleme sami.
const MAX_AUTO_NOTIFY = 10;

let running = false;

export const isScraping = () => running;

export async function runScrape({ force = false } = {}) {
  if (running) return;
  running = true;
  const report = { at: new Date().toISOString() };
  try {
    report.kaufland = await runSource(async () => fetchKaufland());

    report.billa = await runSource(async () => {
      const { pdfKey, deals } = await fetchBilla({ skipIfUrl: force ? null : db.getMeta('billa_pdf') });
      if (deals === null) return null; // rovnaký leták ako minule
      db.setMeta('billa_pdf', pdfKey);
      return deals;
    });

    report.removed = db.cleanup();
    report.notify = await notifyNew();
  } finally {
    db.setMeta('last_scrape', JSON.stringify(report));
    running = false;
    console.log('Kontrola letákov:', JSON.stringify(report));
  }
}

async function runSource(fn) {
  try {
    const deals = await fn();
    if (deals === null) return { ok: true, skipped: true };
    let added = 0;
    for (const d of deals) if (db.upsertAutoDeal(d)) added++;
    return { ok: true, found: deals.length, added };
  } catch (err) {
    console.error(err);
    return { ok: false, error: err.message };
  }
}

async function notifyNew() {
  if (!config.autoNotify) return 'vypnuté';
  const pending = db.unnotifiedAutoDeals();
  if (!pending.length) return 'nič nové';
  if (pending.length > MAX_AUTO_NOTIFY) return `pozastavené – ${pending.length} nových akcií, skontroluj ich v administrácii`;

  const claimed = db.claimDealsForNotification(pending);
  const sent = await notifyDeals(db.confirmedSubscribers(), claimed);
  return `odoslaných e-mailov: ${sent}, nových akcií: ${claimed.length}`;
}

export function lastScrape() {
  try {
    return JSON.parse(db.getMeta('last_scrape'));
  } catch {
    return null;
  }
}

/** Kontrola každých N hodín; po reštarte sa nespustí skôr, než uplynie interval od poslednej. */
export function startScheduler() {
  if (!config.scrapeEnabled) {
    console.warn('Automatická kontrola letákov je vypnutá (SCRAPE=0).');
    return;
  }
  const intervalMs = config.scrapeIntervalHours * 3600 * 1000;
  const tick = () => {
    const last = Date.parse(lastScrape()?.at ?? 0) || 0;
    if (Date.now() - last >= intervalMs) runScrape().catch((err) => console.error(err));
  };
  setTimeout(tick, 5000).unref();
  setInterval(tick, 15 * 60 * 1000).unref();
}
