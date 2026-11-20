import { TZ_H } from './analytics';

export const fmtDate = (ms?: number | null, withTime = true) => {
  if (!ms) return '—';
  const d = new Date(ms + TZ_H * 3600000);
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  return withTime ? `${date} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : date;
};
export const ago = (ms: number) => {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'только что';
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return `${Math.floor(s / 86400)} дн назад`;
};
export const num = (n: number, d = 0) => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: d, minimumFractionDigits: d });
export const dur = (ms: number) => { const m = ms / 60000; return m < 1 ? '< 1 мин' : m < 60 ? `${Math.round(m)} мин` : m < 1440 ? `${(m / 60).toFixed(1)} ч` : `${(m / 1440).toFixed(1)} дн`; };

export const STATUSES: Record<string, { name: string; cls: string }> = {
  new: { name: 'Новая', cls: 'bg-brand text-white' },
  work: { name: 'В работе', cls: 'bg-amber-100 text-amber-900' },
  done: { name: 'Выполнена', cls: 'bg-emerald-100 text-emerald-900' },
  rejected: { name: 'Отказ', cls: 'bg-stone-200 text-stone-700' },
};

export function csv(rows: (string | number | null | undefined)[][]) {
  const esc = (v: any) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n');   // BOM + «;» — открывается в Excel
}
export const csvResponse = (name: string, rows: any[][]) =>
  new Response(csv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` } });

export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const delim = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = []; let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

export const flash = (url: URL) => ({ ok: url.searchParams.get('ok') || '', err: url.searchParams.get('err') || '' });
export const back = (path: string, kind: 'ok' | 'err', msg: string) => `${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`;
export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
export const lines = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

export function pager(total: number, page: number, size = 30) {
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, page), pages);
  return { page: p, pages, offset: (p - 1) * size, size, total };
}
