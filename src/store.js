import fs from 'node:fs';

// Dáta sú v obyčajných JSON súboroch v repozitári – sú verejné (len ceny z letákov), žiadne osobné údaje.
const file = (name) => new URL(`../data/${name}`, import.meta.url);

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

function writeJson(name, value) {
  fs.mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
  fs.writeFileSync(file(name), `${JSON.stringify(value, null, 2)}\n`);
}

/** data/deals.json – všetky nájdené akcie, ktoré ešte platia. */
export const loadDeals = () => readJson('deals.json', []);
export const saveDeals = (deals) =>
  writeJson('deals.json', [...deals].sort((a, b) => a.validFrom.localeCompare(b.validFrom) || a.id.localeCompare(b.id)));

/** data/state.json – stav poslednej kontroly. */
export const loadState = () => readJson('state.json', {});
export const saveState = (state) => writeJson('state.json', state);

/** data/hidden.json – ručne skryté akcie (zle prečítané). Stačí sem pripísať "id" z deals.json. */
export const loadHidden = () => new Set(readJson('hidden.json', []));
