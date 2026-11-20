import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gzip = promisify(zlib.gzip), brotli = promisify(zlib.brotliCompress);
const TEXTUAL = /^(text\/|application\/(json|xml|javascript)|image\/svg)/;

/** Сжимает текстовые ответы (HTML, XML, JSON) в Brotli/Gzip. За nginx со своим сжатием отключается: COMPRESS=0 */
export async function compress(req: Request, res: Response): Promise<Response> {
  if (process.env.COMPRESS === '0' || req.method === 'HEAD' || res.status === 204 || res.status === 304 || !res.body) return res;
  if (res.headers.get('content-encoding')) return res;
  const type = res.headers.get('content-type') || '';
  if (!TEXTUAL.test(type)) return res;
  const accept = req.headers.get('accept-encoding') || '';
  const enc = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : '';
  if (!enc) return res;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) return new Response(buf, { status: res.status, headers: res.headers });
  const out = enc === 'br'
    ? await brotli(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } })
    : await gzip(buf, { level: 6 });
  const headers = new Headers(res.headers);
  headers.set('Content-Encoding', enc);
  headers.set('Vary', 'Accept-Encoding');
  headers.delete('Content-Length');
  return new Response(out, { status: res.status, statusText: res.statusText, headers });
}
