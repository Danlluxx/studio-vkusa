import sharp from 'sharp';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, run, one, now } from './db';
import { forgetMedia } from './media';

const WIDTHS = [480, 960, 1600];
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

/** Принимает фото из формы, делает WebP/AVIF трёх размеров, возвращает ссылку вида /u/<id> */
export async function saveImage(file: File, minUp = 960): Promise<string> {
  if (!/^image\/(jpeg|png|webp|avif|heic|heif|gif)$/.test(file.type)) throw new Error('Допустимы JPG, PNG, WebP, AVIF');
  if (file.size > 25 * 1024 * 1024) throw new Error('Файл больше 25 МБ');
  const buf = Buffer.from(await file.arrayBuffer());
  const meta = await sharp(buf, { failOn: 'none' }).rotate().metadata();
  const w0 = meta.autoOrient?.width ?? meta.width!, h0 = meta.autoOrient?.height ?? meta.height!;
  const id = crypto.randomBytes(6).toString('hex');
  const small = Math.max(w0, h0) < minUp;
  const widths = WIDTHS.filter((w) => w <= Math.max(w0, small ? minUp : 0) + 40);
  if (!widths.length) widths.push(Math.min(w0, 480));
  for (const w of widths) {
    let p = sharp(buf, { failOn: 'none' }).rotate().resize({ width: small ? w : Math.min(w, w0), kernel: 'lanczos3' });
    if (small) p = p.sharpen({ sigma: 0.8, m1: 0.8, m2: 1.5 });
    await p.clone().webp({ quality: 82, effort: 5 }).toFile(path.join(UPLOAD_DIR, `${id}-${w}.webp`));
    if (w >= 960) await p.clone().avif({ quality: 55, effort: 4 }).toFile(path.join(UPLOAD_DIR, `${id}-${w}.avif`));
  }
  run('INSERT INTO media (id,name,w,h,widths,up,bytes,created_at) VALUES (?,?,?,?,?,?,?,?)', id, file.name.slice(0, 120), w0, h0, JSON.stringify(widths), small ? 1 : 0, file.size, now());
  return `/u/${id}`;
}

export function deleteImage(ref: string) {
  if (!ref.startsWith('/u/')) return;
  const id = ref.slice(3);
  const m = one<any>('SELECT widths FROM media WHERE id=?', id);
  if (!m) return;
  for (const w of JSON.parse(m.widths)) for (const e of ['webp', 'avif']) fs.rmSync(path.join(UPLOAD_DIR, `${id}-${w}.${e}`), { force: true });
  run('DELETE FROM media WHERE id=?', id);
  forgetMedia(id);
}
