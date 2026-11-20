import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from './env';

// node:sqlite встроен в Node 22.5+ (без нативных зависимостей). Подключаем через require,
// чтобы сборщик не пытался его бандлить.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

export const DATA_DIR = path.resolve(env('DATA_DIR') || 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT UNIQUE NOT NULL, name TEXT, role TEXT NOT NULL DEFAULT 'editor',
  password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, last_login INTEGER);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, exp INTEGER NOT NULL, ua TEXT, ip TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, user TEXT, action TEXT, entity TEXT, entity_id TEXT, details TEXT);
CREATE TABLE IF NOT EXISTS sections (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, parent INTEGER, sort INTEGER DEFAULT 500, active INTEGER DEFAULT 1, picture TEXT, description TEXT);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT NOT NULL, section INTEGER, sort INTEGER DEFAULT 500, active INTEGER DEFAULT 1,
  preview TEXT, detail TEXT, price REAL, unit TEXT, price_text TEXT, image TEXT, photos TEXT DEFAULT '[]', menu_pdf TEXT, popular INTEGER DEFAULT 0, updated_at INTEGER);
CREATE INDEX IF NOT EXISTS items_section ON items(section);
CREATE TABLE IF NOT EXISTS formats (slug TEXT PRIMARY KEY, sort INTEGER DEFAULT 500, active INTEGER DEFAULT 1, data TEXT NOT NULL, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS pages (slug TEXT PRIMARY KEY, title TEXT, description TEXT, h1 TEXT, html TEXT, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, event TEXT, text TEXT NOT NULL, rating INTEGER DEFAULT 5, sort INTEGER DEFAULT 500, active INTEGER DEFAULT 1, created_at INTEGER);
CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, preview TEXT, image TEXT, sort INTEGER DEFAULT 500, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS seo (path TEXT PRIMARY KEY, title TEXT, description TEXT, noindex INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS redirects (id INTEGER PRIMARY KEY AUTOINCREMENT, from_path TEXT UNIQUE NOT NULL, to_path TEXT NOT NULL, code INTEGER DEFAULT 301, hits INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, name TEXT, phone TEXT, date TEXT, guests INTEGER, comment TEXT, items TEXT DEFAULT '[]',
  page TEXT, sid TEXT, source TEXT, medium TEXT, campaign TEXT, referrer TEXT, device TEXT, status TEXT DEFAULT 'new', manager_comment TEXT, amount REAL, assignee TEXT, updated_at INTEGER);
CREATE INDEX IF NOT EXISTS leads_ts ON leads(ts);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, sid TEXT, type TEXT NOT NULL, path TEXT, ref TEXT, source TEXT, medium TEXT, campaign TEXT, device TEXT, browser TEXT, os TEXT, label TEXT);
CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS events_type ON events(type, ts);
CREATE TABLE IF NOT EXISTS vitals (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, sid TEXT, path TEXT, device TEXT, conn TEXT, lcp REAL, inp REAL, cls REAL, fcp REAL, ttfb REAL);
CREATE INDEX IF NOT EXISTS vitals_ts ON vitals(ts);
CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, name TEXT, w INTEGER, h INTEGER, widths TEXT, up INTEGER DEFAULT 0, bytes INTEGER, created_at INTEGER);
`;

declare global { var __vkdb: InstanceType<typeof DatabaseSync> | undefined; }

function open() {
  const db = new DatabaseSync(path.join(DATA_DIR, 'site.db'));
  db.exec(SCHEMA);
  return db;
}
export const db = (globalThis.__vkdb ??= open());

/* ——— вспомогательные обёртки ——— */
type Row = Record<string, any>;
const clean = (p: any[]) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));
export const all = <T = Row>(sql: string, ...p: any[]) => db.prepare(sql).all(...clean(p)) as T[];
export const one = <T = Row>(sql: string, ...p: any[]) => db.prepare(sql).get(...clean(p)) as T | undefined;
export const run = (sql: string, ...p: any[]) => db.prepare(sql).run(...clean(p));
export const tx = <T>(fn: () => T): T => {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
};
export const now = () => Date.now();

export function audit(user: string, action: string, entity: string, id?: string | number, details?: unknown) {
  run('INSERT INTO audit (ts,user,action,entity,entity_id,details) VALUES (?,?,?,?,?,?)', now(), user, action, entity, id == null ? null : String(id), details ? JSON.stringify(details).slice(0, 2000) : null);
}

/* ——— пароли ——— */
export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
export function verifyPassword(pw: string, stored: string) {
  const [alg, salt, hash] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const h = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
}

/* ——— первичное наполнение ——— */
function readJson<T>(f: string, d: T): T {
  try { return JSON.parse(fs.readFileSync(path.resolve('src/data', f), 'utf8')); } catch { return d; }
}
const SEED_FLAG = 'seeded_v1';

export function seed() {
  if (!one('SELECT 1 FROM settings WHERE key=?', SEED_FLAG)) seedContent();
  const login = env('ADMIN_LOGIN') || 'admin', pw = env('ADMIN_PASSWORD');
  if (pw && !one('SELECT 1 FROM users LIMIT 1')) {
    run('INSERT INTO users (login,name,role,password_hash,active,created_at) VALUES (?,?,?,?,1,?)', login, 'Администратор', 'admin', hashPassword(pw), now());
    console.log(`[admin] создан пользователь «${login}» из ADMIN_PASSWORD`);
  }
}

function seedContent() {
  tx(() => {
    const sections = readJson<Row[]>('sections.json', []);
    for (const s of sections) run('INSERT OR IGNORE INTO sections (id,code,name,parent,sort,active,picture,description) VALUES (?,?,?,?,?,1,?,?)', s.id, s.code, s.name, s.parent, s.sort ?? 500, s.picture, s.description);
    const items = readJson<Row[]>('items.json', []);
    for (const i of items) run(
      'INSERT OR IGNORE INTO items (id,code,name,section,sort,active,preview,detail,price,unit,price_text,image,photos,menu_pdf,popular,updated_at) VALUES (?,?,?,?,?,1,?,?,?,?,?,?,?,?,0,?)',
      i.id, i.code, i.name, i.section, i.sort ?? 500, i.preview, i.detail, i.price ? Number(i.price) : null, i.unit, i.priceText, i.image || i.imagePreview, JSON.stringify(i.photos || []), i.menuPdf, now());
    const formats = readJson<Record<string, Row>>('formats.json', {});
    let n = 0;
    for (const [slug, d] of Object.entries(formats)) run('INSERT OR IGNORE INTO formats (slug,sort,active,data,updated_at) VALUES (?,?,1,?,?)', slug, (n++) * 10, JSON.stringify(d), now());
    for (const r of readJson<Row[]>('reports.json', [])) run('INSERT INTO reports (id,name,preview,image,sort,active) VALUES (?,?,?,?,?,1)', r.id, r.name, (r.preview || '').replace(/#\S+/g, '').trim(), r.image, r.sort ?? 500);
    const pages: Record<string, [string, string, string]> = {
      about: ['about', 'О нас — Студия Вкуса | Кейтеринг в Барнауле', 'О нас'],
      dostavka: ['dostavka-i-oplata', 'Доставка и оплата — Студия Вкуса', 'Доставка и оплата'],
      policy: ['politika-v-otnoshenii-personalnykh-dannykh', 'Политика в отношении персональных данных', 'Политика в отношении персональных данных'],
      oferta: ['publichnaya-oferta', 'Публичная оферта', 'Публичная оферта'],
      agreement: ['polzovatelskoe-soglashenie', 'Пользовательское соглашение', 'Пользовательское соглашение'],
    };
    const DESC: Record<string, string> = {
      about: 'Команда «Студии Вкуса»: выездной кейтеринг в Барнауле, внимание к мелочам, меню под ваши пожелания и безупречное обслуживание гостей.',
      dostavka: 'Условия заказа, доставка по Барнаулу и близлежащим населённым пунктам, самовывоз и способы оплаты в «Студии Вкуса».',
      policy: 'Политика в отношении обработки персональных данных сайта «Студия Вкуса»: какие данные мы собираем и как их используем.',
      oferta: 'Публичная оферта «Студии Вкуса»: условия заказа, оплаты, доставки и возврата для клиентов сайта.',
      agreement: 'Пользовательское соглашение сайта «Студия Вкуса»: права и обязанности клиента при оформлении заявок и заказов.',
    };
    for (const [file, [slug, title, h1]] of Object.entries(pages)) {
      let html = ''; try { html = fs.readFileSync(path.resolve('src/content', file + '.html'), 'utf8'); } catch {}
      run('INSERT OR IGNORE INTO pages (slug,title,description,h1,html,updated_at) VALUES (?,?,?,?,?,?)', slug, title, DESC[file] || title, h1, html, now());
    }
    run('INSERT INTO settings (key,value) VALUES (?,?)', SEED_FLAG, '1');
  });
}
seed();
