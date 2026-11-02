import zlib from 'node:zlib';
import { detectBrand } from '../brands.js';
import { fetchPolite, fetchText } from './http.js';

// Lidl zverejňuje akciové potraviny ako stránky produktov. Ich zoznam je v sitemape, ktorú odkazuje robots.txt.
const SITEMAP = 'https://www.lidl.sk/p/export/SK/sk/product_sitemap.xml.gz';
export const LIDL_LEAFLET = 'https://www.lidl.sk/c/online-letak/s10008489';

export async function fetchLidl() {
  const { buffer } = await fetchPolite(SITEMAP, { maxBytes: 20 * 1024 * 1024 });
  const xml = zlib.gunzipSync(buffer).toString('utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urls.length < 100) throw new Error('Lidl: sitemapa produktov je podozrivo krátka – zmenila sa jej štruktúra?');

  // Potraviny majú 8-ciferné číslo (p11214563), tovar z e-shopu 9-ciferné – tak vylúčime hračky „Monster Truck“ a pod.
  const candidates = urls.filter((url) => {
    const m = url.match(/\/p\/([^/]+)\/p(\d+)$/);
    return m && m[2].length === 8 && detectBrand(m[1].replace(/-/g, ' '));
  });

  const deals = [];
  for (const url of candidates) {
    await new Promise((r) => setTimeout(r, 2000)); // nezaťažujeme server
    const { text } = await fetchText(url);
    const deal = parseProduct(text, url);
    if (deal) deals.push(deal);
  }
  return deals;
}

/** Nuxt ukladá dáta stránky ako pole, v ktorom sa objekty odkazujú na ďalšie prvky indexom. */
function nuxtData(html) {
  const raw = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return null;
  const arr = JSON.parse(raw);
  const resolve = (i, depth = 0) => {
    if (typeof i !== 'number' || depth > 30) return i;
    const v = arr[i];
    if (Array.isArray(v)) return typeof v[0] === 'string' && /Reactive|Ref$/.test(v[0]) ? resolve(v[1], depth + 1) : v.map((x) => resolve(x, depth + 1));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x, depth + 1)]));
    return v;
  };
  // Prvý objekt, ktorý má daný kľúč.
  return (key) => {
    const i = arr.findIndex((v) => v && typeof v === 'object' && !Array.isArray(v) && key in v);
    return i === -1 ? null : resolve(i);
  };
}

const isoDay = (seconds) => new Date(seconds * 1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Bratislava' });

export function parseProduct(html, url) {
  // Len potraviny (energeťák), nie napr. tričko s logom.
  if (!/"categoryPrimary":"Food"/.test(html)) return null;
  const find = nuxtData(html);
  if (!find) return null;

  const price = find('oldPrice');
  const validity = find('validUntil');
  const title = find('fullTitle')?.fullTitle;
  const brand = title && detectBrand(title);
  // Bez prečiarknutej ceny a dátumov platnosti to nie je akcia, ale bežná cena.
  if (!brand || typeof price?.price !== 'number' || !price.oldPrice || !validity?.validFrom || !validity?.validUntil) return null;

  const id = url.match(/p(\d+)$/)[1];
  const ld = html.match(/<script type="application\/ld\+json">(\{"@context":"http:\/\/schema\.org","@type":"Product"[\s\S]*?)<\/script>/)?.[1];
  let image = null;
  try {
    image = [].concat(JSON.parse(ld).image ?? [])[0] ?? null;
  } catch {
    // bez fotky sa ukáže ilustračná
  }

  const notes = [];
  const packaging = price.packaging?.text;
  if (packaging && !/^cena za 1 (kg|l)$/i.test(packaging)) notes.push(packaging);
  if (/lidl plus/i.test(JSON.stringify(price))) notes.push('s aplikáciou Lidl Plus');

  return {
    externalId: `lidl:${id}`,
    store: 'lidl',
    brand,
    product: title.slice(0, 120),
    priceCents: Math.round(price.price * 100),
    regularPriceCents: Math.round(price.oldPrice * 100),
    validFrom: isoDay(validity.validFrom),
    validTo: isoDay(validity.validUntil),
    note: notes.join(', '),
    sourceUrl: url,
    imageUrl: image,
  };
}
