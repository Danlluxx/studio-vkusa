import nodemailer from 'nodemailer';
import { getSettings } from './settings';
import { env } from './env';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ESC[c]);

/** Отправка уведомления в Telegram и на почту. Настройки: админка → Настройки (или .env). */
export async function notify(title: string, lines: [string, string][]) {
  const s = getSettings();
  const tg = s.tg_token || env('TELEGRAM_BOT_TOKEN'), chat = s.tg_chat || env('TELEGRAM_CHAT_ID');
  const host = s.smtp_host || env('SMTP_HOST'), user = s.smtp_user || env('SMTP_USER'), pass = s.smtp_pass || env('SMTP_PASS');
  const port = Number(s.smtp_port || env('SMTP_PORT') || 465), to = s.mail_to || env('MAIL_TO');
  const tasks: { channel: string; p: Promise<unknown> }[] = [];
  if (tg && chat) {
    const text = `🔔 <b>${esc(title)}</b>\n` + lines.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`).join('\n');
    tasks.push({ channel: 'telegram', p: fetch(`https://api.telegram.org/bot${tg}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML' }), signal: AbortSignal.timeout(8000) }).then(async (r) => { if (!r.ok) throw new Error('Telegram: ' + r.status + ' ' + (await r.text()).slice(0, 120)); }) });
  }
  if (host && user && to) {
    const t = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000 });
    tasks.push({ channel: 'email', p: t.sendMail({ from: user, to, subject: title, html: lines.map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join('') }) });
  }
  const res = await Promise.allSettled(tasks.map((t) => t.p));
  return {
    configured: tasks.length > 0,
    results: res.map((r, i) => ({ channel: tasks[i].channel, ok: r.status === 'fulfilled', error: r.status === 'rejected' ? String(r.reason?.message || r.reason) : '' })),
  };
}
