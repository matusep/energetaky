// Sledované značky. Regulárne výrazy sú prísne, aby napr. „Hellmann´s“ nebol Hell.
export const BRANDS = {
  monster: { name: 'Monster', re: /\bmonster\b/i },
  redbull: { name: 'Red Bull', re: /\bred\s*bull\b/i },
  hell: { name: 'Hell', re: /\bhell\b/i },
};

export function detectBrand(text) {
  for (const [key, brand] of Object.entries(BRANDS)) {
    if (brand.re.test(text)) return key;
  }
  return null;
}

// Sirupy na riedenie pre stránku /samo. Sledujú sa všetky, nie len vybrané značky, preto majú jeden spoločný kľúč.
// Sladidlá a lieky, ktoré sa tiež volajú sirup (javorový, proti kašľu …), sa nepočítajú.
export const SYRUP = 'sirup';
const SYRUP_RE = /\bsirup/i;
const NOT_SYRUP = /kaš|javor|glukóz|agáv|datľ|čakank|ryžov|kukuri|invert|palacink|lekár|liek/i;

export const isSyrup = (deal) => deal.brand === SYRUP;

/** Značka energeťáku alebo „sirup“; null, ak produkt nesledujeme. */
export function detectProduct(text) {
  return detectBrand(text) ?? (SYRUP_RE.test(text) && !NOT_SYRUP.test(text) ? SYRUP : null);
}

/** Meno na zobrazenie: „Red Bull“, pri sirupe prvá časť názvu produktu („Caprio plus Sirup s vitamínmi“). */
export const productName = (deal) => BRANDS[deal.brand]?.name ?? deal.product.split(', ')[0];
