// Animácie stránky. Nič nesleduje a nikam nič neposiela. Bez tohto skriptu je všetok obsah normálne viditeľný.
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const euro = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' });

  /** Nadpis rozdelíme na slová, aby sa mohli vysúvať jedno po druhom. */
  function split(el) {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    text.split(/\s+/).forEach((word, i) => {
      const outer = document.createElement('span');
      const inner = document.createElement('span');
      outer.className = 'w';
      outer.setAttribute('aria-hidden', 'true');
      inner.textContent = word;
      inner.style.setProperty('--i', i); // cez CSSOM, inline style v HTML by CSP zablokovala
      outer.append(inner);
      el.append(outer, ' ');
    });
  }

  /** Cena „zbehne“ z bežnej ceny na akciovú. */
  function countDown(el) {
    const from = Number(el.dataset.countFrom);
    const to = Number(el.dataset.countTo);
    if (!from || from <= to || reduce) return;
    const start = performance.now();
    const duration = 1400;
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = euro.format(Math.round(from + (to - from) * eased) / 100);
      if (t < 1) requestAnimationFrame(frame);
    };
    el.textContent = euro.format(from / 100);
    requestAnimationFrame(frame);
  }

  function enter(el) {
    el.style.setProperty('--d', `${Number(el.dataset.delay || 0) * 110}ms`);
    el.classList.add('is-in');
    el.querySelectorAll('[data-count-to]').forEach(countDown);
  }

  /** Plechovka sa nakláňa za kurzorom. */
  function tilt(stage) {
    const can = stage.querySelector('.can');
    if (!can) return;
    stage.addEventListener('pointermove', (ev) => {
      if (ev.pointerType !== 'mouse') return;
      const r = stage.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5;
      const y = (ev.clientY - r.top) / r.height - 0.5;
      can.style.setProperty('--ry', `${x * 22}deg`);
      can.style.setProperty('--rx', `${y * -10}deg`);
    });
    stage.addEventListener('pointerleave', () => {
      can.style.setProperty('--ry', '0deg');
      can.style.setProperty('--rx', '0deg');
    });
  }

  /** „dnes o 14:31“, „včera o 20:42“ podľa času návštevníka – stránka sa zostavuje len dvakrát denne. */
  function relative(el) {
    const d = new Date(el.dateTime);
    if (Number.isNaN(d.getTime())) return;
    const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((midnight(new Date()) - midnight(d)) / 86_400_000);
    const day = days === 0 ? 'dnes' : days === 1 ? 'včera' : d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' });
    el.title = d.toLocaleString('sk-SK');
    el.textContent = `${day} o ${d.toLocaleTimeString('sk-SK', { hour: 'numeric', minute: '2-digit' })}`;
  }

  function init() {
    document.querySelectorAll('time[data-relative]').forEach(relative);
    if (reduce) {
      document.querySelectorAll('.reveal, [data-split]').forEach(enter);
      return;
    }
    document.querySelectorAll('[data-split]').forEach(split);
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        enter(entry.target);
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    document.querySelectorAll('.reveal, [data-split]').forEach((el) => io.observe(el));
    document.querySelectorAll('[data-tilt]').forEach(tilt);
  }

  document.addEventListener('DOMContentLoaded', () => {
    try {
      init();
    } catch (err) {
      // Keby čokoľvek zlyhalo, radšej ukážeme obsah bez animácií.
      root.classList.remove('js');
      throw err;
    }
  });
})();
