import { detectBrand } from '../brands.js';
import { fetchText } from './http.js';

// Verejný prehľad akciových výrobkov (aktuálny a budúci týždeň).
const PAGES = [
  'https://predajne.kaufland.sk/aktualna-ponuka/prehlad.html?kloffer-week=current',
  'https://predajne.kaufland.sk/aktualna-ponuka/prehlad.html?kloffer-week=next',
];
export const KAUFLAND_LEAFLET = 'https://predajne.kaufland.sk/aktualna-ponuka/letak.html';

export async function fetchKaufland() {
  const offers = new Map();
  for (const url of PAGES) {
    const { text } = await fetchText(url);
    for (const offer of extractOffers(text)) offers.set(offer.offerId, offer);
    await new Promise((r) => setTimeout(r, 3000)); // nezaťažujeme server
  }
  if (!offers.size) throw new Error('Kaufland: na stránke sa nenašli žiadne ponuky – zmenila sa štruktúra stránky?');
  return [...offers.values()].map(toDeal).filter(Boolean);
}

/** Každá ponuka je v stránke ako JSON objekt začínajúci {"offerId": … – vyberieme ich počítaním zátvoriek. */
export function extractOffers(html) {
  const offers = [];
  let from = 0;
  for (;;) {
    const start = html.indexOf('{"offerId":', from);
    if (start === -1) break;
    let depth = 0;
    let inString = false;
    let end = -1;
    for (let i = start; i < html.length; i++) {
      const c = html[i];
      if (inString) {
        if (c === '\\') i++;
        else if (c === '"') inString = false;
      } else if (c === '"') inString = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        end = i + 1;
        break;
      }
    }
    if (end === -1) break;
    try {
      offers.push(JSON.parse(html.slice(start, end)));
    } catch {
      // poškodený objekt preskočíme
    }
    from = end;
  }
  return offers;
}

const toCents = (s) => (s ? Math.round(Number(String(s).replace(/\s/g, '').replace(',', '.')) * 100) || null : null);

function toDeal(o) {
  // Značku hľadáme len v názve a podnázve, nie v popise (tam býva „vhodné k …“ a pod.).
  const brand = detectBrand(`${o.title ?? ''} ${o.subtitle ?? ''}`);
  if (!brand || !o.dateFrom || !o.dateTo || typeof o.price !== 'number') return null;

  const notes = [];
  const priceNote = String(o.detailTitle ?? '').split('\n')[0];
  if (/kaufland (card|xtra)/i.test(priceNote)) notes.push(priceNote);
  if (o.loyaltyDiscount > 0 && o.loyaltyFormattedPrice) notes.push(`s Kaufland Card ${o.loyaltyFormattedPrice} €`);
  if (/záloh/i.test(o.detailDescription ?? '')) notes.push('+ záloha za obal');

  return {
    externalId: `kaufland:${o.offerId}`,
    store: 'kaufland',
    brand,
    product: [`${o.title} ${o.subtitle ?? ''}`.trim(), o.unit].filter(Boolean).join(', ').slice(0, 120),
    priceCents: Math.round(o.price * 100),
    regularPriceCents: toCents(o.formattedOldPrice),
    validFrom: o.dateFrom,
    validTo: o.dateTo,
    note: notes.join(', '),
    sourceUrl: KAUFLAND_LEAFLET,
  };
}
