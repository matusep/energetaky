import fs from 'node:fs';
import { fetchPolite } from './sources/http.js';

// Fotky produktov k akciám (z Kauflandu a Lidla, BILLA ich nemá). Stiahnu sa raz do data/img/ a zmažú sa spolu s akciou.
const dir = new URL('../data/img/', import.meta.url);
const baseName = (id) => id.replace(/[^a-z0-9]+/gi, '-');

function extension(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'png';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

/** Doplní akciám pole `image` (názov súboru v data/img/), stiahne chýbajúce fotky a zmaže nepoužité. */
export async function syncImages(deals) {
  fs.mkdirSync(dir, { recursive: true });
  const existing = new Map(fs.readdirSync(dir).map((f) => [f.replace(/\.[a-z]+$/, ''), f]));
  const used = new Set();
  const report = { downloaded: 0, removed: 0, failed: 0 };

  for (const deal of deals) {
    const base = baseName(deal.id);
    if (!existing.has(base) && deal.imageUrl) {
      try {
        const { buffer } = await fetchPolite(deal.imageUrl, { maxBytes: 3 * 1024 * 1024, timeoutMs: 30_000 });
        const ext = extension(buffer);
        if (!ext) throw new Error(`neznámy formát obrázka ${deal.imageUrl}`);
        fs.writeFileSync(new URL(`${base}.${ext}`, dir), buffer);
        existing.set(base, `${base}.${ext}`);
        report.downloaded++;
      } catch (err) {
        console.error(`Fotka k akcii ${deal.id}:`, err.message);
        report.failed++;
      }
    }
    deal.image = existing.get(base) ?? null;
    if (deal.image) used.add(deal.image);
  }

  for (const file of existing.values()) {
    if (!used.has(file)) {
      fs.rmSync(new URL(file, dir), { force: true });
      report.removed++;
    }
  }
  return report;
}

/** Cesta k priečinku s fotkami pre build. */
export const imageDir = dir;
