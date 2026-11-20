import { one } from './db';

/** Старые адреса Битрикса → новые (чтобы не потерять позиции в Яндексе и ссылки). Возвращает новый путь или null. */
export function legacyRedirect(p: string): string | null {
  const fixed: Record<string, string> = {
    '/basket/': '/zayavka/', '/order/': '/zayavka/', '/personal/basket.php': '/zayavka/',
    '/catalog/': '/menu/', '/catalog/index.php': '/menu/', '/index.php': '/',
    '/catalog/keytering/': '/', '/catalog/food-stantsii2/': '/menu/food-stantsii/', '/catalog/master-klassy2/': '/menu/master-klassy/',
  };
  if (fixed[p]) return fixed[p];
  const m = /^\/catalog\/(?:[^/]+\/)*([^/]+?)(\.html|\/)$/.exec(p);
  if (!m) return null;
  const code = m[1];
  if (m[2] === '/') {
    const s = one<any>('SELECT code FROM sections WHERE code=?', code);
    return s ? `/menu/${s.code}/` : '/menu/';
  }
  const it = one<any>('SELECT s.code FROM items i JOIN sections s ON s.id=i.section WHERE i.code=?', code);
  return it ? `/menu/${it.code}/` : '/menu/';
}
