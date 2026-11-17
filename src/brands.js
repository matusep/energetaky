// Sledované značky. Regulárne výrazy sú prísne, aby napr. „Hellmann´s“ nebol Hell.
export const BRANDS = {
  monster: { name: 'Monster', re: /\bmonster\b/i },
  redbull: { name: 'Red Bull', re: /\bred\s*bull\b/i },
  hell: { name: 'Hell', re: /\bhell\b/i },
  semtex: { name: 'Semtex', re: /\bsemtex\b/i },
};

// Tovar so značkou v názve, ktorý nie je nápoj („Lupilo Monster Truck, 2 diely v balení“ a pod.).
const NOT_DRINK = /\btruck|hračk|autíč|\bauto\b|lupil|puzzle|lego|plyš|figúrk|pohár|hrnč|tričk|mikin|čiapk|batoh|nálepk|vankúš|ponožk|dielo?y? v balení/i;

export function detectBrand(text) {
  if (NOT_DRINK.test(text)) return null;
  for (const [key, brand] of Object.entries(BRANDS)) {
    if (brand.re.test(text)) return key;
  }
  return null;
}

// Sirupy na riedenie pre stránku /samo. Sledujeme len vybrané značky (SYRUP_BRANDS), všetky majú v dátach jeden spoločný kľúč.
// Sladidlá a lieky, ktoré sa tiež volajú sirup (javorový, proti kašľu …), sa nepočítajú.
export const SYRUP = 'sirup';
const SYRUP_RE = /\bsirup/i;
const NOT_SYRUP = /kaš|javor|glukóz|agáv|datľ|čakank|ryžov|kukuri|invert|palacink|lekár|liek/i;

/** Sirupy, ktoré sledujeme. Kľúč je zároveň názov súboru fotky (public/img/cans/…) a kľúč zoznamu v Brevo. */
export const SYRUP_BRANDS = {
  zlatastudna: { name: 'Zlatá studňa', re: /zlat[áa]\s+studň?a/i },
  caprio: { name: 'Caprio', re: /\bcaprio\b/i },
};

export const isSyrup = (deal) => deal.brand === SYRUP;

/** „zlatastudna“, „caprio“ alebo null, ak to nie je sledovaný sirup. */
export const syrupKind = (text) => Object.keys(SYRUP_BRANDS).find((k) => SYRUP_BRANDS[k].re.test(text)) ?? null;

/** Značka energeťáku alebo „sirup“; null, ak produkt nesledujeme. (Sirup sa na značku dofiltruje až podľa celého názvu, pozri `isTracked`.) */
export function detectProduct(text) {
  return detectBrand(text) ?? (SYRUP_RE.test(text) && !NOT_SYRUP.test(text) ? SYRUP : null);
}

/** Je to akcia, ktorú na stránke ukazujeme? Energeťák sledovanej značky, alebo sirup Zlatá studňa / Caprio. */
export function isTracked(deal) {
  if (isSyrup(deal)) return syrupKind(deal.product) !== null;
  return Boolean(BRANDS[deal.brand]) && BRANDS[deal.brand].re.test(deal.product) && !NOT_DRINK.test(deal.product);
}

/** Všetky položky, na ktoré sa dá prihlásiť odber: energeťáky aj sledované sirupy. Kľúč = kľúč zoznamu v Brevo. */
export const LISTS = {
  ...BRANDS,
  ...SYRUP_BRANDS,
};

/** Kľúč zoznamu/fotky akcie: „redbull“, „semtex“, „caprio“, „zlatastudna“; pri inom sirupe „sirup“. */
export const listKey = (deal) => (isSyrup(deal) ? (syrupKind(deal.product) ?? SYRUP) : deal.brand);

/** Meno na zobrazenie: „Red Bull“, „Caprio“ alebo prvá časť názvu produktu. */
export const productName = (deal) => LISTS[listKey(deal)]?.name ?? deal.product.split(', ')[0];
