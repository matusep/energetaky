import { OPS, Util } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Fotky produktov z PDF letákov (BILLA, COOP Jednota): v PDF sú to samostatné vložené obrázky,
// preto netreba orezávať stránku – stačí nájsť ten pravý a vytiahnuť ho. Keď si nie sme istí, nevrátime nič:
// ilustračná fotka je lepšia než cudzí produkt.

const FILLS = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke]);

/** Obdĺžnik opísaný bodom (x0, y0), (x1, y1) po prenesení maticou na stránku. */
function bounds(ctm, x0, y0, x1, y1) {
  const xs = [];
  const ys = [];
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
    xs.push(ctm[0] * x + ctm[2] * y + ctm[4]);
    ys.push(ctm[1] * x + ctm[3] * y + ctm[5]);
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** Obrázky a vyplnené plochy (kandidáti na dlaždice) na stránke v súradniciach PDF (y rastie nahor). */
export async function pageLayout(page) {
  const { fnArray, argsArray } = await page.getOperatorList();
  const images = [];
  const fills = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = Util.transform(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm);
      if (Array.isArray(args[0]) && args[0].length === 6) ctm = Util.transform(ctm, args[0]);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.constructPath) {
      const [op, , box] = args;
      if (FILLS.has(op) && box) fills.push(bounds(ctm, box[0], box[1], box[2], box[3]));
    } else if (fn === OPS.paintImageXObject) {
      // Obrázok sa kreslí do jednotkového štvorca, ktorý matica natiahne na stránku.
      images.push({ name: args[0], ...bounds(ctm, 0, 0, 1, 1) });
    }
  }
  const { width, height } = page.getViewport({ scale: 1 });
  return { images, fills, pageArea: width * height };
}

const areaOf = (box) => (box.x1 - box.x0) * (box.y1 - box.y0);
const holds = (box, x, y) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;

/** Najmenšia dlaždica okolo bodu (x, y). Menšie plochy sú nálepky a tiene, väčšie pozadie stránky. */
function tileAt({ fills, pageArea }, x, y) {
  return fills
    .filter((box) => holds(box, x, y) && areaOf(box) > pageArea * 0.04 && areaOf(box) < pageArea * 0.6)
    .sort((a, b) => areaOf(a) - areaOf(b))[0];
}

/**
 * BILLA: produkty sú v dlaždiciach, fotka je najväčší farebný obrázok z dlaždice s názvom na (x, y). Najbližší
 * obrázok by bola fotka zo susednej dlaždice alebo maskot.
 */
export async function tilePhoto(doc, page, layout, { x, y }) {
  const tile = tileAt(layout, x, y);
  if (!tile) return null;
  const inTile = layout.images
    .filter((img) => holds(tile, (img.x0 + img.x1) / 2, (img.y0 + img.y1) / 2) && areaOf(img) > 2500)
    .sort((a, b) => areaOf(b) - areaOf(a));
  return firstColourful(doc, page, inTile);
}

/** COOP Jednota: dlaždice nemá, fotka stojí hneď pri názve. Ďalej od neho už býva susedný produkt. */
export async function nearestPhoto(doc, page, { images, pageArea }, { x, y }) {
  const near = images
    .map((img) => ({ ...img, dist: Math.hypot(Math.max(img.x0 - x, 0, x - img.x1), Math.max(img.y0 - y, 0, y - img.y1)) }))
    .filter((img) => img.dist < 30 && areaOf(img) > 6000 && areaOf(img) < pageArea * 0.2)
    .sort((a, b) => a.dist - b.dist || areaOf(b) - areaOf(a));
  return firstColourful(doc, page, near);
}

/** Prvý farebný obrázok zo zoznamu ako WebP, alebo null. Čiernobiele sú tiene, masky a výkričníky, nie produkt. */
async function firstColourful(doc, page, images) {
  const tried = new Set();
  for (const img of images) {
    if (tried.has(img.name)) continue;
    tried.add(img.name);
    const webp = await imageWebp(doc, page, img.name);
    if (webp) return webp;
  }
  return null;
}

/** Obrázok z PDF ako WebP (s priehľadnosťou), ak je farebný. Potrebuje @napi-rs/canvas (závislosť pdfjs). */
async function imageWebp(doc, page, name) {
  const store = name.startsWith('g_') ? page.commonObjs : page.objs;
  const img = await new Promise((resolve) => store.get(name, resolve));
  if (!img?.width || !img?.height || !img.data) return null;
  const { width, height } = img;
  const rgba = new Uint8ClampedArray(width * height * 4);
  if (img.data.length === width * height * 4) rgba.set(img.data);
  else if (img.data.length === width * height * 3) {
    for (let p = 0, q = 0; p < width * height; p++) {
      rgba[q++] = img.data[p * 3];
      rgba[q++] = img.data[p * 3 + 1];
      rgba[q++] = img.data[p * 3 + 2];
      rgba[q++] = 255;
    }
  } else return null; // čiernobiele masky a pod. nás nezaujímajú

  // Farebný = aspoň 5 % viditeľných bodov má výrazne rozdielne farebné zložky.
  let visible = 0;
  let colourful = 0;
  for (let p = 0; p < rgba.length; p += 4 * 7) {
    if (rgba[p + 3] < 128) continue;
    visible++;
    if (Math.max(rgba[p], rgba[p + 1], rgba[p + 2]) - Math.min(rgba[p], rgba[p + 1], rgba[p + 2]) > 30) colourful++;
  }
  if (!visible || colourful / visible < 0.05) return null;
  const { canvas, context } = doc.canvasFactory.create(width, height);
  const data = context.createImageData(width, height);
  data.data.set(rgba);
  context.putImageData(data, 0, 0);
  // Zmenšíme na rozumnú veľkosť – v letáku býva obrázok vo vysokom rozlíšení.
  const scale = Math.min(1, 900 / height);
  if (scale === 1) return canvas.encode('webp', 82);
  const small = doc.canvasFactory.create(Math.round(width * scale), Math.round(height * scale));
  small.context.drawImage(canvas, 0, 0, small.canvas.width, small.canvas.height);
  return small.canvas.encode('webp', 82);
}
