import type { APIRoute } from 'astro';
import { logEvent, isBot } from '../../lib/track';

export const prerender = false;
const ALLOWED = new Set(['add_basket', 'lead_open', 'click_phone', 'click_wa', 'click_tg', 'click_max', 'click_email', 'view_menu']);

/** Клиентские события (sendBeacon): клики, добавление в заявку, открытие формы */
export const POST: APIRoute = async ({ request, cookies }) => {
  const ua = request.headers.get('user-agent') || '';
  const sid = cookies.get('vk_sid')?.value;
  if (!sid || isBot(ua)) return new Response(null, { status: 204 });
  try {
    const d = JSON.parse(await request.text());
    if (ALLOWED.has(d.type)) logEvent({ sid, type: d.type, path: String(d.path || ''), label: String(d.label || ''), ua });
  } catch {}
  return new Response(null, { status: 204 });
};
