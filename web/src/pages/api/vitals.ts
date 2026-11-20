import type { APIRoute } from 'astro';
import { run, now } from '../../lib/db';
import { isBot, parseUA } from '../../lib/track';

export const prerender = false;
const num = (v: unknown, max: number) => (typeof v === 'number' && isFinite(v) && v >= 0 && v <= max ? v : null);

/** Core Web Vitals от реальных посетителей (sendBeacon). Личных данных нет: путь страницы, устройство, цифры. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const ua = request.headers.get('user-agent') || '';
  const sid = cookies.get('vk_sid')?.value;
  if (!sid || isBot(ua)) return new Response(null, { status: 204 });
  try {
    const d = JSON.parse(await request.text()), m = d.m || {};
    const path = String(d.path || '').slice(0, 200);
    if (!path.startsWith('/') || path.startsWith('/admin')) return new Response(null, { status: 204 });
    run('INSERT INTO vitals (ts,sid,path,device,conn,lcp,inp,cls,fcp,ttfb) VALUES (?,?,?,?,?,?,?,?,?,?)', now(), sid, path, parseUA(ua).device, String(d.conn || '').slice(0, 10),
      num(m.lcp, 60000), num(m.inp, 60000), num(m.cls, 20), num(m.fcp, 60000), num(m.ttfb, 60000));
  } catch {}
  return new Response(null, { status: 204 });
};
