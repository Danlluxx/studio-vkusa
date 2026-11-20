import type { APIRoute } from 'astro';
import { tree } from '../lib/data';
import { all, one } from '../lib/db';

const iso = (ms?: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : '');

export const GET: APIRoute = ({ site }) => {
  const { sections, items, itemsOf } = tree();
  const base = site!.href.replace(/\/$/, '');
  const menuMod = one<any>('SELECT MAX(updated_at) m FROM items')?.m;
  const urls: [string, string][] = [
    ['/', iso(menuMod)], ['/menu/', iso(menuMod)], ['/fotootchety/', ''], ['/about/', ''], ['/dostavka-i-oplata/', ''],
  ];
  for (const f of all<any>('SELECT slug, updated_at FROM formats WHERE active=1 ORDER BY sort')) urls.push([`/${f.slug}/`, iso(f.updated_at)]);
  for (const s of sections) if (itemsOf(s).length || items.some((i) => i.section === s.id)) urls.push([`/menu/${s.code}/`, iso(menuMod)]);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([p, m]) => `  <url><loc>${base}${p}</loc>${m ? `<lastmod>${m}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
