# Студия Вкуса — новый сайт (Astro + Tailwind + SQLite)

Требуется **Node.js 22.23.4+** (встроенный `node:sqlite`; также это минимальная версия для Astro 7).

```bash
npm install
cp .env.example .env     # задайте ADMIN_PASSWORD (от 10 символов)
npm run dev              # http://localhost:4321   админка: /admin/
npm run build && npm start      # прод (порт 4321, переменные PORT/HOST)
```

## Данные
- Всё редактируемое хранится в `data/site.db` (SQLite) + фото в `data/uploads/`. **Эту папку нужно бэкапить.**
  Папка создаётся сама при первом запуске, начальный контент берётся из `src/data/*.json` (выгрузка из Битрикса).
- Админка: аналитика, заявки (CRM), меню/цены/разделы, страницы форматов, тексты, отзывы, фотоотчёты, медиатека, SEO и редиректы, пользователи и роли, настройки, журнал действий, резервная копия.
- Аналитика собирается самим сайтом (cookie `vk_sid`, без личных данных); можно подключить Яндекс Метрику в Настройках.
- Демо-данные для проверки: `node scripts/demo-data.mjs`, удалить: `node scripts/demo-data.mjs --clear`.

## Прод за nginx
Проксируйте на `127.0.0.1:4321`, передавайте `Host`, `X-Forwarded-Proto`, `X-Forwarded-For`. Домены прописаны в `astro.config.mjs → security.allowedDomains`.
Фото старого сайта лежат в `static-media/` (раздаются маршрутом `/media/` с кэшем на год), пересобираются командой `npm run images` (нужна папка `../www/upload`). Шрифты урезаются скриптом `python3 scripts/subset-fonts.py` (результат в `src/fonts/`).
Сжатие Brotli/Gzip включено в самом приложении; за nginx с собственным сжатием отключите: `COMPRESS=0`.

## Запуск через systemd на VPS

Сервис находится в `../deploy/studio-vkusa.service`, шаблон переменных — в `../deploy/studio-vkusa.env.example`.
Он ожидает код сайта в `/opt/studio-vkusa/web`, Node.js 22.23.4+ в `/usr/bin/node` и данные в `/var/lib/studio-vkusa`.
Перед копированием соберите сайт (`npm ci && npm run build`); на VPS должны быть доступны `dist/`, `static-media/`, `src/data/`, `src/content/` и runtime-зависимости из `node_modules/`.

```bash
sudo useradd --system --user-group --home-dir /var/lib/studio-vkusa --shell /usr/sbin/nologin studio-vkusa
sudo install -m 0644 ../deploy/studio-vkusa.service /etc/systemd/system/studio-vkusa.service
sudo install -m 0600 ../deploy/studio-vkusa.env.example /etc/studio-vkusa.env
sudoedit /etc/studio-vkusa.env # задайте новый длинный ADMIN_PASSWORD
sudo systemctl daemon-reload
sudo systemctl enable --now studio-vkusa
sudo systemctl status studio-vkusa
```

Код и `node_modules/` должны быть доступны для чтения пользователю `studio-vkusa` (например, root:root и каталоги с правом чтения/прохода для остальных). `StateDirectory` создаёт `/var/lib/studio-vkusa` с доступом сервисного пользователя. Файл `/etc/studio-vkusa.env` должен оставаться `root:root` и `0600`: systemd передаёт его переменные процессу без доступа пользователя к самому файлу. Не копируйте локальный `web/.env` на VPS и не включайте секреты в релизный архив.

Проверьте `command -v node`: если путь отличается от `/usr/bin/node`, замените `ExecStart` в установленном service-файле. После обновления кода: `sudo systemctl restart studio-vkusa`; диагностика: `sudo journalctl -u studio-vkusa -n 100 --no-pager`. Порт 4321 должен слушать только localhost, внешний трафик принимает nginx.

Если переносите существующую базу, скопируйте `data/` в `/var/lib/studio-vkusa` перед первым запуском и выдайте владение `studio-vkusa:studio-vkusa`. `ADMIN_PASSWORD` создаёт администратора только в базе без пользователей; смена этой переменной не меняет пароль уже созданного аккаунта. Копируйте SQLite-базу только после штатной остановки приложения либо используйте встроенную команду резервного копирования SQLite.

## Текущий технический хостинг client1

Сайт доступен для проверки по адресу `https://client1.179.252.220.236.sslip.io/`. Хостинг запускает `/srv/clients/client1/project` командой `npm start`, выставляет `HOST=127.0.0.1` и `PORT=3101`, устанавливает только production-зависимости и перезапускает приложение после изменений. Node.js 22.23.5 установлен. Не переключайте на этот адрес основной домен без отдельного согласования.

Сборку выполняйте в чистой копии `web/` без `.env`, `data/` и `node_modules/`: `npm ci && npm run build`. В релиз включайте `dist/`, `static-media/`, `src/data/`, `src/content/`, остальные исходники и `package-lock.json`, но не локальный `.env` или текущую базу данных. Для этого хостинга скопируйте `../deploy/client1-server.mjs` в корень релиза как `server.mjs`, задайте в копии `package.json` команду `start: node server.mjs` и добавьте `../deploy/client1.npmrc` как `.npmrc`.

Рабочая SQLite-база и загрузки находятся в `/srv/clients/client1/project/.npm-cache/studio-vkusa-data/`. Этот каталог исключён из наблюдения автодеплоя; **не удаляйте его при обновлениях и не очищайте как обычный npm-кэш**. Перед заменой каталога проекта переносите `.npm-cache/studio-vkusa-data/` в новый релиз. Ежедневная локальная копия базы создаётся в `/srv/clients/client1/backups/` скриптом `../deploy/client1-backup.sh`; она находится на том же сервере и не заменяет внешнюю копию. Технический хост получает `X-Robots-Tag: noindex, nofollow`; основной домен пока не переключён.

## Предыдущая проверка на Hostkey VPS

На VPS `77.91.72.122` сайт запущен через systemd и nginx в режиме проверки по IP. Конфигурация `../deploy/nginx-stage.conf` отдаёт публичные страницы по HTTP, закрывает `/admin/` и добавляет `X-Robots-Tag: noindex, nofollow`. Это не конфигурация для домена: перед переключением DNS нужны рабочий HTTPS, проверенные формы и уведомления, а также подтверждённые данные клиента из `AGENTS.md`.

На этом VPS `npm run build` завершался с `Illegal instruction`. Собирайте `web/dist/` локально на Node.js 22.23.4+ и передавайте его отдельным архивом как второй аргумент `../deploy/hostkey-install.sh`; скрипт установит Linux-зависимости через `npm ci` и распакует готовую сборку. Не включайте `web/.env` в архив. Для повторного деплоя сохраняйте `/var/lib/studio-vkusa` и `/etc/studio-vkusa.env`.
