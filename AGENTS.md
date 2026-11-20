# Codex workflow for Studio Vkusa

The local workspace may contain a separate legacy Bitrix copy. It is excluded from the public Git repository. Inspect the relevant implementation before changing anything and preserve the legacy copy unless the task explicitly includes it.

## Project map and sources of truth

- `web/` is the new production target: Astro 7 SSR with the Node adapter, Tailwind CSS 4, and the built-in `node:sqlite` database API. It requires Node.js 22.23.4 or newer.
- `www/` is the local copy of the legacy 1C-Bitrix site. Treat it as migration source material, not as the default target for new product work.
- `docker-compose.yml`, `docker/`, and `db-init/` run the legacy copy locally at `http://localhost:8080`.
- `tools/export_bitrix.py`, `web/src/data/*.json`, and `web/scripts/images.mjs` support migration from Bitrix.
- `web/data/site.db` and `web/data/uploads/` hold mutable site data and uploaded media. Back up the whole `web/data/` directory before risky data changes.
- `web/README.md`, `deploy/client1-server.mjs`, `deploy/client1.npmrc`, and `deploy/client1-backup.sh` describe the current client1 technical deployment. The systemd and nginx examples describe the earlier VPS option.
- Prefer current code and configuration over historical chat or memory. If these instructions become stale, update them in the same change.

## Product and design invariants

- The client is «Студия Вкуса», a catering company in Barnaul. The new site replaces the legacy Bitrix frontend with a standalone site and its own administration system.
- Preserve `web/public/logo-full.png` and the established brand direction: red `#D01414`, black, and cream. Use `bufette.ru` and `brusketta.pro` only as references; do not copy their content.
- The administration area at `/admin/` includes admin/manager/editor roles, first-party analytics, lead CRM, CRUD for menus, formats, pages, reviews and photo reports, SEO and redirects, media, audit log, settings, and backup. Preserve these capabilities when changing the application.
- Editable content belongs in SQLite and uploaded media, not hard-coded into templates unless it is seed or fallback content.
- The local administrator password and notification credentials belong in `web/.env`; never print, commit, or copy them into documentation.

## Legacy Bitrix boundaries

- The saved Bitrix license expiry date is 2024-12-15; verify its current status before making any licensing decision.
- Local changes in `www/bitrix/.settings.php` and `www/.htaccess` are for the local copy. Do not deploy them to the live legacy site. Preserve any matching `*.orig` files.
- Do not delete or overwrite the legacy copy, database dump, `dist/site-patch.tar.gz`, or `db-patches/` unless the user explicitly scopes that cleanup.

## Information still required from the client

Do not invent these values. Keep placeholders clearly marked until the client answers.

1. Prices for each format: buffet, banquet, coffee break, corporate event, wedding, and birthday. The temporary value is «от 700 ₽».
2. Real customer reviews with permission to publish; the home-page review block is otherwise empty.
3. A public Telegram username, Telegram bot token and `chat_id`, plus SMTP access for `Info@studio-vkusa.ru` so application notifications can be configured.
4. Legal identity of the personal-data operator and seller, including name, INN/OGRNIP, and address; Roskomnadzor notification status; payment and contract model; whether registration and a personal account are required; and whether Telegram remains a notification channel. Privacy policy, offer, and agreement drafts require legal review.
5. Correct order-taking hours: the legacy delivery page says 09:00–18:00 by phone, while other pages say 12:00–23:00.
6. Domain transfer and cutover: confirm `www.studio-vkusa.ru` as the canonical host, plan DNS/HTTPS and redirects, and decide whether the Bitrix license should be renewed. The current technical host already runs Node.js 22.23.5.

## Remaining migration work

- The new site is deployed for review at `https://client1.179.252.220.236.sslip.io/`. Switch the main domain only after the client supplies the required production values and approves the cutover.
- Prepare redirects from legacy Bitrix URLs before switching traffic.
- Replace or convert remaining HEIC assets and improve source-image quality where needed without inventing or misrepresenting client content.
- Notifications require valid Telegram and/or SMTP credentials. Do not claim they work until tested with the production configuration.

## Deployment rules

- Build an isolated copy of `web/` without the local `.env` using `npm ci && npm run build`; run `npm start` for a production-like check when relevant.
- The current client1 host runs `/srv/clients/client1/project` with `npm start`, `HOST=127.0.0.1`, `PORT=3101`, and a 768 MB process limit. Its watcher ignores `.npm-cache` but scans other project files. Keep SQLite and uploads in `project/.npm-cache/studio-vkusa-data`, preserve that directory across releases, and keep npm logs in `.npm-cache` via `deploy/client1.npmrc`.
- The supplied systemd unit expects `/opt/studio-vkusa/web` and `/var/lib/studio-vkusa` only on a self-managed VPS; it is not used by the current client1 host.
- Never deploy the local `web/.env`. Never place secrets in a release archive, logs, chat output, or committed files.
- On client1, use the hosting-provided `HOST` and `PORT`; its reverse proxy exposes HTTPS. Keep `www.studio-vkusa.ru` canonical only after the approved domain cutover.
- Use SQLite's backup mechanism while the app runs. Do not overwrite production data during a release; preserve `client1:client1` ownership on the current host.
- After deployment, verify the systemd service, recent journal output, public HTTPS pages, `/admin/`, form submission, notifications when configured, media delivery, and redirects.
- Production publication, DNS changes, replacement of the live Bitrix site, and production-data mutations require explicit user approval.

## Verification

- Run the smallest relevant checks while iterating and `npm run build` before a substantial release.
- For user-facing changes, verify the changed flow in a browser at desktop and mobile widths and check the browser console.
- Preserve unrelated user files and generated data. Do not perform broad cleanup as part of an unrelated task.
