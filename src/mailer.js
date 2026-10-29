import nodemailer from 'nodemailer';
import { config, STORES } from './config.js';
import { BRANDS } from './brands.js';
import { escapeHtml, formatPrice, formatDate, discountPercent, storeLocative } from './format.js';

const transport = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      requireTLS: config.smtp.port !== 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

if (!transport) console.warn('SMTP nie je nastavené – e-maily sa budú iba vypisovať do konzoly.');

async function send({ to, subject, text, html, headers }) {
  if (!transport) {
    console.log(`\n--- E-MAIL (neodoslaný, chýba SMTP) ---\nKomu: ${to}\nPredmet: ${subject}\n\n${text}\n---------------------------------------\n`);
    return;
  }
  await transport.sendMail({ from: config.mailFrom, to, subject, text, html, headers });
}

function emailLayout(bodyHtml, footerHtml) {
  return `<!doctype html>
<html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#0f1220;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e8eaf6">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-size:20px;font-weight:800;margin-bottom:24px">⚡ ${escapeHtml(config.siteName)}</div>
    <div style="background:#181c30;border-radius:16px;padding:28px;line-height:1.55">${bodyHtml}</div>
    <div style="font-size:12px;color:#8a90b0;margin-top:20px;line-height:1.5">${footerHtml}</div>
  </div>
</body></html>`;
}

const button = (href, label) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:#ffb020;color:#14141f;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${escapeHtml(label)}</a>`;

const legalFooter = `Táto služba nie je prepojená so spoločnosťami Monster Energy, Red Bull, HELL ENERGY, Kaufland ani BILLA. Ceny sú orientačné a zisťujeme ich automaticky – záväzný je leták obchodu.`;
const healthNote = 'Vysoký obsah kofeínu. Nevhodné pre deti, tehotné a dojčiace ženy.';

export async function sendConfirmEmail(email, token) {
  const url = `${config.baseUrl}/potvrdit?t=${encodeURIComponent(token)}`;
  await send({
    to: email,
    subject: `Potvrď odber upozornení – ${config.siteName}`,
    text:
      `Ahoj!\n\nNiekto (dúfame, že ty) zadal túto adresu na stránke ${config.siteName}, aby dostával upozornenia, keď sú energetické nápoje v akcii.\n\n` +
      `Odber potvrdíš tu: ${url}\n\nAk si o odber nežiadal(a), tento e-mail ignoruj – adresu do 48 hodín automaticky vymažeme a nič ti posielať nebudeme.\n\n${legalFooter}`,
    html: emailLayout(
      `<h1 style="margin:0 0 12px;font-size:22px">Potvrď odber</h1>
       <p>Niekto (dúfame, že ty) zadal túto adresu na stránke ${escapeHtml(config.siteName)}, aby dostával upozornenia, keď sú energetické nápoje v akcii.</p>
       <p style="margin:24px 0">${button(url, 'Áno, chcem upozornenia')}</p>
       <p style="color:#8a90b0;font-size:14px">Ak si o odber nežiadal(a), tento e-mail ignoruj – adresu do 48 hodín automaticky vymažeme a nič ti posielať nebudeme.</p>`,
      legalFooter,
    ),
  });
}

function dealText(deal) {
  const pct = discountPercent(deal);
  return [
    `${BRANDS[deal.brand]?.name ?? ''} – ${STORES[deal.store]}: ${deal.product}`,
    `Cena: ${formatPrice(deal.price_cents)}${deal.regular_price_cents ? ` (namiesto ${formatPrice(deal.regular_price_cents)}${pct ? `, −${pct} %` : ''})` : ''}`,
    `Platí: ${formatDate(deal.valid_from)} – ${formatDate(deal.valid_to)}`,
    deal.note && `Poznámka: ${deal.note}`,
    deal.source_url && `Leták: ${deal.source_url}`,
  ].filter(Boolean).join('\n');
}

function dealHtml(deal) {
  const pct = discountPercent(deal);
  return `<div style="border-top:1px solid #262b47;padding:18px 0">
    <div style="font-size:13px;font-weight:700;color:#8a90b0">${escapeHtml(BRANDS[deal.brand]?.name ?? '')} · ${escapeHtml(STORES[deal.store])}</div>
    <div style="font-size:17px;font-weight:700;margin:4px 0">${escapeHtml(deal.product)}</div>
    <div><span style="font-size:28px;font-weight:800;color:#ffb020">${escapeHtml(formatPrice(deal.price_cents))}</span>
      ${deal.regular_price_cents ? `<span style="color:#8a90b0">&nbsp;<s>${escapeHtml(formatPrice(deal.regular_price_cents))}</s>${pct ? ` −${pct} %` : ''}</span>` : ''}</div>
    <div style="font-size:14px;color:#c9cde6">Platí ${escapeHtml(formatDate(deal.valid_from))} – ${escapeHtml(formatDate(deal.valid_to))}${deal.note ? ` · ${escapeHtml(deal.note)}` : ''}</div>
    ${deal.source_url ? `<a style="color:#9fb4ff;font-size:14px" href="${escapeHtml(deal.source_url)}">Overiť v letáku obchodu</a>` : ''}
  </div>`;
}

function subjectFor(deals) {
  if (deals.length === 1) {
    const d = deals[0];
    return `⚡ ${BRANDS[d.brand]?.name} v akcii v ${storeLocative(d.store)}: ${formatPrice(d.price_cents)}`;
  }
  const names = [...new Set(deals.map((d) => BRANDS[d.brand]?.name))].join(', ');
  return `⚡ V akcii: ${names} (${deals.length} ${deals.length < 5 ? 'ponuky' : 'ponúk'})`;
}

export async function sendDealsEmail(subscriber, deals) {
  const unsubPage = `${config.baseUrl}/odhlasit?t=${encodeURIComponent(subscriber.unsub_token)}`;
  const oneClick = `${config.baseUrl}/odhlasit/1klik?t=${encodeURIComponent(subscriber.unsub_token)}`;

  await send({
    to: subscriber.email,
    subject: subjectFor(deals),
    headers: {
      'List-Unsubscribe': `<${oneClick}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    text:
      `V letákoch sme našli akciu:\n\n${deals.map(dealText).join('\n\n')}\n\nVšetky akcie: ${config.baseUrl}\n\n` +
      `Odhlásiť sa (údaje okamžite vymažeme): ${unsubPage}\n\n${legalFooter}\n${healthNote}`,
    html: emailLayout(
      `<h1 style="margin:0 0 6px;font-size:22px">Našli sme akciu ⚡</h1>
       ${deals.map(dealHtml).join('')}
       <p style="margin:20px 0 0">${button(config.baseUrl, 'Zobraziť všetky akcie')}</p>`,
      `Tento e-mail dostávaš, lebo tvoja adresa je prihlásená na odber na ${escapeHtml(config.siteName)}. <a style="color:#9fb4ff" href="${escapeHtml(unsubPage)}">Odhlásiť sa</a> – tvoju adresu okamžite vymažeme.<br><br>${legalFooter}<br>${healthNote}`,
    ),
  });
}

/**
 * Každý odberateľ dostane jeden e-mail so všetkými akciami, ktoré ho zaujímajú (obchod + značka).
 * Posielame postupne, aby sme neprekročili limity SMTP poskytovateľa. Vráti počet odoslaných e-mailov.
 */
export async function notifyDeals(subscribers, deals) {
  let sent = 0;
  for (const sub of subscribers) {
    const matching = deals.filter((d) => sub.stores.includes(d.store) && sub.brands.includes(d.brand));
    if (!matching.length) continue;
    try {
      await sendDealsEmail(sub, matching);
      sent++;
    } catch (err) {
      console.error(`Odoslanie zlyhalo (${sub.email.replace(/^(.).*@/, '$1***@')}): ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return sent;
}
