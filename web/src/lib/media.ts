import legacy from '../data/media.json';
import { one } from './db';

type M = { id: string; w: number; h: number; widths: number[]; up?: boolean };
const old = legacy as Record<string, M>;
const memo = new Map<string, M | null>();

function find(src: string): (M & { dir: string }) | null {
  if (old[src]) return { ...old[src], dir: '/media' };
  if (!src.startsWith('/u/')) return null;
  const id = src.slice(3);
  if (!memo.has(id)) {
    const r = one<any>('SELECT * FROM media WHERE id=?', id);
    memo.set(id, r ? { id: r.id, w: r.w, h: r.h, widths: JSON.parse(r.widths), up: !!r.up } : null);
  }
  const m = memo.get(id);
  return m ? { ...m, dir: '/u' } : null;
}

/** srcset для оригинала из Битрикса (/upload/...) или файла, загруженного через админку (/u/<id>) */
export function pic(src?: string | null) {
  if (!src) return null;
  const e = find(src);
  if (!e) return null;
  const best = e.widths[e.widths.length - 1];
  const set = (ext: string) => e.widths.filter((w) => ext === 'webp' || w >= 960).map((w) => `${e.dir}/${e.id}-${w}.${ext} ${w}w`).join(', ');
  return { webp: set('webp'), avif: set('avif'), src: `${e.dir}/${e.id}-${best}.webp`, thumb: `${e.dir}/${e.id}-${e.widths[0]}.webp`, w: e.w, h: e.h, ratio: e.w / e.h };
}
export const forgetMedia = (id: string) => memo.delete(id);
