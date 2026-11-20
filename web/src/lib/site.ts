import { getSettings } from './settings';

/** Контакты сайта. Значения берутся из настроек в админке, поэтому читаем «на лету». */
export const SITE = new Proxy({} as Record<string, string>, {
  get(_, k: string) {
    const s = getSettings();
    switch (k) {
      case 'name': return 'Студия Вкуса';
      case 'tagline': return 'Кулинарная школа №1';
      case 'phoneHref': return 'tel:+' + s.phone.replace(/\D/g, '');
      default: return s[k] ?? '';
    }
  },
});
export const wa = (text = 'Здравствуйте! Хочу рассчитать фуршет') =>
  `https://wa.me/${getSettings().whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

/** Ссылка на Telegram: ник из настроек, а если он не задан — тот же номер телефона, что и для WhatsApp */
export const tg = () => {
  const t = getSettings().telegram.replace(/^@/, '').trim();
  if (/^\+?\d{10,15}$/.test(t)) return `https://t.me/+${t.replace(/\D/g, '')}`;
  if (t) return `https://t.me/${t}`;
  return `https://t.me/+${getSettings().whatsapp.replace(/\D/g, '')}`;
};

/** Ссылка на MAX: тот же номер телефона, что и для WhatsApp */
export const max = () => `https://max.ru/+${getSettings().whatsapp.replace(/\D/g, '')}`;
