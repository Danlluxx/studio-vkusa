import type { APIRoute } from 'astro';
import { COOKIE, destroySession } from '../../lib/auth';
import { audit } from '../../lib/db';

export const prerender = false;
export const POST: APIRoute = ({ cookies, redirect, locals }) => {
  const t = cookies.get(COOKIE)?.value;
  if (t) destroySession(t);
  if (locals.user) audit(locals.user.login, 'logout', 'user', locals.user.id);
  cookies.delete(COOKIE, { path: '/' });
  return redirect('/admin/login/');
};
