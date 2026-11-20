import { all, one } from './db';
import slider from '../data/slider.json';
import clients from '../data/clients.json';
import benefits from '../data/benefits.json';
import certificates from '../data/certificates.json';

export { slider, clients, benefits, certificates };

export type Item = {
  id: number; code: string | null; name: string; section: number | null; sort: number; preview: string | null; detail: string | null;
  price: number | null; unit: string | null; priceText: string | null; image: string | null; imagePreview: null; photos: string[]; menuPdf: string | null; popular: boolean;
};
export type Section = { id: number; code: string; name: string; parent: number | null; sort: number; picture: string | null; description: string | null };

const mapItem = (r: any): Item => ({
  id: r.id, code: r.code, name: r.name, section: r.section, sort: r.sort, preview: r.preview, detail: r.detail,
  price: r.price, unit: r.unit, priceText: r.price_text, image: r.image, imagePreview: null,
  photos: JSON.parse(r.photos || '[]'), menuPdf: r.menu_pdf, popular: !!r.popular,
});
export const getItems = (): Item[] => all('SELECT * FROM items WHERE active=1 ORDER BY sort, id').map(mapItem);
export const getSections = (): Section[] => all<Section>('SELECT id,code,name,parent,sort,picture,description FROM sections WHERE active=1 ORDER BY (CASE WHEN parent IS NULL THEN 0 ELSE 1 END), sort, id');
export const getFormats = (): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const r of all<any>('SELECT slug,data FROM formats WHERE active=1 ORDER BY sort')) out[r.slug] = JSON.parse(r.data);
  return out;
};
export const getReports = () => all<any>('SELECT * FROM reports WHERE active=1 ORDER BY sort, id');
export const getReviews = () => all<any>('SELECT * FROM reviews WHERE active=1 ORDER BY sort, id');
export const getPage = (slug: string) => one<any>('SELECT * FROM pages WHERE slug=?', slug);

export const clean = (s?: string | null) => (s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
export const rub = (n: string | number | null | undefined) => (n ? Number(n).toLocaleString('ru-RU') + ' ₽' : '');
export const itemImage = (i: Item) => i.image || i.photos?.[0] || null;

export function tree() {
  const sections = getSections(), items = getItems();
  const top = sections.filter((s) => !s.parent);
  const children = (id: number) => sections.filter((s) => s.parent === id);
  const byCode = (code: string) => sections.find((s) => s.code === code);
  const itemsOf = (sec: Section) => {
    const ids = new Set([sec.id, ...children(sec.id).map((c) => c.id)]);
    return items.filter((i) => ids.has(i.section as number));
  };
  return { sections, items, top, children, byCode, itemsOf };
}
