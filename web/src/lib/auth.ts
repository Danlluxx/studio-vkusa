import crypto from 'node:crypto';
import { one, run, now, all } from './db';

export type Role = 'admin' | 'manager' | 'editor';
export const ROLES: Record<Role, string> = { admin: 'Администратор', manager: 'Менеджер (заявки и аналитика)', editor: 'Редактор (контент)' };
export const COOKIE = 'vk_admin';
const DAY = 86400000, TTL = 7 * DAY;

/** Доступ по разделам: какие префиксы /admin/ доступны роли */
const ACCESS: Record<Role, string[]> = {
  admin: ['/admin/'],
  manager: ['/admin/', '/admin/leads/', '/admin/analytics/', '/admin/profile/'],
  editor: ['/admin/', '/admin/menu/', '/admin/formats/', '/admin/pages/', '/admin/reviews/', '/admin/reports/', '/admin/seo/', '/admin/media/', '/admin/profile/'],
};
export const can = (role: Role, path: string) => role === 'admin' || ACCESS[role].some((p) => (p === '/admin/' ? path === '/admin/' : path.startsWith(p)));

const sha = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

export function createSession(userId: number, ua = '', ip = '') {
  const token = crypto.randomBytes(32).toString('base64url');
  run('INSERT INTO sessions (token,user_id,exp,ua,ip,created_at) VALUES (?,?,?,?,?,?)', sha(token), userId, now() + TTL, ua.slice(0, 200), ip, now());
  run('UPDATE users SET last_login=? WHERE id=?', now(), userId);
  run('DELETE FROM sessions WHERE exp<?', now());
  return token;
}
export function userByToken(token?: string) {
  if (!token) return null;
  const r = one<any>('SELECT u.id,u.login,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.exp>? AND u.active=1', sha(token), now());
  return r ? { id: r.id as number, login: r.login as string, name: (r.name || r.login) as string, role: r.role as Role } : null;
}
export const destroySession = (token: string) => run('DELETE FROM sessions WHERE token=?', sha(token));
export const killUserSessions = (uid: number) => run('DELETE FROM sessions WHERE user_id=?', uid);
export const sessionsOf = (uid: number) => all('SELECT created_at,ua,ip,exp FROM sessions WHERE user_id=? ORDER BY created_at DESC', uid);

/* защита от перебора пароля */
const fails = new Map<string, number[]>();
export const tooMany = (ip: string) => (fails.get(ip) || []).filter((t) => now() - t < 600000).length >= 5;
export const noteFail = (ip: string) => fails.set(ip, [...(fails.get(ip) || []).filter((t) => now() - t < 600000), now()]);
export const clearFails = (ip: string) => fails.delete(ip);
