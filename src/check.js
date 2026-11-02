import { config, brevoApiKey } from './config.js';
import { today } from './format.js';
import * as store from './store.js';
import { fetchKaufland } from './sources/kaufland.js';
import { fetchBilla } from './sources/billa.js';
import { fetchLidl } from './sources/lidl.js';
import { fetchCoop } from './sources/coop.js';
import { BRANDS } from './brands.js';
import { sendDealCampaigns } from './brevo.js';
import { build } from './build.js';
import { runWelcome } from './welcome.js';
import { syncImages } from './images.js';

// Ak by kontrola naraz našla viac nových akcií, je to skôr chyba parsera než realita – e-maily vtedy nepošleme sami.
const MAX_AUTO_NOTIFY = 10;

const deals = new Map(store.loadDeals().map((d) => [d.id, d]));
const state = store.loadState();
const hidden = store.loadHidden();
const report = { at: new Date().toISOString() };

async function runSource(fn) {
  try {
    const found = await fn();
    if (found === null) return { ok: true, skipped: true };
    let added = 0;
    for (const { externalId, ...d } of found) {
      const existing = deals.get(externalId);
      if (!existing) added++;
      deals.set(externalId, { id: externalId, ...d, firstSeen: existing?.firstSeen ?? report.at, notifiedAt: existing?.notifiedAt ?? null });
    }
    return { ok: true, found: found.length, added };
  } catch (err) {
    console.error(err);
    return { ok: false, error: err.message };
  }
}

// Zvýš, keď sa zmení, čo sa z PDF letákov číta – už prečítané letáky sa potom prečítajú znova (2 = aj sirupy).
const PDF_PARSER = 2;
const reparse = process.env.FORCE || state.pdfParser !== PDF_PARSER;

report.kaufland = await runSource(() => fetchKaufland());
report.billa = await runSource(async () => {
  const { pdfKey, deals: found } = await fetchBilla({ skipIfUrl: reparse ? null : state.billaPdf });
  if (found === null) return null; // rovnaký leták ako minule
  state.billaPdf = pdfKey;
  return found;
});
report.lidl = await runSource(() => fetchLidl());
report.coop = await runSource(async () => {
  const { read, deals: found } = await fetchCoop({ done: reparse ? [] : (state.coopPdfs ?? []) });
  state.coopPdfs = read;
  return found; // null = žiadny nový leták
});
state.pdfParser = PDF_PARSER;

// Akcie z predošlých letákov, ktoré už neplatia, mažeme hneď.
report.removed = 0;
for (const [id, d] of deals) {
  if (d.validTo < today()) {
    deals.delete(id);
    report.removed++;
  }
}

report.images = await syncImages(deals.values());

// E-maily idú len o energeťákoch; sirupy (/samo) sa iba zobrazujú na stránke.
const pending = [...deals.values()].filter((d) => !d.notifiedAt && !hidden.has(d.id) && BRANDS[d.brand]);
if (!config.notify) report.notify = 'vypnuté v site.config.json';
else if (!pending.length) report.notify = 'nič nové';
else if (pending.length > MAX_AUTO_NOTIFY) report.notify = `pozastavené – ${pending.length} nových akcií naraz, skontroluj ich`;
else if (!brevoApiKey) {
  await sendDealCampaigns(pending, { dryRun: true });
  report.notify = 'skúšobný beh bez BREVO_API_KEY – nič neodoslané';
} else {
  const { sentIds, errors } = await sendDealCampaigns(pending);
  const sent = new Set(sentIds);
  for (const d of pending) if (sent.has(d.id)) d.notifiedAt = report.at;
  report.notify = `oznámené akcie: ${sent.size} z ${pending.length}`;
  if (errors.length) report.notifyErrors = errors;
}

store.saveDeals(deals.values());
// Odberatelia prihlásení po odoslaní kampane dostanú uvítanie s už oznámenými akciami.
report.welcome = await runWelcome(state);
state.lastCheck = report;
store.saveState(state);
console.log('Kontrola letákov:', JSON.stringify(report));
build();
