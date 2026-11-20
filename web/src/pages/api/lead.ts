import type { APIRoute } from 'astro';
import { run, now } from '../../lib/db';
import { notify } from '../../lib/notify';
import { logEvent, parseUA, sourceOf } from '../../lib/track';

export const prerender = false;
const hits = new Map<string, number[]>(); // лимит: 5 заявок за 10 минут с одного IP

export const POST: APIRoute = async ({ request, clientAddress, cookies }) => {
  let d: any;
  try { d = await request.json(); } catch { return new Response('bad', { status: 400 }); }
  if (d.website) return Response.json({ ok: true }); // ловушка для ботов

  const name = String(d.name || '').trim().slice(0, 100);
  const phone = String(d.phone || '').trim().slice(0, 30);
  if (name.length < 2 || phone.replace(/\D/g, '').length < 10 || !d.consent) return new Response('invalid', { status: 422 });

  const t = now(), recent = (hits.get(clientAddress) || []).filter((x) => t - x < 600000);
  if (recent.length >= 5) return new Response('limit', { status: 429 });
  hits.set(clientAddress, [...recent, t]);

  const ua = request.headers.get('user-agent') || '';
  const sid = cookies.get('vk_sid')?.value || '';
  const src = sid ? sourceOf(sid) : null;
  const items = (Array.isArray(d.items) ? d.items.slice(0, 60) : []).map((i: any) => ({ name: String(i.name).slice(0, 120), qty: Number(i.qty) || 1, unit: String(i.unit || '').slice(0, 60) }));
  const guests = Number(d.guests) || null;
  const comment = String(d.comment || '').slice(0, 1000);

  const r = run(
    'INSERT INTO leads (ts,name,phone,date,guests,comment,items,page,sid,source,medium,campaign,referrer,device,status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    t, name, phone, String(d.date || '').slice(0, 20), guests, comment, JSON.stringify(items), String(d.page || '').slice(0, 200), sid,
    src?.source || 'direct', src?.medium || 'direct', src?.campaign || '', src?.ref || '', parseUA(ua).device, 'new', t);
  if (sid) logEvent({ sid, type: 'lead_submit', path: String(d.page || ''), ua });

  const lines = ([
    ['Имя', name], ['Телефон', phone], ['Дата', d.date], ['Гостей', guests], ['Пожелания', comment],
    ['Блюда', items.map((i: any) => `${i.name} × ${i.qty}`).join('; ')], ['Страница', d.page], ['Источник', src ? `${src.source} / ${src.medium}` : 'direct'],
  ] as [string, string][]).filter(([, v]) => v);
  notify(`Новая заявка №${r.lastInsertRowid}`, lines).then((n) => {
    if (!n.configured) console.log('[lead] уведомления не настроены, заявка сохранена в админке №' + r.lastInsertRowid);
    n.results.filter((x) => !x.ok).forEach((x) => console.error('[lead] ошибка', x.channel, x.error));
  });
  return Response.json({ ok: true });   // заявка в любом случае сохранена в БД
};
