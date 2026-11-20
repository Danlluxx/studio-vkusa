import crypto from 'node:crypto';
import { run, now, one } from './db';

const BOT = /bot|crawl|spider|slurp|bingpreview|yandex|facebookexternalhit|telegram|whatsapp|curl|wget|python|go-http|headless|lighthouse|monitor|uptime|preview/i;
export const isBot = (ua: string) => !ua || BOT.test(ua);

export function parseUA(ua: string) {
  const device = /ipad|tablet/i.test(ua) ? 'tablet' : /mobi|android|iphone/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /yabrowser/i.test(ua) ? 'Яндекс' : /edg\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera' : /firefox/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Другой';
  const os = /windows/i.test(ua) ? 'Windows' : /iphone|ipad|ios/i.test(ua) ? 'iOS' : /android/i.test(ua) ? 'Android' : /mac os/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : 'Другая';
  return { device, browser, os };
}

const SEARCH = /(^|\.)(yandex|google|bing|duckduckgo|mail|rambler|yahoo)\./i;
const SOCIAL = /(^|\.)(vk\.com|vk\.ru|t\.me|telegram|instagram|facebook|ok\.ru|youtube|dzen)/i;

export function attribution(url: URL, referrer: string, ownHost: string) {
  const q = url.searchParams;
  let host = ''; try { host = referrer ? new URL(referrer).hostname.replace(/^www\./, '') : ''; } catch {}
  if (host === ownHost.replace(/^www\./, '').split(':')[0]) host = '';
  const source = q.get('utm_source') || host || 'direct';
  const medium = q.get('utm_medium') || (!host ? (q.get('utm_source') ? 'utm' : 'direct') : SEARCH.test(host) ? 'organic' : SOCIAL.test(host) ? 'social' : 'referral');
  return { source: source.slice(0, 80), medium: medium.slice(0, 40), campaign: (q.get('utm_campaign') || '').slice(0, 80), ref: host };
}

export const newSid = () => crypto.randomBytes(9).toString('base64url');

export function logEvent(e: { sid: string; type: string; path?: string; ref?: string; source?: string; medium?: string; campaign?: string; ua?: string; label?: string }) {
  const u = parseUA(e.ua || '');
  run('INSERT INTO events (ts,sid,type,path,ref,source,medium,campaign,device,browser,os,label) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    now(), e.sid, e.type, e.path?.slice(0, 200), e.ref, e.source, e.medium, e.campaign, u.device, u.browser, u.os, e.label?.slice(0, 200));
}
/** Источник визита по sid: берём первое событие сессии */
export const sourceOf = (sid: string) => one<any>('SELECT source,medium,campaign,ref,device FROM events WHERE sid=? AND type=? ORDER BY ts LIMIT 1', sid, 'pageview');
