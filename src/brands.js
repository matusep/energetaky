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
