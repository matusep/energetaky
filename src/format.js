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

/** „v Kauflande“, „v Bille“ */
export const storeLocative = (store) => (store === 'billa' ? 'Bille' : 'Kauflande');

export function discountPercent(deal) {
  if (!deal.regular_price_cents || deal.regular_price_cents <= deal.price_cents) return null;
  return Math.round((1 - deal.price_cents / deal.regular_price_cents) * 100);
}
