import { all, one } from './db';

export const TZ_H = Number(process.env.TZ_OFFSET_H ?? 7);          // Барнаул UTC+7
const OFF = TZ_H * 3600;
const day = (col = 'ts') => `strftime('%Y-%m-%d', ${col}/1000 + ${OFF}, 'unixepoch')`;

export const startOfDay = (t = Date.now()) => { const d = new Date(t + TZ_H * 3600000); d.setUTCHours(0, 0, 0, 0); return d.getTime() - TZ_H * 3600000; };
export type Range = { from: number; to: number; days: number; key: string };
export function range(key: string): Range {
  const to = Date.now() + 1;
  const today = startOfDay();
  const map: Record<string, number> = { today: 1, '7': 7, '30': 30, '90': 90, '365': 365 };
  const days = map[key] ?? 30;
  return { from: today - (days - 1) * 86400000, to, days, key: map[key] ? key : '30' };
}
const prev = (r: Range): Range => ({ ...r, from: r.from - r.days * 86400000, to: r.from });

const visitors = (r: Range) => one<any>(`SELECT COUNT(DISTINCT sid) v, COUNT(*) pv FROM events WHERE type='pageview' AND ts>=? AND ts<?`, r.from, r.to)!;
const leadsN = (r: Range) => one<any>(`SELECT COUNT(*) n FROM leads WHERE ts>=? AND ts<?`, r.from, r.to)!.n as number;
const contactsN = (r: Range) => one<any>(`SELECT COUNT(DISTINCT sid||type) n FROM events WHERE type IN ('click_phone','click_wa','click_tg','click_max','click_email') AND ts>=? AND ts<?`, r.from, r.to)!.n as number;

export function kpis(r: Range) {
  const cur = visitors(r), p = prev(r), old = visitors(p);
  const l = leadsN(r), lo = leadsN(p);
  const bounce = one<any>(`SELECT SUM(c=1) b, COUNT(*) t FROM (SELECT sid, COUNT(*) c FROM events WHERE type='pageview' AND ts>=? AND ts<? GROUP BY sid)`, r.from, r.to)!;
  const conv = cur.v ? (l / cur.v) * 100 : 0, convOld = old.v ? (lo / old.v) * 100 : 0;
  return {
    visitors: cur.v as number, pageviews: cur.pv as number, leads: l, contacts: contactsN(r),
    conv, pagesPerVisit: cur.v ? cur.pv / cur.v : 0, bounce: bounce.t ? ((bounce.b || 0) / bounce.t) * 100 : 0,
    d: { visitors: pct(cur.v, old.v), pageviews: pct(cur.pv, old.pv), leads: pct(l, lo), conv: conv - convOld },
  };
}
const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : a ? 100 : 0);

export function daily(r: Range) {
  const ev = all<any>(`SELECT ${day()} d, COUNT(DISTINCT sid) v, COUNT(*) pv FROM events WHERE type='pageview' AND ts>=? AND ts<? GROUP BY d`, r.from, r.to);
  const ld = all<any>(`SELECT ${day()} d, COUNT(*) n FROM leads WHERE ts>=? AND ts<? GROUP BY d`, r.from, r.to);
  const out: { d: string; v: number; pv: number; leads: number }[] = [];
  for (let i = 0; i < r.days; i++) {
    const t = r.from + i * 86400000, d = new Date(t + TZ_H * 3600000).toISOString().slice(0, 10);
    out.push({ d, v: ev.find((x) => x.d === d)?.v || 0, pv: ev.find((x) => x.d === d)?.pv || 0, leads: ld.find((x) => x.d === d)?.n || 0 });
  }
  return out;
}

export const topPages = (r: Range, n = 10) => all<any>(`SELECT path, COUNT(*) pv, COUNT(DISTINCT sid) v FROM events WHERE type='pageview' AND ts>=? AND ts<? GROUP BY path ORDER BY pv DESC LIMIT ?`, r.from, r.to, n);
export const entryPages = (r: Range, n = 8) => all<any>(`SELECT path, COUNT(*) c FROM (SELECT sid, path, MIN(ts) FROM events WHERE type='pageview' AND ts>=? AND ts<? GROUP BY sid) GROUP BY path ORDER BY c DESC LIMIT ?`, r.from, r.to, n);

export function sources(r: Range) {
  const v = all<any>(`SELECT source, medium, COUNT(DISTINCT sid) v FROM events WHERE type='pageview' AND ts>=? AND ts<? GROUP BY source, medium ORDER BY v DESC LIMIT 12`, r.from, r.to);
  const l = all<any>(`SELECT source, medium, COUNT(*) n FROM leads WHERE ts>=? AND ts<? GROUP BY source, medium`, r.from, r.to);
  return v.map((x) => { const n = l.find((y) => y.source === x.source && y.medium === x.medium)?.n || 0; return { ...x, leads: n, conv: x.v ? (n / x.v) * 100 : 0 }; });
}
export const mediums = (r: Range) => all<any>(`SELECT medium k, COUNT(DISTINCT sid) v FROM events WHERE type='pageview' AND ts>=? AND ts<? GROUP BY medium ORDER BY v DESC`, r.from, r.to);
const dim = (col: string, r: Range) => all<any>(`SELECT ${col} k, COUNT(DISTINCT sid) v FROM events WHERE type='pageview' AND ts>=? AND ts<? GROUP BY ${col} ORDER BY v DESC LIMIT 8`, r.from, r.to);
export const devices = (r: Range) => dim('device', r);
export const browsers = (r: Range) => dim('browser', r);
export const systems = (r: Range) => dim('os', r);

export function funnel(r: Range) {
  const c = (where: string) => one<any>(`SELECT COUNT(DISTINCT sid) n FROM events WHERE ts>=? AND ts<? AND ${where}`, r.from, r.to)!.n as number;
  const steps = [
    ['Посетили сайт', c(`type='pageview'`)],
    ['Смотрели меню', c(`type='pageview' AND path LIKE '/menu/%'`)],
    ['Добавили блюда в заявку', c(`type='add_basket'`)],
    ['Открыли форму', c(`type='lead_open'`)],
    ['Отправили заявку', c(`type='lead_submit'`)],
  ] as [string, number][];
  return steps;
}
export const topDishes = (r: Range, n = 10) => all<any>(`SELECT label name, COUNT(*) c FROM events WHERE type='add_basket' AND ts>=? AND ts<? AND label<>'' GROUP BY label ORDER BY c DESC LIMIT ?`, r.from, r.to, n);
export const contactClicks = (r: Range) => all<any>(`SELECT type k, COUNT(*) v FROM events WHERE type LIKE 'click_%' AND ts>=? AND ts<? GROUP BY type ORDER BY v DESC`, r.from, r.to);
export function byHour(r: Range) {
  const rows = all<any>(`SELECT CAST(strftime('%H', ts/1000 + ${OFF}, 'unixepoch') AS INT) h, COUNT(*) n FROM events WHERE type='pageview' AND ts>=? AND ts<? GROUP BY h`, r.from, r.to);
  return Array.from({ length: 24 }, (_, h) => ({ h, n: rows.find((x) => x.h === h)?.n || 0 }));
}
export function byWeekday(r: Range) {
  const rows = all<any>(`SELECT CAST(strftime('%w', ts/1000 + ${OFF}, 'unixepoch') AS INT) w, COUNT(*) n FROM events WHERE type='pageview' AND ts>=? AND ts<? GROUP BY w`, r.from, r.to);
  const names = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return [1, 2, 3, 4, 5, 6, 0].map((w) => ({ k: names[w], n: rows.find((x) => x.w === w)?.n || 0 }));
}
export const leadsByStatus = (r: Range) => all<any>(`SELECT status k, COUNT(*) v FROM leads WHERE ts>=? AND ts<? GROUP BY status`, r.from, r.to);
export const leadsByPage = (r: Range) => all<any>(`SELECT page k, COUNT(*) v FROM leads WHERE ts>=? AND ts<? AND page<>'' GROUP BY page ORDER BY v DESC LIMIT 6`, r.from, r.to);
export function leadStats(r: Range) {
  const x = one<any>(`SELECT COUNT(*) n, SUM(status='done') done, SUM(status='rejected') rej, SUM(status='new') nw, COALESCE(SUM(CASE WHEN status='done' THEN amount END),0) revenue, AVG(CASE WHEN status='done' AND amount>0 THEN amount END) avg FROM leads WHERE ts>=? AND ts<?`, r.from, r.to)!;
  const fr = one<any>(`SELECT AVG(updated_at-ts) t FROM leads WHERE status<>'new' AND ts>=? AND ts<?`, r.from, r.to)!;
  return { n: x.n || 0, done: x.done || 0, rej: x.rej || 0, nw: x.nw || 0, revenue: x.revenue || 0, avg: x.avg || 0, reaction: fr.t || 0 };
}
export const newLeadsCount = () => one<any>(`SELECT COUNT(*) n FROM leads WHERE status='new'`)!.n as number;
export const liveNow = () => one<any>(`SELECT COUNT(DISTINCT sid) n FROM events WHERE type='pageview' AND ts>?`, Date.now() - 5 * 60000)!.n as number;

/* ——— скорость у реальных посетителей (Core Web Vitals) ——— */
export const VITALS: Record<string, { name: string; good: number; poor: number; unit: string; hint: string }> = {
  lcp: { name: 'LCP — основной контент', good: 2500, poor: 4000, unit: 'мс', hint: 'Когда появилось главное на экране' },
  inp: { name: 'INP — отклик на клики', good: 200, poor: 500, unit: 'мс', hint: 'Как быстро сайт реагирует на нажатия' },
  cls: { name: 'CLS — «прыжки» вёрстки', good: 0.1, poor: 0.25, unit: '', hint: 'Сдвиги элементов при загрузке' },
  fcp: { name: 'FCP — первая отрисовка', good: 1800, poor: 3000, unit: 'мс', hint: 'Когда на экране появилось хоть что-то' },
  ttfb: { name: 'TTFB — ответ сервера', good: 800, poor: 1800, unit: 'мс', hint: 'Скорость самого сервера' },
};
const p75 = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(s.length * 0.75) - 1)]; };
export function vitals(r: Range) {
  const rows = all<any>('SELECT path, device, lcp, inp, cls, fcp, ttfb FROM vitals WHERE ts>=? AND ts<?', r.from, r.to);
  const col = (k: string, f: (x: any) => boolean = () => true) => rows.filter(f).map((x) => x[k]).filter((v) => v != null) as number[];
  const grade = (k: string, v: number | null) => (v == null ? 'none' : v <= VITALS[k].good ? 'good' : v <= VITALS[k].poor ? 'mid' : 'poor');
  const overall = Object.keys(VITALS).map((k) => { const vals = col(k), v = p75(vals); return { k, v, n: vals.length, grade: grade(k, v), goodShare: vals.length ? (vals.filter((x) => x <= VITALS[k].good).length / vals.length) * 100 : 0 }; });
  const byDevice = ['mobile', 'desktop', 'tablet'].map((d) => ({ d, n: rows.filter((x) => x.device === d).length, lcp: p75(col('lcp', (x) => x.device === d)), inp: p75(col('inp', (x) => x.device === d)), cls: p75(col('cls', (x) => x.device === d)) })).filter((x) => x.n);
  const paths = [...new Set(rows.map((x) => x.path))];
  const worst = paths.map((p) => ({ path: p, n: rows.filter((x) => x.path === p).length, lcp: p75(col('lcp', (x) => x.path === p)) })).filter((x) => x.n >= 3 && x.lcp != null).sort((a, b) => (b.lcp! - a.lcp!)).slice(0, 6);
  return { n: rows.length, overall, byDevice, worst, grade };
}
