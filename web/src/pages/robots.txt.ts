import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nDisallow: /admin/\nDisallow: /api/\nDisallow: /zayavka/\nClean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
