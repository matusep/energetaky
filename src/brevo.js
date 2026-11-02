import { config, STORES, brevoApiKey } from './config.js';
import { BRANDS } from './brands.js';
import { escapeHtml, formatPrice, shortDate, discountPercent, storeLocative, today } from './format.js';

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
  'Táto služba nie je prepojená so spoločnosťami Monster Energy, Red Bull, HELL ENERGY, Kaufland, BILLA, Lidl ani COOP Jednota. ' +
  'Ceny zisťujeme automaticky z letákov a môžu obsahovať chyby – záväzný je leták obchodu. ' +
  'Vysoký obsah kofeínu. Nevhodné pre deti, tehotné a dojčiace ženy.';

// E-maily vyzerajú ako stránka, ale sú z tabuliek a vložených štýlov – inak ich Outlook a Gmail rozbijú.
// Obrázky musia mať plnú adresu na stránke a byť v PNG/JPG (WebP Outlook nezobrazí).
const FONT = "font-family:'Schibsted Grotesk',Helvetica,Arial,sans-serif";
const ACCENT = '#e6ff2e';
const STORE_COLORS = { kaufland: ['#e10915', '#ffffff'], billa: ['#ffe500', '#000000'], lidl: ['#0050aa', '#fff000'], coop: ['#ffffff', '#e2001a'] };
const abs = (path) => `${config.baseUrl}${path}`;

function validity(deal) {
  return deal.validFrom > today()
    ? `Od ${shortDate(deal.validFrom)} do ${shortDate(deal.validTo)}`
    : `Platí do ${shortDate(deal.validTo)}`;
}

function dealHtml(deal) {
  const pct = discountPercent(deal);
  const [bg, fg] = STORE_COLORS[deal.store] ?? ['#ffffff', '#000000'];
  const e = escapeHtml;
  // Fotka produktu z obchodu, inak ilustračná plechovka značky.
  const image = deal.image ? abs(`/img/deals/${deal.image}`) : abs(`/img/email/${deal.brand}.png`);
  return `
  <tr><td style="padding:0 0 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#151517;border-radius:24px">
      <tr><td style="padding:8px 8px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:16px">
          <tr>
            <td style="padding:14px 18px;${FONT};font-size:22px;font-weight:800;color:${fg}">${e(STORES[deal.store])}</td>
            <td align="right" style="padding:14px 18px;${FONT};font-size:14px;font-weight:700;color:${fg}">${e(validity(deal))}</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:8px 8px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px">
          <tr><td style="padding:14px 14px 0;${FONT}">${pct ? `<span style="display:inline-block;background:${ACCENT};color:#000000;font-size:30px;font-weight:800;line-height:1.1;padding:6px 14px;border-radius:14px">−${pct}&nbsp;%</span>` : '&nbsp;'}</td></tr>
          <tr><td align="center" style="padding:4px 0 24px"><img src="${e(image)}" alt="${e(deal.product)}" height="220" style="display:block;height:220px;width:auto;max-width:90%;border:0"></td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 24px 24px;${FONT};color:#f5f5f7">
        <div style="font-size:18px;font-weight:600;line-height:1.3">${e(deal.product)}</div>
        <div style="padding:10px 0 6px"><span style="font-size:44px;font-weight:800;letter-spacing:-1px;line-height:1">${e(formatPrice(deal.priceCents))}</span>${deal.regularPriceCents ? `&nbsp;&nbsp;<s style="font-size:20px;color:#a1a1aa">${e(formatPrice(deal.regularPriceCents))}</s>` : ''}</div>
        ${deal.note ? `<div style="font-size:14px;color:#a1a1aa">${e(deal.note[0].toUpperCase() + deal.note.slice(1))}</div>` : ''}
        ${deal.sourceUrl ? `<div style="padding-top:12px"><a href="${e(deal.sourceUrl)}" style="color:${ACCENT};font-size:15px;font-weight:700;text-decoration:none">Overiť v letáku →</a></div>` : ''}
      </td></tr>
    </table>
  </td></tr>`;
}

export function campaignHtml(heading, deals, intro = '') {
  const e = escapeHtml;
  // Text, ktorý e-mailové programy ukážu v zozname správ hneď za predmetom.
  const preview = deals.map((d) => `${BRANDS[d.brand]?.name} za ${formatPrice(d.priceCents)} v ${storeLocative(d.store)}`).join(', ');
  return `<!doctype html>
<html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark"><title>${e(heading)}</title></head>
<body style="margin:0;padding:0;background:#0b0b0c">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(preview)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0c">
    <tr><td align="center" style="padding:0 12px 32px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
        <tr><td style="padding:0"><a href="${e(config.baseUrl)}"><img src="${e(abs('/img/email/header.jpg'))}" alt="" width="600" style="display:block;width:100%;height:auto;border:0"></a></td></tr>
        <tr><td style="background:#000000;padding:24px 24px 28px;${FONT};color:#ffffff">
          <div style="font-size:14px;font-weight:800;color:${ACCENT};padding-bottom:10px">${e(config.siteName)}</div>
          <h1 style="margin:0;font-size:34px;font-weight:800;line-height:1.05;letter-spacing:-1px">${e(heading)}</h1>
          ${intro ? `<p style="margin:12px 0 0;font-size:16px;line-height:1.5;color:#d4d4d8">${e(intro)}</p>` : ''}
        </td></tr>
        <tr><td style="padding:16px 0 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${deals.map(dealHtml).join('')}</table>
        </td></tr>
        <tr><td align="center" style="padding:8px 0 28px">
          <a href="${e(config.baseUrl)}" style="display:inline-block;background:${ACCENT};color:#000000;${FONT};font-size:16px;font-weight:700;text-decoration:none;padding:16px 28px;border-radius:999px">Všetky akcie na stránke →</a>
        </td></tr>
        <tr><td style="${FONT};font-size:12px;line-height:1.6;color:#a1a1aa;padding:0 8px">
          Tento e-mail dostávaš, lebo si sa prihlásil(a) na odber upozornení na ${e(config.siteName)}.
          <a href="{{ unsubscribe }}" style="color:#ffffff">Odhlásiť sa</a><br><br>${e(legalFooter)}
        </td></tr>
      </table>
    </td></tr>
  </table>
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
      await sendCampaign({ name: brandName, listId, subject, html: campaignHtml(`${brandName} je v akcii`, brandDeals) });
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
          html: campaignHtml(`Vitaj! ${brandName} je práve v akcii`, deals, 'Ďakujeme za odber. Tieto akcie platia práve teraz – o ďalších ti dáme vedieť hneď, ako sa objavia v letákoch.'),
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
