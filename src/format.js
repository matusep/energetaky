export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatPrice(cents) {
  return (cents / 100).toLocaleString('sk-SK', { style: 'currency', currency: 'EUR' });
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}. ${m}. ${y}`;
}

/** „3. 11.“ – krátky dátum bez roka. */
export const shortDate = (iso) => formatDate(iso).replace(/ \d{4}$/, '');

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('sk-SK', { timeZone: 'Europe/Bratislava', dateStyle: 'short', timeStyle: 'short' });

export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Bratislava' });

/** „v Kauflande“, „v Bille“, „v Lidli“, „v COOP Jednote“ */
export const storeLocative = (store) => ({ billa: 'Bille', lidl: 'Lidli', coop: 'COOP Jednote' })[store] ?? 'Kauflande';

export function discountPercent(deal) {
  if (!deal.regularPriceCents || deal.regularPriceCents <= deal.priceCents) return null;
  return Math.round((1 - deal.priceCents / deal.regularPriceCents) * 100);
}
