import { config, STORES, brevoApiKey } from './config.js';
import { BRANDS } from './brands.js';
import { escapeHtml, formatPrice, formatDate, discountPercent, storeLocative } from './format.js';

// Odberatelia sú v Brevo zoznamoch (jeden zoznam = jedna značka). Brevo rieši potvrdenie odberu aj odhlásenie,
// my mu len pošleme kampaň pre daný zoznam.

async function brevo(path, body) {
  const res = await fetch(`https://api.brevo.com/v3${path}`, {
    method: 'POST',
    headers: { 'api-key': brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Brevo ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
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

export function campaignHtml(brandName, deals) {
  return `<!doctype html>
<html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#0f1220;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e8eaf6">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-size:20px;font-weight:800;margin-bottom:24px">⚡ ${escapeHtml(config.siteName)}</div>
    <div style="background:#181c30;border-radius:16px;padding:28px;line-height:1.55">
      <h1 style="margin:0 0 6px;font-size:22px">${escapeHtml(brandName)} je v akcii ⚡</h1>
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
      const campaign = await brevo('/emailCampaigns', {
        name: `${brandName} ${new Date().toISOString().slice(0, 16)}`,
        subject,
        sender: config.sender,
        htmlContent: campaignHtml(brandName, brandDeals),
        recipients: { listIds: [listId] },
      });
      await brevo(`/emailCampaigns/${campaign.id}/sendNow`, {});
      console.log(`Odoslaná kampaň #${campaign.id}: ${subject}`);
      sentIds.push(...brandDeals.map((d) => d.id));
    } catch (err) {
      console.error(`Kampaň pre ${brandName} zlyhala: ${err.message}`);
      errors.push(`${brandName}: ${err.message}`);
    }
  }
  return { sentIds, errors };
}
