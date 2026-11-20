import { all, run, one } from './db';

export const DEFAULTS: Record<string, string> = {
  phone: '+7 (385) 253-29-20',
  whatsapp: '79236448785',
  telegram: '',
  email: 'Info@studio-vkusa.ru',
  address: 'г. Барнаул, ул. Интернациональная, 47',
  hours: 'Ежедневно с 12:00 до 23:00 (барнаульское время)',
  hoursShort: 'ежедневно 12:00–23:00',
  vk: '',
  minPrice: 'от 700 ₽',
  metrika_id: '',
  yandex_verification: '', google_verification: '',
  tg_token: '', tg_chat: '',
  smtp_host: '', smtp_port: '465', smtp_user: '', smtp_pass: '', mail_to: 'Info@studio-vkusa.ru',
};

let cache: Record<string, string> | null = null;
export function getSettings() {
  if (!cache) {
    cache = { ...DEFAULTS };
    for (const r of all<{ key: string; value: string }>('SELECT key,value FROM settings')) if (r.key in DEFAULTS) cache[r.key] = r.value ?? '';
  }
  return cache;
}
export function setSettings(patch: Record<string, string>) {
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in DEFAULTS)) continue;
    run('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, v);
  }
  cache = null;
}
export const SECRET_KEYS = ['tg_token', 'smtp_pass'];
void one;
