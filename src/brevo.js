import { config, STORES, brevoApiKey } from './config.js';
import { BRANDS } from './brands.js';
import { escapeHtml, formatPrice, formatDate, discountPercent, storeLocative } from './format.js';

// Odberatelia sú v Brevo zoznamoch (jeden zoznam = jedna značka). Brevo rieši potvrdenie odberu aj odhlásenie,
// my mu len pošleme kampaň pre daný zoznam. E-mailové adresy nikde neukladáme ani nevypisujeme.

async function brevo(path, { method = 'POST', body } = {}) {
  const res = await fetch(`https://api.brevo.com/v3${path}`, {
    method,
    headers: { 'api-key': brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Brevo ${method} ${path.split('?')[0]}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const legalFooter =
  'Táto služba nie je prepojená so spoločnosťami Monster Energy, Red Bull, HELL ENERGY, Kaufland ani BILLA. ' +
  'Ceny zisťujeme automaticky z letákov a môžu obsahovať chyby – záväzný je leták obchodu. ' +
  'Vysoký obsah kofeínu. Nevhodné pre deti, tehotné a dojčiace ženy.';

function dealHtml(deal) {
  const pct = discountPercent(deal);
  return `<div style="border-top:1px solid #262b47;padding:18px 0">
    <div style="font-size:13px;font-weight:700;color:#8a90b0">${escapeHtml(STORES[deal.store])}</div>
    <div style="font-size:17px;font-weight:700;margin:4px 0">${escapeHtml(deal.product)}</div>
    <div><span style="font-size:28px;font-weight:800;color:#ffb020">${escapeHtml(formatPrice(deal.priceCents))}</span>
      ${deal.regularPriceCents ? `<span style="color:#8a90b0">&nbsp;<s>${escapeHtml(formatPrice(deal.regularPriceCents))}</s>${pct ? ` −${pct} %` : ''}</span>` : ''}</div>
    <div style="font-size:14px;color:#c9cde6">Platí ${escapeHtml(formatDate(deal.validFrom))} – ${escapeHtml(formatDate(deal.validTo))}${deal.note ? ` · ${escapeHtml(deal.note)}` : ''}</div>
    ${deal.sourceUrl ? `<a style="color:#9fb4ff;font-size:14px" href="${escapeHtml(deal.sourceUrl)}">Overiť v letáku obchodu</a>` : ''}
  </div>`;
}

export function campaignHtml(heading, deals, intro = '') {
  return `<!doctype html>
<html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#0f1220;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e8eaf6">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-size:20px;font-weight:800;margin-bottom:24px">⚡ ${escapeHtml(config.siteName)}</div>
    <div style="background:#181c30;border-radius:16px;padding:28px;line-height:1.55">
      <h1 style="margin:0 0 6px;font-size:22px">${escapeHtml(heading)}</h1>
      ${intro ? `<p style="margin:0 0 8px;color:#c9cde6">${escapeHtml(intro)}</p>` : ''}
      ${deals.map(dealHtml).join('')}
      <p style="margin:20px 0 0"><a href="${escapeHtml(config.baseUrl)}" style="display:inline-block;background:#ffb020;color:#14141f;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">Zobraziť všetky akcie</a></p>
    </div>
    <div style="font-size:12px;color:#8a90b0;margin-top:20px;line-height:1.5">
      Tento e-mail dostávaš, lebo si sa prihlásil(a) na odber upozornení na ${escapeHtml(config.siteName)}.
      <a style="color:#9fb4ff" href="{{ unsubscribe }}">Odhlásiť sa</a><br><br>${escapeHtml(legalFooter)}
    </div>
  </div>
</body></html>`;
}

function subjectFor(brandName, deals) {
  if (deals.length === 1) {
    const d = deals[0];
    return `⚡ ${brandName} v akcii v ${storeLocative(d.store)}: ${formatPrice(d.priceCents)}`;
  }
  return `⚡ ${brandName} v akcii (${deals.length} ${deals.length < 5 ? 'ponuky' : 'ponúk'})`;
}

async function sendCampaign({ name, listId, subject, html }) {
  const campaign = await brevo('/emailCampaigns', {
    body: {
      name: `${name} ${new Date().toISOString().slice(0, 16)}`,
      subject,
      sender: config.sender,
      // Inak by Brevo dalo ako adresu na odpoveď súkromný e-mail z účtu.
      replyTo: config.contactEmail,
      htmlContent: html,
      recipients: { listIds: [listId] },
    },
  });
  await brevo(`/emailCampaigns/${campaign.id}/sendNow`, { body: {} });
  console.log(`Odoslaná kampaň #${campaign.id}: ${subject}`);
}

/**
 * Pre každú značku pošle jednu kampaň na jej Brevo zoznam.
 * Vráti id akcií, ktoré sa podarilo oznámiť (ostatné sa skúsia pri ďalšej kontrole), a chyby z Brevo.
 */
export async function sendDealCampaigns(deals, { dryRun = false } = {}) {
  const sentIds = [];
  const errors = [];
  const byBrand = Map.groupBy(deals, (d) => d.brand);

  for (const [brand, brandDeals] of byBrand) {
    const listId = Number(config.brevo.lists[brand]);
    const brandName = BRANDS[brand].name;
    const subject = subjectFor(brandName, brandDeals);

    if (dryRun || !listId) {
      console.log(`[skúška] ${subject} → zoznam ${listId || '(nenastavený)'}`);
      continue;
    }

    try {
      await sendCampaign({ name: brandName, listId, subject, html: campaignHtml(`${brandName} je v akcii ⚡`, brandDeals) });
      sentIds.push(...brandDeals.map((d) => d.id));
    } catch (err) {
      console.error(`Kampaň pre ${brandName} zlyhala: ${err.message}`);
      errors.push(`${brandName}: ${err.message}`);
    }
  }
  return { sentIds, errors };
}

// --- Uvítanie nových odberateľov ---
// Kampaň o akcii odchádza len raz. Kto sa prihlási neskôr, dostane od nás „uvítanie“ s akciami, ktoré už dostali ostatní.
// Aby nikto nedostal uvítanie dvakrát, zapíšeme mu do Brevo atribút UVITANE so zoznamom značiek, ktoré už má vybavené.

const WELCOMED = 'UVITANE';
export const NOTHING_NEW = 'žiadni noví odberatelia';

async function listContacts(listId) {
  const contacts = [];
  for (let offset = 0; ; offset += 500) {
    const page = await brevo(`/contacts/lists/${listId}/contacts?limit=500&offset=${offset}`, { method: 'GET' });
    contacts.push(...(page?.contacts ?? []));
    if (!page || contacts.length >= page.count || !page.contacts?.length) return contacts;
  }
}

const welcomedBrands = (contact) => String(contact.attributes?.[WELCOMED] ?? '').split(',').filter(Boolean);

/** Pomocný zoznam „Uvítanie – značka“ v rovnakom priečinku ako zoznam značky (vytvorí sa raz, id je v state.json). */
async function welcomeListId(brand, brandListId, state) {
  state.welcomeLists ??= {};
  if (state.welcomeLists[brand]) return state.welcomeLists[brand];
  const { folderId } = await brevo(`/contacts/lists/${brandListId}`, { method: 'GET' });
  const { id } = await brevo('/contacts/lists', { body: { name: `Uvítanie – ${BRANDS[brand].name} (automaticky)`, folderId } });
  state.welcomeLists[brand] = id;
  return id;
}

/**
 * `announced` sú platné akcie, o ktorých už odišla kampaň. Nový odberateľ dostane tie, ktoré boli oznámené
 * pred jeho registráciou (novšie mu prišli bežnou kampaňou).
 */
export async function welcomeNewSubscribers(announced, state) {
  const summary = [];
  try {
    await brevo(`/contacts/attributes/normal/${WELCOMED}`, { body: { type: 'text' } });
  } catch (err) {
    if (!/HTTP 400/.test(err.message)) throw err; // 400 = atribút už existuje
  }

  for (const [brand, rawListId] of Object.entries(config.brevo.lists)) {
    const listId = Number(rawListId);
    if (!listId) continue;
    const brandName = BRANDS[brand].name;

    // Pomocný zoznam vyprázdnime až teraz – predošlá uvítacia kampaň je už dávno odoslaná.
    if (state.welcomeLists?.[brand]) {
      await brevo(`/contacts/lists/${state.welcomeLists[brand]}/contacts/remove`, { body: { all: true } }).catch(() => {});
    }

    const fresh = (await listContacts(listId)).filter((c) => !c.emailBlacklisted && !welcomedBrands(c).includes(brand));
    if (!fresh.length) continue;

    // Kontakty zoskupíme podľa toho, ktoré akcie im chýbajú (zvyčajne je to pre všetkých rovnaké).
    const groups = Map.groupBy(fresh, (c) =>
      announced.filter((d) => d.brand === brand && Date.parse(d.notifiedAt) < Date.parse(c.createdAt)).map((d) => d.id).join('|'),
    );
    let sent = 0;
    for (const [key, contacts] of groups) {
      const deals = announced.filter((d) => key.split('|').includes(d.id));
      if (deals.length) {
        const tempId = await welcomeListId(brand, listId, state);
        await brevo(`/contacts/lists/${tempId}/contacts/add`, { body: { emails: contacts.map((c) => c.email) } });
        await sendCampaign({
          name: `Uvítanie ${brandName}`,
          listId: tempId,
          subject: `⚡ Vitaj! ${subjectFor(brandName, deals).slice(2)}`,
          html: campaignHtml(`Vitaj! ${brandName} je práve v akcii ⚡`, deals, 'Ďakujeme za odber. Tieto akcie platia práve teraz – o ďalších ti dáme vedieť hneď, ako sa objavia v letákoch.'),
        });
        sent += contacts.length;
      }
      for (const c of contacts) {
        const attributes = { [WELCOMED]: [...welcomedBrands(c), brand].join(',') };
        await brevo(`/contacts/${encodeURIComponent(c.email)}`, { method: 'PUT', body: { attributes } });
      }
    }
    summary.push(`${brandName}: ${fresh.length} nových, uvítanie s akciami ${sent}`);
  }
  return summary.length ? summary.join('; ') : NOTHING_NEW;
}
