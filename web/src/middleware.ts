import { defineMiddleware } from 'astro:middleware';
import { one, run } from './lib/db';
import { COOKIE, userByToken, can } from './lib/auth';
import { attribution, isBot, logEvent, newSid } from './lib/track';
import { legacyRedirect } from './lib/legacy';
import { env } from './lib/env';
import { compress } from './lib/compress';

const SKIP = /^\/(api|admin|media|u|_astro|favicon|logo|robots|sitemap|app\.js|chef)/;

export const onRequest = defineMiddleware(async (ctx, next) => {
  const response = await handle(ctx, next);
  if (env('STAGING_SITE') === '1') response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return compress(ctx.request, response);
});

async function handle(ctx: Parameters<Parameters<typeof defineMiddleware>[0]>[0], next: Parameters<Parameters<typeof defineMiddleware>[0]>[1]): Promise<Response> {
  const url = new URL(ctx.request.url);
  const p = url.pathname;

  /* один главный домен: CANONICAL_HOST=www.studio-vkusa.ru (в .env). Технические домены и «голый» домен уходят 301 на главный */
  const canon = env('CANONICAL_HOST');
  const host = (ctx.request.headers.get('x-forwarded-host') || url.host).split(',')[0].trim();
  if (canon && host !== canon && !/^(localhost|127\.0\.0\.1)/.test(host) && (ctx.request.method === 'GET' || ctx.request.method === 'HEAD')) {
    return ctx.redirect(`https://${canon}${p}${url.search}`, 301);
  }

  /* старые адреса Битрикса (/catalog/..., /basket/ и т.д.) */
  if (ctx.request.method === 'GET' && (p.startsWith('/catalog') || p === '/basket/' || p === '/basket' || p.startsWith('/order') || p === '/index.php' || p.startsWith('/personal/'))) {
    const to = legacyRedirect(p.endsWith('/') || p.endsWith('.html') || p.endsWith('.php') ? p : p + '/');
    if (to && to !== p) return ctx.redirect(to, 301);
  }

  /* единый вид адресов: со слэшем на конце (кроме файлов и API) */
  if ((ctx.request.method === 'GET' || ctx.request.method === 'HEAD') && !p.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(p) && !p.startsWith('/api/')) {
    return ctx.redirect(p + '/' + url.search, 301);
  }

  /* ——— админка ——— */
  if (p.startsWith('/admin')) {
    const secure = url.protocol === 'https:';
    const origin = ctx.request.headers.get('origin');
    if (ctx.request.method !== 'GET' && ctx.request.method !== 'HEAD' && origin && new URL(origin).host !== url.host) {
      return new Response('Forbidden (origin)', { status: 403 });     // защита от CSRF
    }
    const isLogin = p === '/admin/login/';
    const user = userByToken(ctx.cookies.get(COOKIE)?.value);
    if (user) ctx.locals.user = user;
    if (!user && !isLogin) return ctx.redirect('/admin/login/?next=' + encodeURIComponent(p));
    if (user && !isLogin && !can(user.role, p)) return new Response('Недостаточно прав', { status: 403 });
    const res = await next();
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    res.headers.set('X-Frame-Options', 'DENY');
    void secure;
    return res;
  }

  /* ——— публичная часть ——— */
  if (ctx.request.method === 'GET' && !SKIP.test(p)) {
    const r = one<any>('SELECT id,to_path,code FROM redirects WHERE from_path=?', p) || one<any>('SELECT id,to_path,code FROM redirects WHERE from_path=?', p.replace(/\/$/, ''));
    if (r) { run('UPDATE redirects SET hits=hits+1 WHERE id=?', r.id); return ctx.redirect(r.to_path, r.code === 302 ? 302 : 301); }
  }
  const res = await next();

  const ct = res.headers.get('content-type') || '';
  if (ctx.request.method === 'GET' && res.status === 200 && ct.includes('text/html') && !SKIP.test(p)) {
    const ua = ctx.request.headers.get('user-agent') || '';
    if (!isBot(ua) && ctx.request.headers.get('sec-purpose') !== 'prefetch') {
      let sid = ctx.cookies.get('vk_sid')?.value;
      if (!sid) { sid = newSid(); ctx.cookies.set('vk_sid', sid, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', httpOnly: true, secure: url.protocol === 'https:' }); }
      const a = attribution(url, ctx.request.headers.get('referer') || '', url.host);
      try { logEvent({ sid, type: 'pageview', path: p, ref: a.ref, source: a.source, medium: a.medium, campaign: a.campaign, ua }); } catch (e) { console.error('[track]', e); }
    }
  }
  return res;
}
