import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new DatabaseSync(config.dbPath);
// auto_vacuum musí byť nastavené pred vytvorením tabuliek – uvoľnené miesto po zmazaní sa potom vracia na disk.
db.exec('PRAGMA auto_vacuum = INCREMENTAL');
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    stores TEXT NOT NULL,
    brands TEXT NOT NULL,
    confirm_token TEXT UNIQUE,
    unsub_token TEXT NOT NULL UNIQUE,
    consent_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    confirm_sent_at TEXT NOT NULL,
    confirmed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY,
    external_id TEXT UNIQUE,
    store TEXT NOT NULL CHECK (store IN ('kaufland', 'billa')),
    brand TEXT NOT NULL,
    product TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    regular_price_cents INTEGER,
    valid_from TEXT NOT NULL,
    valid_to TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    auto INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    notified_at TEXT
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const now = () => new Date().toISOString();
const newToken = () => crypto.randomBytes(32).toString('base64url');
const isoDate = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Bratislava' });
export const today = () => isoDate(new Date());

const splitList = (s) => s.split(',').filter(Boolean);

// --- Odberatelia ---

export function findSubscriberByEmail(email) {
  return db.prepare('SELECT * FROM subscribers WHERE email = ?').get(email);
}

export function createSubscriber(email, stores, brands, consentVersion) {
  const confirmToken = newToken();
  db.prepare(`
    INSERT INTO subscribers (email, stores, brands, confirm_token, unsub_token, consent_version, created_at, confirm_sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(email, stores.join(','), brands.join(','), confirmToken, newToken(), consentVersion, now(), now());
  return confirmToken;
}

/** Pre nepotvrdeného odberateľa vygeneruje nový potvrdzovací token (pri opakovanej registrácii). */
export function refreshPendingSubscriber(id, stores, brands, consentVersion) {
  const confirmToken = newToken();
  db.prepare(`
    UPDATE subscribers SET stores = ?, brands = ?, confirm_token = ?, consent_version = ?, confirm_sent_at = ?
    WHERE id = ? AND confirmed_at IS NULL
  `).run(stores.join(','), brands.join(','), confirmToken, consentVersion, now(), id);
  return confirmToken;
}

export function findPendingByConfirmToken(token) {
  return db.prepare('SELECT * FROM subscribers WHERE confirm_token = ? AND confirmed_at IS NULL').get(token);
}

export function confirmSubscriber(token) {
  const sub = findPendingByConfirmToken(token);
  if (!sub) return null;
  db.prepare('UPDATE subscribers SET confirmed_at = ?, confirm_token = NULL WHERE id = ?').run(now(), sub.id);
  return sub;
}

export function findSubscriberByUnsubToken(token) {
  return db.prepare('SELECT * FROM subscribers WHERE unsub_token = ?').get(token);
}

/** Odhlásenie = úplné vymazanie záznamu (minimalizácia údajov). */
export function deleteSubscriberByUnsubToken(token) {
  return db.prepare('DELETE FROM subscribers WHERE unsub_token = ?').run(token).changes > 0;
}

export function confirmedSubscribers() {
  return db
    .prepare('SELECT email, stores, brands, unsub_token FROM subscribers WHERE confirmed_at IS NOT NULL')
    .all()
    .map((s) => ({ ...s, stores: splitList(s.stores), brands: splitList(s.brands) }));
}

export function subscriberStats() {
  return db
    .prepare(`
      SELECT
        COALESCE(SUM(confirmed_at IS NOT NULL), 0) AS confirmed,
        COALESCE(SUM(confirmed_at IS NULL), 0) AS pending,
        COALESCE(SUM(confirmed_at IS NOT NULL AND (',' || stores || ',') LIKE '%,kaufland,%'), 0) AS kaufland,
        COALESCE(SUM(confirmed_at IS NOT NULL AND (',' || stores || ',') LIKE '%,billa,%'), 0) AS billa
      FROM subscribers
    `)
    .get();
}

// --- Akcie ---

export function activeDeals() {
  return db
    .prepare('SELECT * FROM deals WHERE hidden = 0 AND valid_to >= ? ORDER BY valid_from, price_cents')
    .all(today());
}

export function allDeals() {
  return db.prepare('SELECT * FROM deals ORDER BY valid_to DESC, id DESC').all();
}

export function getDeal(id) {
  return db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
}

export function createDeal(d) {
  return db.prepare(`
    INSERT INTO deals (store, brand, product, price_cents, regular_price_cents, valid_from, valid_to, note, source_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(d.store, d.brand, d.product, d.priceCents, d.regularPriceCents, d.validFrom, d.validTo, d.note, d.sourceUrl, now())
    .lastInsertRowid;
}

/** Uloží automaticky nájdenú akciu; existujúcu len aktualizuje. Vráti true, ak je nová. */
export function upsertAutoDeal(d) {
  const params = [d.store, d.brand, d.product, d.priceCents, d.regularPriceCents, d.validFrom, d.validTo, d.note, d.sourceUrl];
  const inserted = db.prepare(`
    INSERT INTO deals (store, brand, product, price_cents, regular_price_cents, valid_from, valid_to, note, source_url, external_id, auto, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT (external_id) DO NOTHING
  `).run(...params, d.externalId, now()).changes > 0;
  if (!inserted) {
    db.prepare(`
      UPDATE deals SET store = ?, brand = ?, product = ?, price_cents = ?, regular_price_cents = ?, valid_from = ?, valid_to = ?, note = ?, source_url = ?
      WHERE external_id = ?
    `).run(...params, d.externalId);
  }
  return inserted;
}

/** Ručné akcie mažeme, automatické len skryjeme – inak by ich ďalšia kontrola pridala znova. */
export function removeDeal(id) {
  const deal = getDeal(id);
  if (!deal) return;
  if (deal.auto) db.prepare('UPDATE deals SET hidden = 1 WHERE id = ?').run(id);
  else db.prepare('DELETE FROM deals WHERE id = ?').run(id);
}

export function unhideDeal(id) {
  db.prepare('UPDATE deals SET hidden = 0 WHERE id = ?').run(id);
}

export function unnotifiedAutoDeals() {
  return db
    .prepare('SELECT * FROM deals WHERE auto = 1 AND hidden = 0 AND notified_at IS NULL AND valid_to >= ? ORDER BY id')
    .all(today());
}

/** Atomicky označí akcie ako oznámené; vráti len tie, ktoré ešte oznámené neboli. */
export function claimDealsForNotification(deals) {
  const stmt = db.prepare('UPDATE deals SET notified_at = ? WHERE id = ? AND notified_at IS NULL');
  return deals.filter((d) => stmt.run(now(), d.id).changes > 0);
}

// --- Meta (stav kontrol) ---

export function getMeta(key) {
  return db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value ?? null;
}

export function setMeta(key, value) {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, value);
}

// --- Údržba ---

/** Maže nepotvrdené registrácie po 48 h a akcie, ktorým skončila platnosť (z predošlých letákov). */
export function cleanup() {
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const pending = db.prepare('DELETE FROM subscribers WHERE confirmed_at IS NULL AND confirm_sent_at < ?').run(cutoff).changes;
  const deals = db.prepare('DELETE FROM deals WHERE valid_to < ?').run(today()).changes;
  if (deals) db.exec('PRAGMA incremental_vacuum');
  if (pending || deals) console.log(`Údržba: zmazaných ${pending} nepotvrdených registrácií, ${deals} neplatných akcií.`);
  return deals;
}
