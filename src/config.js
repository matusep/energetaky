import fs from 'node:fs';

if (fs.existsSync('.env')) process.loadEnvFile('.env');

const env = process.env;

export const config = {
  baseUrl: (env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  port: Number(env.PORT) || 3000,
  siteName: env.SITE_NAME || 'Akčná plechovka',
  operatorName: env.OPERATOR_NAME || '',
  operatorAddress: env.OPERATOR_ADDRESS || '',
  contactEmail: env.CONTACT_EMAIL || '',
  adminUser: env.ADMIN_USER || 'admin',
  adminPassword: env.ADMIN_PASSWORD || '',
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT) || 587,
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
  },
  mailFrom: env.MAIL_FROM || 'Akčná plechovka <noreply@localhost>',
  trustProxy: env.TRUST_PROXY === '1' ? 1 : false,
  dbPath: env.DB_PATH || './data/app.db',
  scrapeEnabled: env.SCRAPE !== '0',
  scrapeIntervalHours: Math.max(Number(env.SCRAPE_INTERVAL_HOURS) || 12, 6),
  autoNotify: env.AUTO_NOTIFY !== '0',
  isProduction: env.NODE_ENV === 'production',
};

// Verzia textu súhlasu – ak zmeníš text súhlasu alebo zásady, zvýš ju.
export const CONSENT_VERSION = '2026-10-30';

export const STORES = {
  kaufland: 'Kaufland',
  billa: 'BILLA',
};

export const adminEnabled = config.adminPassword.length >= 12;

if (config.isProduction) {
  const missing = ['OPERATOR_NAME', 'CONTACT_EMAIL', 'SMTP_HOST', 'MAIL_FROM'].filter((k) => !env[k]);
  if (missing.length) {
    console.error(`Chýbajú povinné premenné prostredia: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (!config.baseUrl.startsWith('https://')) {
    console.error('V produkcii musí BASE_URL začínať https://');
    process.exit(1);
  }
}
