import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from '../../lib/uploads';

export const prerender = false;
const TYPES: Record<string, string> = { webp: 'image/webp', avif: 'image/avif' };

/** Раздаёт фото, загруженные через админку (хранятся в data/uploads) */
export const GET: APIRoute = ({ params }) => {
  const f = params.file || '';
  const m = /^([a-f0-9]{12})-(\d{3,4})\.(webp|avif)$/.exec(f);
  if (!m) return new Response(null, { status: 404 });
  const file = path.join(UPLOAD_DIR, f);
  if (!fs.existsSync(file)) return new Response(null, { status: 404 });
  return new Response(fs.readFileSync(file), { headers: { 'Content-Type': TYPES[m[3]], 'Cache-Control': 'public, max-age=31536000, immutable' } });
};
