(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* появление блоков */
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach((el) => io.observe(el));
  } else $$('.reveal').forEach((el) => el.classList.add('in'));

  /* мобильное меню */
  const burger = $('#burger'), mm = $('#mobile-menu');
  burger?.addEventListener('click', () => { const o = mm.hidden; mm.hidden = !o; burger.setAttribute('aria-expanded', String(o)); });

  /* список блюд для заявки (хранится в браузере) */
  const KEY = 'vk_basket';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const write = (b) => { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch {} render(); };
  const count = (b) => Object.values(b).reduce((s, i) => s + i.qty, 0);
  function render() {
    const b = read(), n = count(b), el = $('#basket-count');
    if (el) { el.textContent = n; el.classList.toggle('hidden', !n); }
    $$('.basket-count-m').forEach((e) => (e.textContent = n ? `(${n})` : ''));
    $$('[data-add]').forEach((btn) => {
      const i = b[btn.dataset.add], l = btn.querySelector('[data-label]');
      if (l) l.textContent = i ? `В заявке: ${i.qty}` : 'В заявку';
      btn.classList.toggle('is-in', !!i);
    });
    document.dispatchEvent(new CustomEvent('basket:change', { detail: b }));
  }
  /* аналитика: события уходят на /api/e/ */
  const track = (type, label) => { try { navigator.sendBeacon('/api/e/', JSON.stringify({ type, label: label || '', path: location.pathname })); } catch {} };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (a) {
      const h = a.getAttribute('href') || '';
      if (h.startsWith('tel:')) track('click_phone', h);
      else if (h.includes('wa.me')) track('click_wa', location.pathname);
      else if (h.includes('max.ru/')) track('click_max', location.pathname);
      else if (h.includes('t.me/')) track('click_tg', location.pathname);
      else if (h.startsWith('mailto:')) track('click_email', h);
    }
  }, true);
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const b = read(), id = add.dataset.add;
      b[id] = { name: add.dataset.name, unit: add.dataset.unit || '', qty: (b[id]?.qty || 0) + 1 };
      write(b); track('add_basket', add.dataset.name); return;
    }
    const lead = e.target.closest('[data-lead]');
    if (lead) { openLead(lead.dataset.leadNote); return; }
    if (e.target.closest('[data-close]')) $('#lead-dialog')?.close();
    if (e.target === $('#lead-dialog')) $('#lead-dialog').close();
  });
  window.vkBasket = { read, write, count, render };

  /* форма заявки */
  const dlg = $('#lead-dialog'), form = $('#lead-form'), status = $('#lead-status');
  function openLead(note) {
    if (!dlg) return;
    track('lead_open', location.pathname);
    const items = Object.values(read()), box = $('#lead-items');
    if (items.length) { box.classList.remove('hidden'); box.textContent = 'В заявке: ' + items.map((i) => `${i.name} × ${i.qty}`).join('; '); }
    else box.classList.add('hidden');
    if (note && form.comment && !form.comment.value) form.comment.value = note;
    status.textContent = ''; dlg.showModal();
  }
  window.vkOpenLead = openLead;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; status.className = 'min-h-5 text-center text-sm'; status.textContent = 'Отправляем…';
    const fd = Object.fromEntries(new FormData(form)); fd.items = Object.values(read()); fd.page = location.pathname;
    try {
      const r = await fetch('/api/lead/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fd) });
      if (!r.ok) throw new Error();
      status.className = 'min-h-5 text-center text-sm text-green-700 font-semibold';
      status.textContent = 'Спасибо! Мы свяжемся с вами в ближайшее время.';
      form.reset(); write({}); setTimeout(() => dlg.close(), 2200);
    } catch {
      status.className = 'min-h-5 text-center text-sm text-brand font-semibold';
      status.textContent = 'Не удалось отправить. Позвоните нам: +7 (385) 253-29-20';
    }
    btn.disabled = false;
  });
  /* скорость у реальных посетителей (Core Web Vitals), без личных данных */
  (function () {
    if (!('PerformanceObserver' in window)) return;
    var m = {}, sent = false;
    function obs(type, cb, opt) { try { new PerformanceObserver(function (l) { l.getEntries().forEach(cb); }).observe(Object.assign({ type: type, buffered: true }, opt || {})); } catch (e) {} }
    obs('largest-contentful-paint', function (e) { m.lcp = e.startTime; });
    var cls = 0; obs('layout-shift', function (e) { if (!e.hadRecentInput) { cls += e.value; m.cls = cls; } });
    var inp = 0; obs('event', function (e) { if (e.interactionId && e.duration > inp) { inp = e.duration; m.inp = inp; } }, { durationThreshold: 40 });
    obs('paint', function (e) { if (e.name === 'first-contentful-paint') m.fcp = e.startTime; });
    var nav = performance.getEntriesByType('navigation')[0]; if (nav) m.ttfb = nav.responseStart;
    function send() {
      if (sent || m.lcp == null) return; sent = true;
      try { navigator.sendBeacon('/api/vitals/', JSON.stringify({ path: location.pathname, m: m, conn: (navigator.connection && navigator.connection.effectiveType) || '' })); } catch (e) {}
    }
    addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') send(); });
    addEventListener('pagehide', send);
  })();

  /* уведомление о cookie */
  const note = $('#cookie-note');
  try { if (note && !localStorage.getItem('vk_cookie_ok')) note.hidden = false; } catch {}
  $('#cookie-ok')?.addEventListener('click', () => { note.hidden = true; try { localStorage.setItem('vk_cookie_ok', '1'); } catch {} });
  render();
})();
