import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.studio-vkusa.ru',
  output: 'server',               // страницы собираются на сервере, API заявок работает
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'always' },   // CSS встроен в страницу — нет блокирующего запроса
  // домены, с которых принимаем запросы (нужно за обратным прокси; также работает защита от CSRF)
  security: { allowedDomains: [{ hostname: 'www.studio-vkusa.ru', protocol: 'https' }, { hostname: 'studio-vkusa.ru', protocol: 'https' }, { hostname: 'client1.179.252.220.236.sslip.io', protocol: 'https' }, { hostname: 'localhost' }, { hostname: '127.0.0.1' }] },
  vite: { plugins: [tailwindcss()] },
});
