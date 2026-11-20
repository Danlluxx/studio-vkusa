// Демо-данные для проверки админки: node scripts/demo-data.mjs  |  удалить: node scripts/demo-data.mjs --clear
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
const db = new DatabaseSync(path.resolve(process.env.DATA_DIR || 'data', 'site.db'));
if (process.argv.includes('--clear')) {
  db.exec("DELETE FROM events WHERE sid LIKE 'demo-%'; DELETE FROM leads WHERE sid LIKE 'demo-%';");
  console.log('демо-данные удалены'); process.exit(0);
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wpick = (pairs) => { let r = Math.random() * pairs.reduce((s, p) => s + p[1], 0); for (const [v, w] of pairs) if ((r -= w) <= 0) return v; return pairs[0][0]; };
const SRC = [[['yandex.ru', 'organic'], 40], [['google.com', 'organic'], 14], [['direct', 'direct'], 25], [['vk.com', 'social'], 9], [['2gis.ru', 'referral'], 8], [['yandex', 'cpc'], 4]];
const DEV = [['mobile', 62], ['desktop', 33], ['tablet', 5]];
const BR = [['Chrome', 45], ['Safari', 25], ['Яндекс', 18], ['Firefox', 6], ['Edge', 6]];
const OS = { mobile: [['Android', 55], ['iOS', 45]], tablet: [['iOS', 70], ['Android', 30]], desktop: [['Windows', 70], ['macOS', 25], ['Linux', 5]] };
const PAGES = ['/', '/', '/', '/menu/', '/menu/kanape/', '/menu/furshetnye-menu/', '/furshet/', '/banket/', '/korporativ/', '/svadba/', '/fotootchety/', '/about/', '/menu/deserty/', '/kofe-breyk/'];
const DISH = ['Галантин из индейки', 'Канапе с креветкой и чукой', 'Брускетта с лососем на бриошь', 'Киш с лососем', 'Панна-котта', 'Паштет из утиной печени', 'Вяленый хамон на шпажке', 'Канапе с ростбифом и печёным перцем'];
const NAMES = ['Анна', 'Игорь', 'Мария', 'Сергей', 'Ольга', 'Дмитрий', 'Елена', 'Артём'];
const ev = db.prepare('INSERT INTO events (ts,sid,type,path,ref,source,medium,campaign,device,browser,os,label) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
const ld = db.prepare('INSERT INTO leads (ts,name,phone,date,guests,comment,items,page,sid,source,medium,campaign,referrer,device,status,manager_comment,amount,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
const DAY = 86400000, now = Date.now();
db.exec('BEGIN');
let n = 0, leads = 0;
for (let d = 89; d >= 0; d--) {
  const base = 18 + Math.round(Math.sin(d / 5) * 6) + (90 - d) * 0.12;
  const visits = Math.round(base * (0.7 + Math.random() * 0.7) * ([0, 6].includes(new Date(now - d * DAY).getDay()) ? 0.7 : 1));
  for (let v = 0; v < visits; v++) {
    const sid = `demo-${d}-${v}-${Math.random().toString(36).slice(2, 7)}`;
    const [source, medium] = wpick(SRC), device = wpick(DEV), browser = wpick(BR), os = wpick(OS[device]);
    const hour = Math.min(23, Math.max(0, Math.round(11 + (Math.random() + Math.random() + Math.random() - 1.5) * 8)));
    let t = now - d * DAY - (now % DAY) + hour * 3600000 + Math.random() * 3600000; if (t > now) t = now - 60000;
    const pages = 1 + Math.floor(Math.random() ** 2 * 6);
    let path = pick(PAGES), engaged = false;
    for (let p = 0; p < pages; p++) {
      ev.run(Math.round(t), sid, 'pageview', path, source === 'direct' ? '' : source, source, medium, '', device, browser, os, null); n++;
      t += 20000 + Math.random() * 90000;
      if (path.startsWith('/menu') && Math.random() < 0.28) { ev.run(Math.round(t), sid, 'add_basket', path, '', source, medium, '', device, browser, os, pick(DISH)); n++; engaged = true; t += 8000; }
      path = pick(PAGES);
    }
    if (Math.random() < 0.05) { ev.run(Math.round(t), sid, wpick([['click_phone', 5], ['click_wa', 4], ['click_tg', 1]]), '/', '', source, medium, '', device, browser, os, ''); n++; }
    if (engaged ? Math.random() < 0.22 : Math.random() < 0.012) {
      ev.run(Math.round(t + 5000), sid, 'lead_open', '/', '', source, medium, '', device, browser, os, ''); t += 40000;
      ev.run(Math.round(t), sid, 'lead_submit', '/', '', source, medium, '', device, browser, os, ''); n += 2; leads++;
      const age = d, st = age > 10 ? wpick([['done', 55], ['rejected', 25], ['work', 20]]) : age > 2 ? wpick([['work', 40], ['done', 30], ['new', 20], ['rejected', 10]]) : 'new';
      ld.run(Math.round(t), pick(NAMES), '+7923' + String(1000000 + Math.floor(Math.random() * 8999999)), '', 10 + Math.floor(Math.random() * 90), '', JSON.stringify(engaged ? [{ name: pick(DISH), qty: 2, unit: 'от 10 шт' }] : []), '/', sid, source, medium, '', '', device, st, st === 'done' ? 'Согласовали меню' : '', st === 'done' ? 15000 + Math.floor(Math.random() * 90000) : null, Math.round(t + 3600000 * (1 + Math.random() * 20)));
    }
  }
}
db.exec('COMMIT');
console.log(`создано событий: ${n}, заявок: ${leads}`);
