import crypto from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { detectProduct, SYRUP } from '../brands.js';
import { fetchText, fetchPolite } from './http.js';
import { pageLayout, nearestPhoto } from './pdfImages.js';
import { saveImage } from '../images.js';

export const COOP_LEAFLETS = 'https://www.coop.sk/letaky';

/**
 * Celoslovenské letáky COOP Jednota („potraviny-supermarket-a-tempo-44-2026“, „tempo-44-2026“), regionálne vynechávame.
 * Niektoré Coop zverejní len v prehliadači bez PDF – tie sa prečítajú, až keď PDF pribudne.
 * `done` sú PDF prečítané pri predošlých kontrolách; vráti `deals: null`, ak nepribudlo nič nové.
 */
export async function fetchCoop({ done = [] } = {}) {
  const { text } = await fetchText(COOP_LEAFLETS);
  const slugs = [...new Set([...text.matchAll(/https:\/\/www\.coop\.sk\/letaky\/((?:potraviny-[a-z-]+|tempo)-\d{1,2}-\d{4})"/g)].map((m) => m[1]))];
  if (!slugs.length) throw new Error('Coop: na stránke sa nenašli letáky – zmenila sa jej štruktúra?');

  const read = [];
  let deals = null;
  for (const slug of slugs) {
    await new Promise((r) => setTimeout(r, 2000)); // nezaťažujeme server
    const page = `${COOP_LEAFLETS}/${slug}`;
    const { text: html } = await fetchText(page);
    const validity = parseValidity(html);
    const pdfUrl = (await pdfOf(html, page)) ?? null;
    if (!pdfUrl || !validity) continue;
    read.push(pdfUrl);
    if (done.includes(pdfUrl)) continue;

    const { buffer } = await fetchPolite(pdfUrl, { maxBytes: 150 * 1024 * 1024, timeoutMs: 300_000 });
    deals ??= [];
    deals.push(...(await parseCoopPdf(new Uint8Array(buffer), { ...validity, pdfUrl, sourceUrl: page })));
  }
  return { read, deals };
}

/**
 * Adresa PDF letáku: buď odkaz „Stiahnuť PDF“ na coop.sk, alebo PDF z prehliadača Adobe InDesign (indd.adobe.com),
 * v ktorom Coop niektoré letáky zverejňuje. Jeho aktuálnu verziu a názov PDF povie verejné API prehliadača.
 */
async function pdfOf(html, page) {
  const direct = html.match(/href="(\/buxus\/docs\/[^"]+\.pdf)"/)?.[1];
  if (direct) return new URL(direct, page).href;
  const id = html.match(/indd\.adobe\.com\/view\/([0-9a-f-]{36})/)?.[1];
  if (!id) return null;
  const { text } = await fetchText(`https://indd.adobe.com/api/v1/getManifestdata?pubId=${id}`);
  const { data, activeVersion } = JSON.parse(text);
  if (!data?.documentPdf) return null;
  return `https://indd.adobe.com/view/publication/${id}/${activeVersion !== undefined ? `${activeVersion}/` : ''}${data.documentPdf}`;
}

/** „platné od 5.11. do 11.11.2026“ → { validFrom: '2026-11-05', validTo: '2026-11-11' } */
export function parseValidity(text) {
  const m = text.match(/platné\s+od\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})?\s*do\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/i);
  if (!m) return null;
  const [, d1, m1, y1, d2, m2, y2] = m.map((v) => (v === undefined ? v : Number(v)));
  const fromYear = y1 ?? (m1 > m2 ? y2 - 1 : y2);
  const iso = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { validFrom: iso(fromYear, m1, d1), validTo: iso(y2, m2, d2) };
}

const num = (s) => Number(String(s).replace(',', '.'));

/** Objem balenia v litroch: „0,7 l“, „500 ml“, „4 x 0,25 l“. */
function litres(text) {
  const m = text.match(/(?:(\d+)\s*[x×]\s*)?(\d+(?:,\d+)?)\s*(ml|l)\b/i);
  if (!m) return null;
  return (Number(m[1] ?? 1) * num(m[2])) / (m[3].toLowerCase() === 'ml' ? 1000 : 1);
}

/**
 * Leták je PDF s textovou vrstvou. Cena je veľké číslo eur a menšie centy vpravo hore („5“ + „99“),
 * pod názvom je „jednotková cena 8,56 EUR/l“. Cenu berieme, len ak sedí s jednotkovou cenou a objemom –
 * tak sa nepomýlime ani o susednú dlaždicu.
 */
export async function parseCoopPdf(data, { validFrom, validTo, pdfUrl, sourceUrl }) {
  const task = getDocument({ data, isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  const pdfId = crypto.createHash('sha1').update(pdfUrl).digest('hex').slice(0, 10);
  const deals = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const items = (await page.getTextContent()).items
      .filter((i) => i.str?.trim())
      .map((i) => ({ str: i.str.trim(), x: i.transform[4], y: i.transform[5], size: Math.abs(i.transform[3]) }));
    let layout = null; // obrázky stránky načítame, až keď na nej nájdeme akciu

    for (const anchor of items) {
      const brand = detectProduct(anchor.str);
      if (!brand) continue;

      // Názov: riadky pod sebou v rovnakom stĺpci, kým nepríde „jednotková cena“. Značka býva aj nad slovom
      // „sirup“ („Zlatá Studňa“ / „Multivitamín“ / „sirup 0,7 l“), preto berieme aj dva riadky nad ním.
      const above = brand === SYRUP ? 26 : 0;
      const lines = items
        .filter((o) => o.y <= anchor.y + above && o.y > anchor.y - 30 && o.x >= anchor.x - (above ? 30 : 5) && o.x < anchor.x + 140 && Math.abs(o.size - anchor.size) <= anchor.size * 0.2 && !/jednotkov|EUR\//i.test(o.str))
        .sort((a, b) => b.y - a.y || a.x - b.x);
      const name = lines.map((o) => o.str).join(' ').replace(/\s+/g, ' ');
      const volume = litres(name);
      const unitItem = items.find((o) => o.y < anchor.y && o.y > anchor.y - 50 && Math.abs(o.x - anchor.x) < 30 && /^\d+,\d{2}\s*EUR\/l$/i.test(o.str));
      if (!volume || !unitItem) continue; // bez jednotkovej ceny cenu neoveríme – radšej nič
      const expected = num(unitItem.str.match(/\d+,\d{2}/)[0]) * volume * 100;

      // Dvojice „eurá“ (veľké) + „centy“ (menšie, vpravo hore) v okolí dlaždice.
      const near = items.filter((o) => o.x > anchor.x - 40 && o.x < anchor.x + 200 && o.y > anchor.y - 140 && o.y < anchor.y + 70);
      const pairs = [];
      for (const eur of near.filter((o) => /^\d{1,2}$/.test(o.str) && o.size >= 25)) {
        for (const cents of near.filter((o) => /^\d{2}$/.test(o.str) && o.size < eur.size)) {
          const dx = cents.x - eur.x;
          const dy = cents.y - eur.y;
          if (dx > 5 && dx < 35 && dy > 3 && dy < 25) pairs.push({ cents: Number(eur.str) * 100 + Number(cents.str), at: eur });
        }
      }
      const match = pairs.find((pair) => Math.abs(pair.cents - expected) <= Math.max(3, expected * 0.03));
      if (!match) continue;
      const price = match.cents;

      // Zľava „28%“ + „zľava“ musí byť tesne pri cene, inak patrí susednej dlaždici.
      const pctItem = items
        .filter((o) => /^\d{1,2}\s*%$/.test(o.str) && Math.hypot(o.x - match.at.x, o.y - match.at.y) < 110)
        .find((o) => items.some((z) => /zľava/i.test(z.str) && Math.abs(z.y - o.y) < 6 && Math.abs(z.x - o.x) < 40));
      const pct = pctItem ? Number(pctItem.str.replace(/\D/g, '')) : null;

      const externalId = `coop:${pdfId}:${p}:${brand}:${price}`;
      // Sirup nemá vlastnú fotku, tak ju berieme z letáku. Energeťáky ukážu istú fotku značky: v Coope sa pri nich
      // z letáku trafilo aj pivo.
      layout ??= await pageLayout(page);
      saveImage(externalId, brand === SYRUP ? await nearestPhoto(doc, page, layout, anchor) : null, 'webp');

      deals.push({
        externalId,
        store: 'coop',
        brand,
        product: name.slice(0, 120),
        priceCents: price,
        regularPriceCents: pct ? Math.round(price / (1 - pct / 100)) : null,
        validFrom,
        validTo,
        note: pct ? `zľava ${pct} %` : '',
        sourceUrl,
      });
    }
    page.cleanup();
  }
  await task.destroy();
  return deals;
}
