import { fileURLToPath } from 'node:url';
import { config, brevoApiKey } from './config.js';
import { today } from './format.js';
import * as store from './store.js';
import { welcomeNewSubscribers, NOTHING_NEW } from './brevo.js';

/** Platné, viditeľné akcie, o ktorých už odišla kampaň. */
export function announcedDeals() {
  const hidden = store.loadHidden();
  return store.loadDeals().filter((d) => d.notifiedAt && !hidden.has(d.id) && d.validTo >= today());
}

/** Spúšťa sa každú hodinu (.github/workflows/welcome.yml) – letáky nečíta, len uvíta nových odberateľov. */
export async function runWelcome(state) {
  if (!config.notify || !brevoApiKey) return 'preskočené (bez BREVO_API_KEY alebo vypnuté)';
  try {
    return await welcomeNewSubscribers(announcedDeals(), state);
  } catch (err) {
    console.error(err);
    return `chyba – ${err.message}`;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const state = store.loadState();
  const result = await runWelcome(state);
  console.log('Uvítanie:', result);
  // Ak sa nič nestalo, stav neukladáme – inak by vznikal commit každú hodinu.
  if (brevoApiKey && result !== NOTHING_NEW) {
    state.lastWelcome = { at: new Date().toISOString(), result };
    store.saveState(state);
  }
}
