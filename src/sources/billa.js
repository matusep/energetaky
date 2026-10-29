import crypto from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { detectBrand } from '../brands.js';
import { fetchText, fetchPolite } from './http.js';

export const BILLA_PAGE = 'https://www.billa.sk/letaky-a-akcie/aktualny-letak';

/**
 * Stiahne verejnú stránku s letákom, nájde odkaz „Stiahnuť PDF“ a platnosť akcie.
 * Ak je PDF rovnaké ako pri poslednej kontrole (skipIfUrl), nesťahuje ho znova.
 */
export async function fetchBilla({ skipIfUrl } = {}) {
  const { text: html } = await fetchText(BILLA_PAGE);

  const pdfUrl = html.match(/https:\/\/view\.publitas\.com\/[^"'\s]+?\.pdf[^"'\s]*/)?.[0]?.replace(/&amp;/g, '&');
  if (!pdfUrl) throw new Error('Billa: na stránke sa nenašiel odkaz na PDF leták');

  const validity = parseValidity(html.replace(/<[^>]+>/g, ' '));
  if (!validity) throw new Error('Billa: nepodarilo sa zistiť platnosť letáku');

  const pdfKey = pdfUrl.split('?')[0];
  if (skipIfUrl === pdfKey) return { pdfKey, deals: null };

  const { buffer } = await fetchPolite(pdfUrl, { maxBytes: 250 * 1024 * 1024, timeoutMs: 300_000 });
  const deals = await parseBillaPdf(new Uint8Array(buffer), { ...validity, pdfKey });
  return { pdfKey, deals };
}

/** „Akciová ponuka platí od 28. 10. do 3. 11. 2026“ → { validFrom: '2026-10-28', validTo: '2026-11-03' } */
export function parseValidity(text) {
  const m = text.match(/platí\s+od\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})?\s*do\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/i);
  if (!m) return null;
  const [, d1, m1, y1, d2, m2, y2] = m.map((v) => (v === undefined ? v : Number(v)));
  const fromYear = y1 ?? (m1 > m2 ? y2 - 1 : y2);
  const iso = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { validFrom: iso(fromYear, m1, d1), validTo: iso(y2, m2, d2) };
}

const toCents = (s) => Math.round(Number(String(s).replace(',', '.')) * 100);

/**
 * Leták je PDF s textovou vrstvou. Cena je rozsekaná na veľké číslo eur a menšie centy
 * („1“ + „00“), preto ju skladáme podľa polohy textu na stránke okolo názvu značky.
 */
export async function parseBillaPdf(data, { validFrom, validTo, pdfKey }) {
  const task = getDocument({ data, isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  const deals = [];
  const pdfId = crypto.createHash('sha1').update(pdfKey).digest('hex').slice(0, 10);

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const items = (await page.getTextContent()).items
      .filter((i) => i.str?.trim())
      .map((i) => ({ str: i.str.trim(), x: i.transform[4], y: i.transform[5] }));
    page.cleanup();

    const usedDiscounts = new Set();
    for (const anchor of items) {
      const brand = detectBrand(anchor.str);
      if (!brand) continue;

      // Oblasť dlaždice: pod názvom produktu, mierne doľava aj doprava.
      const region = items.filter((o) => o.y <= anchor.y + 10 && o.y >= anchor.y - 170 && o.x >= anchor.x - 150 && o.x <= anchor.x + 90);
      const dist = (o) => Math.hypot(o.x - anchor.x, o.y - anchor.y);

      const discount = region.filter((o) => /^-\d{1,2}$/.test(o.str)).sort((a, b) => dist(a) - dist(b))[0];
      if (discount && usedDiscounts.has(discount)) continue; // rovnaká dlaždica už spracovaná
      const pct = discount ? Number(discount.str.slice(1)) : null;

      const regularText = region.map((o) => o.str.match(/bežná cena:?\s*(\d+,\d{2})/i)).find(Boolean);
      let regular = regularText ? toCents(regularText[1]) : null;

      // Dvojice „eurá“ + „centy“ (centy sú vpravo a o kúsok vyššie).
      const pairs = [];
      for (const int of region.filter((o) => /^\d{1,2}(,\s*)?$/.test(o.str))) {
        for (const cents of region.filter((o) => /^\d{2}$/.test(o.str))) {
          const dx = cents.x - int.x;
          const dy = cents.y - int.y;
          if (dx > 3 && dx < 40 && dy >= -3 && dy <= 12) pairs.push({ cents: Number(int.str.replace(/\D/g, '')) * 100 + Number(cents.str), at: int });
        }
      }
      if (!regular && pairs.length) {
        // Prečiarknutá bežná cena býva napísaná bez čiarky, napr. „185“.
        const struck = region.filter((o) => /^\d{3,4}$/.test(o.str)).sort((a, b) => dist(a) - dist(b))[0];
        if (struck) regular = Number(struck.str);
      }

      const estimate = regular && pct ? Math.round(regular * (1 - pct / 100)) : null;
      let price = null;
      if (pairs.length) {
        const best = estimate
          ? pairs.sort((a, b) => Math.abs(a.cents - estimate) - Math.abs(b.cents - estimate))[0]
          : pairs.sort((a, b) => dist(a.at) - dist(b.at))[0];
        // Kontrola zdravým rozumom: cena musí sedieť so zľavou (±10 %), ak ju poznáme.
        if (!estimate || Math.abs(best.cents - estimate) <= estimate * 0.1) price = best.cents;
      }
      if (!price && estimate) price = estimate;
      if (!price || price > 1000 || (regular && regular <= price)) continue; // nič rozumné – radšej nič

      if (discount) usedDiscounts.add(discount);

      // Názov: riadky tesne pod značkou, bez čísel a reklamných nápisov veľkými písmenami („XXL PONUKA“).
      const nameParts = [anchor.str];
      for (const o of items) {
        const isPromo = /^[-\d%]/.test(o.str) || o.str === o.str.toUpperCase();
        if (o !== anchor && !isPromo && o.y < anchor.y && o.y >= anchor.y - 30 && Math.abs(o.x - anchor.x) < 40) nameParts.push(o.str.replace(/,$/, ''));
      }

      const regionText = region.map((o) => o.str).join(' ');
      const notes = [];
      const multi = regionText.match(/pri kúpe od (\d+) ks/i);
      if (multi) notes.push(`cena pri kúpe od ${multi[1]} ks`);
      if (/bonus/i.test(regionText)) notes.push('s kartou BILLA Bonus');
      if (/záloh/i.test(regionText)) notes.push('+ záloha za obal');
      if (!pairs.length && estimate) notes.push('cena vypočítaná zo zľavy');

      deals.push({
        externalId: `billa:${pdfId}:${p}:${brand}:${price}`,
        store: 'billa',
        brand,
        product: nameParts.slice(0, 4).join(', ').slice(0, 120),
        priceCents: price,
        regularPriceCents: regular,
        validFrom,
        validTo,
        note: notes.join(', '),
        sourceUrl: BILLA_PAGE,
      });
    }
  }
  await task.destroy();
  return deals;
}
