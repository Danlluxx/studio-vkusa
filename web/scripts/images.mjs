// Готовит адаптивные WebP/AVIF из оригиналов Битрикса. Запуск: npm run images
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.resolve(ROOT, '../www');            // локальная копия Битрикса
const OUT = path.join(ROOT, 'static-media');
const DATA = path.join(ROOT, 'src/data');
const WIDTHS = [480, 960, 1600];
const MIN_UP = 960;                                  // мелкие снимки доводим до 960 px по длинной стороне

const refs = new Set();
const walk = (v) => {
  if (typeof v === 'string' && v.startsWith('/upload/')) refs.add(v);
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
};
for (const f of fs.readdirSync(DATA)) if (f.endsWith('.json') && f !== 'media.json') walk(JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')));

const manifest = {};
let n = 0, upscaled = 0;
for (const ref of [...refs].sort()) {
  const file = path.join(SRC, ref);
  if (!fs.existsSync(file)) { console.warn('нет файла', ref); continue; }
  const id = crypto.createHash('sha1').update(ref).digest('hex').slice(0, 10);
  try {
    const img = sharp(file, { failOn: 'none' }).rotate();
    const meta = await img.metadata();
    const w0 = meta.autoOrient?.width ?? meta.width, h0 = meta.autoOrient?.height ?? meta.height;
    const long = Math.max(w0, h0);
    const small = long < MIN_UP && !/logo|\.png$/i.test(ref);
    const widths = WIDTHS.filter((w) => w <= Math.max(w0, small ? MIN_UP : 0) + 40);
    if (!widths.length) widths.push(Math.min(w0, 480));
    if (small) upscaled++;
    const made = [];
    for (const w of widths) {
      const outW = small ? Math.max(w, 0) : Math.min(w, w0);
      let p = sharp(file, { failOn: 'none' }).rotate().resize({ width: outW, withoutEnlargement: false, kernel: 'lanczos3' });
      if (small) p = p.sharpen({ sigma: 0.8, m1: 0.8, m2: 1.5 });
      const base = path.join(OUT, `${id}-${w}`);
      if (!fs.existsSync(base + '.webp')) await p.clone().webp({ quality: 82, effort: 5 }).toFile(base + '.webp');
      if (w >= 960 && !fs.existsSync(base + '.avif')) await p.clone().avif({ quality: 55, effort: 4 }).toFile(base + '.avif');
      made.push(w);
    }
    manifest[ref] = { id, w: w0, h: h0, widths: made, up: small };
    n++;
  } catch (e) { console.warn('ошибка', ref, e.message); }
}
fs.writeFileSync(path.join(DATA, 'media.json'), JSON.stringify(manifest));
console.log(`готово: ${n} изображений, из них растянуто ${upscaled}`);
