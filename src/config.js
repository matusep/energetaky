import fs from 'node:fs';

// Všetky nastavenia sú v site.config.json (nie je tam nič tajné). Jediné tajomstvo – BREVO_API_KEY – je v GitHub Secrets.
export const config = JSON.parse(fs.readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
config.baseUrl = config.baseUrl.replace(/\/+$/, '');

export const STORES = {
  kaufland: 'Kaufland',
  billa: 'BILLA',
};

export const brevoApiKey = process.env.BREVO_API_KEY || '';
