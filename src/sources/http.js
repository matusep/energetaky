import { config } from '../config.js';

// Predstavíme sa poctivo: kto sme a ako nás kontaktovať. Nič neobchádzame (CAPTCHA, prihlásenie, blokovanie).
export const USER_AGENT = `AkcnaPlechovkaBot/1.0 (+${config.baseUrl}${config.contactEmail ? `; ${config.contactEmail}` : ''})`;

export class BlockedError extends Error {}

export async function fetchPolite(url, { maxBytes = 10 * 1024 * 1024, timeoutMs = 60_000 } = {}) {
  if (!(await allowedByRobots(url))) throw new BlockedError(`robots.txt nepovoľuje ${url}`);

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'sk-SK,sk;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 403 || res.status === 429) throw new BlockedError(`${new URL(url).host} odmietol prístup (HTTP ${res.status})`);
  if (!res.ok) throw new Error(`HTTP ${res.status} pre ${url}`);

  const declared = Number(res.headers.get('content-length'));
  if (declared > maxBytes) throw new Error(`Súbor je príliš veľký (${declared} B)`);

  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error(`Súbor je príliš veľký (> ${maxBytes} B)`);
    chunks.push(chunk);
  }
  return { url: res.url, buffer: Buffer.concat(chunks) };
}

export async function fetchText(url, opts) {
  const { url: finalUrl, buffer } = await fetchPolite(url, opts);
  const text = buffer.toString('utf8');
  if (/captcha|cf-challenge|_cf_chl_opt/i.test(text.slice(0, 20000))) {
    throw new BlockedError(`${new URL(url).host} vyžaduje overenie (CAPTCHA) – automatické sťahovanie zastavené`);
  }
  return { url: finalUrl, text };
}

// --- robots.txt ---

const robotsCache = new Map();

async function allowedByRobots(url) {
  const { origin, pathname, search } = new URL(url);
  if (!robotsCache.has(origin)) robotsCache.set(origin, await loadRobots(origin));
  const rules = robotsCache.get(origin);
  const target = pathname + search;

  // Platí najdlhšie zhodné pravidlo; pri rovnakej dĺžke vyhráva Allow.
  let best = { length: -1, allow: true };
  for (const rule of rules) {
    if (target.startsWith(rule.path) && (rule.path.length > best.length || (rule.path.length === best.length && rule.allow))) {
      best = { length: rule.path.length, allow: rule.allow };
    }
  }
  return best.allow;
}

async function loadRobots(origin) {
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return []; // bez robots.txt je všetko povolené
    return parseRobots(await res.text());
  } catch {
    return [];
  }
}

function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === 'allow' || key === 'disallow') && value) {
        current.rules.push({ path: value.replace(/\*.*$/, ''), allow: key === 'allow' });
      }
    }
  }
  const ours = groups.filter((g) => g.agents.some((a) => a !== '*' && 'akcnaplechovkabot'.includes(a)));
  return (ours.length ? ours : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules);
}
