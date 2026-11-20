// Entry point for the restricted client1 Node.js host.
// Keep mutable SQLite data under .npm-cache: its deployment watcher ignores that tree.
process.env.DATA_DIR = '.npm-cache/studio-vkusa-data';
process.env.CANONICAL_HOST = '';
process.env.STAGING_SITE = '1';
process.env.TZ_OFFSET_H = '7';

await import('./dist/server/entry.mjs');
