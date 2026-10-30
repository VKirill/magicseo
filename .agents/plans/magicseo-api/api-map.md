# MagicSEO (lk.magicseo.ru) — карта API

Разведка только для чтения, 2026-10-30. Машина: Mac mini (host_7sea4qaad8), headless-сессия browser-automation, логин из Env Catalog `MAGICSEO_LOGIN`. Ничего в аккаунте не создано, не изменено, не запущено и не удалено; диалоги открывались только для чтения полей и закрывались без сохранения.

Машинный список: [endpoints.json](endpoints.json). Сэмплы ответов: [samples/](samples/). Скриншоты разделов: [screenshots/](screenshots/).

## 1. Аутентификация

- `POST /backend/login`, JSON `{username, password}` → `{error, error_raw, result: {token, username, role, phone, tg, allow_finance}, total}`.
- Токен — **JWT (HS256)**, payload: `user_id`, `user_role`, `exp`. Срок жизни ≈ **7 суток** (по exp − времени выдачи).
- Хранится в **`localStorage.auth`** (там же `role`, `username`, `tg`). **Cookie не используются вообще** (в т.ч. httpOnly — пусто).
- Каждый запрос к `/backend/*` несёт заголовок **`Authorization: Bearer <jwt>`** (подтверждено перехватом заголовков; в бандле: `headers:{Authorization:"Bearer "+token}`).
- `/api/version` и `/api/strapi/*` — без авторизации.
- **Refresh-эндпоинта нет**: при 401 фронт просто разлогинивает (`localStorage.removeItem('auth')` → редирект на `/login`). Для серверного клиента: повторный `POST /backend/login` раз в ~7 дней.
- CSFR-токенов нет; extra-заголовков нет (только `Authorization` и опциональный `ch` query-параметр A/B-флага).
- **Серверный клиент переиспользуется тривиально**: логин → взять `result.token` → слать `Authorization: Bearer` на `https://lk.magicseo.ru/backend/*`. 2FA/captcha на логине по паре email+пароль не наблюдалось (по телефону есть flash-call верификация — отдельный путь).
- В `POST /backend/login` ответ **не** ставит куку — только тело. Значит сессия полностью stateless.

**Официального API / API-ключа в кабинете НЕТ** (см. §6).

## 2. Базовые соглашения

- Base URL — тот же origin: `https://lk.magicseo.ru/backend/...`; префикс `/api/` только для version и Strapi-статей помощи.
- Конверт ответа: `{error: "", error_raw: "", result: <данные>, total: N}` (у части эндпоинтов — «сырой» объект, напр. `/backend/balance`, `/backend/balance/detailed/v2`, `/backend/projects/demo_limit`).
- Деньги — **в копейках** (`money_balance: 11972100` = 119 721,00 ₽; `click_price: 100` = 1 ₽/клик).
- Даты — `YYYY-MM-DD` в query (`from`, `to`), таймстампы ISO8601 с MSK-смещением.
- Пагинация — `offset`/`limit` + `total` в конверте (keywords/v2, catalog_items); где-то только `limit`.
- Ошибки — HTTP 200 с `error`/`error_raw` в теле; 401 при протухшем токене.
- Websockets/SSE — **не используются** (0 вхождений `new WebSocket`/`new EventSource` в чанках; в live-сессии не видно). Статусы задач фронты поллит (`/positions_job` каждые ~30 с; projects store — `interval: 5000`).

## 3. Разделы кабинета и их запросы (observed live)

| Раздел | URL | Ключевые запросы |
|---|---|---|
| Логин | `/login` | `POST /backend/login`; вкладки «По почте»/«По телефону» (phone: `POST /lk/phone/request-call`, `POST /login/phone`, flash-call) |
| Дашборд «Проекты» | `/` | `projects/list`, `catalog_items` (дерево папок+проектов со сводной статистикой), `balance`, `balance/detailed/v2`, `tariff`, `fixed_tariff`, `projects/demo_limit`, `projects/desktop_available`, `projects/budget_exceeded`, `messages`, `wizard/progress`, `lk/user/notifications` |
| Проект «Продвижение» | `/project/{id}` | `GET /project/{id}?from&to`, `GET /project/{id}/keywords/v2?offset&limit&from&to&sort&checks_mode`, `keywords/categories_stat`, `positions_job` (поллинг), `autolaunch`, `lk/user/keywords_table_settings` |
| «Видимость конкурентов» | `/project/{id}?tab=competitors` | `competitors/list`, `competitors/visibility?from&to&limit&offset&order_by`, `competitors/graph?from&to&group_by=day&domains=` |
| Профиль | `/profile` | `user`, `lk/user/data_schedule`, `lk/user/projects`, `lk/tg`, `lk/user/notifications` |
| Реферальная программа | `/referral` | `referals`, `referals/card_data` |
| Пользователи и доступы | `/users-and-accesses` | `lk/invite-link`, `lk/users`, `lk/user/projects` |
| Биллинг | `/billing` | `billing/counters/income|expense|in_promotion?from&to`, `billing/graph/income|expense|in_promotion?from&to` |
| Помощь | `/help/article/*`, `/help/patchnotes` | `GET /api/strapi/kb/navigation?site=magic`, `GET /api/strapi/kb-articles?filters[slug][$eq]=…`, `GET /api/strapi/kb-patch-notes…` (Strapi, без авторизации) |
| Пополнить (диалог) | модалка | `POST payments/cloudpayments/start {amount,…}`, `POST payments/invoices {amount, comment, inn, ogrName, contract}`, `POST payments/crypto {amount}`, `GET payments/crypto/{id}` |
| Перевести (диалог) | модалка | `POST balance/transfer {to_project_id?|from_project_id?, amount}` |
| Создать проект (диалог) | модалка | `GET default_autolaunch` → `POST /project` (см. §4) |

Поля формы «Создать проект» (прочитаны, не отправлялись): Название проекта (текст), Адрес сайта (`example.com`), Город — выбор региона («Каждый проект создаётся для конкретного региона»), Сервис съёма позиций (select: Magic по умолчанию, «Стоимость 1 000 съёмов — 46 ₽»), тип профилей: Универсальные / Специализированные (десктоп). Кнопки Отмена/Создать.

## 4. Мутации (все — из JS-бандла, кнопки не нажимались)

Жизненный цикл, нужный нашему сервису:

| Действие | Вызов | Откуда |
|---|---|---|
| Создать проект | `POST /backend/project` body `{name, domain, region(213=Москва), provider, device, new_keywords_url, send_report, dynamic_semantics_enabled, category_auto_main_campaign, use_main_balance_for_testing, parent_id?}` | `index.342909ee.js` (CreateProject modal) |
| Запустить продвижение | `POST /backend/project/{id}/job` | `_id_.96804a8b.js`, `wizard.731e771f.js` |
| Остановить продвижение | `DELETE /backend/project/{id}/job` | там же |
| Автопилот вкл/выкл + настройки | `PATCH /backend/project/{id}/autolaunch` body `{active, pos_check_freq_mins, click_freq_mins, target_pos, budget, provider, start_pos, type, device, use_recommendations, click_target_pos, adaptive_*, brand…}` | `ExpenseBreakdown.52c9960c.js`, `keywords_table.3c03573c.js` |
| Сбросить ошибку автопилота | `POST /backend/project/{id}/autolaunch/reset_error` | `wizard.731e771f.js` |
| Переименовать/сменить регион | `PATCH /backend/project/{id}` body `{name, domain, region, provider, new_keywords_url, send_report}` | `_id_.96804a8b.js`, `wizard.731e771f.js` |
| Копировать проект | `POST /backend/project/copy` body `{project_id, name, region}` | `_id_.96804a8b.js` |
| Удалить проект | `DELETE /backend/project/{id}` | `_id_.96804a8b.js`, `wizard.731e771f.js` |
| Ручной съём позиций | `POST /backend/project/{id}/positions_job` (+ `GET …/positions_job/estimate`) | `manual-positions-capture.ee4a3f5e.js`, `_id_.96804a8b.js` |
| Добавить запросы | `POST /backend/project/{id}/keywords` (multipart `file` — CSV; шаблон `GET /backend/keywords/import_pattern`) | `_id_.96804a8b.js` |
| Вкл/выкл ключи, правки | `PATCH /backend/project/{id}/keywords` `{ids, field, value}` | `keywords_table.3c03573c.js` |
| Удалить запросы | `DELETE /backend/project/{id}/keywords` `{ids}` | `_id_.96804a8b.js` |
| Перенести в категорию | `PATCH /backend/project/{id}/keywords/category` `{ids, category}` | `keywords_table.3c03573c.js` |
| Лимиты категорий | `PATCH /backend/project/{id}/categories_limits` | `_id_.96804a8b.js` |
| Публичный отчёт | `POST /backend/project/{id}/public_report` `{from, to}` → `{token, project_id}` → `/externalreport/…` | `_id_.96804a8b.js` |
| Папки | `POST /backend/folders`, `PUT/DELETE /backend/folders/{id}`, `POST /backend/catalog_items/{id}/move` | `index.342909ee.js`, `wizard.731e771f.js` |
| Отдельный баланс проекта | `POST /backend/project/{id}/separate_balance/enable {amount, from_project_id}` / `…/disable` | `wizard.731e771f.js` |
| Уведомления/отчёты | `PATCH /backend/lk/user/notifications`, `PATCH /backend/lk/user/projects`, `PATCH /backend/notification_settings` | `profile.8df2b181.js`, `default.f72b53f9.js` |
| Ключи сторонних сервисов съёма | `PATCH /backend/lk/positions_settings` `{xmlstock_userid, xmlstock_apikey, rush_apikey, rush_concurrent, topvisor_apikey}` | `default.f72b53f9.js` |

Позиции для отчётов: `GET /backend/project/{id}/positions?from&to&checks_mode=one_per_day&provider&search&sort` — по каждому ключу массив `checks[]` (дата, провайдер, `position`, `pc_position`, `mobile_position`, `delta`, `found_url`, `errors_count`, `position_id`). Та же структура уже вложена в `keywords/v2` (`checks[]`), так что для отчётов достаточно `keywords/v2`, а `positions` — «широкая» выгрузка по диапазону.

История позиций: у остановленного проекта данные отдались за весь период жизни (2026-06-17 → 2026-07-13 при запросе с 2020 года) — API возвращает всё, что есть; глобальной глубины хранения в UI не заявлено (открытый вопрос №3).

## 5. Доменная модель

```
User 1─N Project (N─1 CatalogItem/item_id, N─1 Folder via parent_id)
Project 1─N Keyword ── category: 0..6 (конвейер продвижения)
Keyword 1─N Check (позиции per date × provider × device: position, pc_position, mobile_position, found_url)
Project 1─N Job (прогоны продвижения: started_at, finished_at, status, autolaunch_type, country, device)
Project 1─N PositionsJob (съёмы позиций: status, provider, manual_launch, device)
Project 1─1 AutolaunchSettings (автопилот: расписаний нет — только частоты в минутах и бюджет)
Project 1─N Tag; Keyword N─M Tag
Project 1─N Competitor → CompetitorSemantics
User 1─N Referal; Billing counters/graphs; Payments (cloudpayments/invoice/crypto); Tickets (поддержка)
SharedAccess (users-and-accesses: invite-link, can_create_projects, can_manage_balance, project_ids)
```

- **«Регион/город»** — целочисленный **Yandex geo id** (`project.region: 213` = Москва; в UI — «Город»). Список городов зашит в бандл статической картой (`regionsOptions`); геозависимость учитывается по этому id. Один проект = один регион; для нескольких городов заводят отдельные проекты (подтверждено структурой аккаунта: «очистка-газов.рф / РФ / Ереван / Бишкек…»).
- **Провайдеры съёма позиций** (значения `provider`): `topvisor`, `yaxml`, `yaxml_live`, `yaxml_demo`, `rush_analytics` + встроенный «Magic» в модалке создания. Ключи внешних сервисов (XMLStock/Topvisor/Rush) — в `lk/positions_settings`.
- **Расписаний (cron) у проекта нет**: автопилот описывается частотами `pos_check_freq_mins` / `click_freq_mins`, бюджетом, `target_pos`, `start_pos`, типом (обычный/адаптивный/PRO — `type: 3` у адаптивного) и `device` (2). «Даты концерта» придётся задавать снаружи: запуск/остановка через `POST|DELETE /project/{id}/job` и `autolaunch.active`.
- **Статусы**: проекта в UI — «Создан/Новый», «Активен», «Остановлен» (маппинг на `autolaunch.active` + наличие job в точности не подтверждён); `last_job.status: 2` (выполнен), `positions_job.status: 1` (в работе) — числовые enum'ы полностью не раскрыты (вопрос №2).
- **Категории ключей** (конвейер): 0 Основная кампания, 2 На тесте, 4 На оптимизацию, 6 Архив — подтверждены live (`categories_stat`); 1 Успешный тест, 3 В очереди, 5 Не продвинулось — по порядку в UI, id предполагаемые.
- **Позиции** хранятся по ключу и дню (`checks[].time` = 00:00 +03:00), с раздельными pc/mobile, провайдером, найденным URL; позиции >100 кодируются как `101`.
- Доля данных: `keyword.analyse` — релевантность страницы (title/h1/body пересечения), `last_found_url`, расходы в копейках и кликах за период/всего.

## 6. Официальный API / ключ

- Разделов «API», «Интеграции», «Токен», «Документация» в меню/настройках нет; в профиле только Личные данные / Уведомления / Отчёты. В базе знаний (`/api/strapi/kb/navigation?site=magic`, 50 статей) статьи про API нет.
- В JS-бандле нет `swagger`/`openapi`/генерации персональных токенов. Единственные «api_key» — ключи **сторонних** сервисов съёма позиций (topvisor/xmlstock/rush) в настройках профиля.
- Вывод: интеграция только через внутренний `lk.magicseo.ru/backend` API с JWT от логина-пароля. Владельцу имеет смысл уточнить у поддержки MagicSEO наличие закрытого API (вопрос №5).

## 7. Прочее

- Rate limits: в live-сессии не встречались (ни одного 429); у фронта поллинг 5–30 с. Серверные лимиты неизвестны (вопрос №1). Для позиций `retry: 0` — ручной съём не ретраится.
- Капчи нет; по телефону — flash-call (звонок + код), по email — 4-значный код.
- Совместный доступ: приглашение по ссылке (`lk/invite-link`), логин через `/login/shared_access` (invite_token).
- Админ-эндпоинты `/backend/admin/*` в бандле есть, для автоматизации не нужны и не использовались.

## Открытые вопросы

1. Серверные rate limits и вежливый интервал опроса (наблюдалось: фронт поллит `positions_job` ~30 с, таблицу ключей — по действию).
2. Точные числовые enum'ы статусов `job.status` / `positions_job.status` / проекта (наблюдения: job.status=2 после завершения, positions_job.status=1 в работе; полная таблица не раскрыта).
3. Глубина хранения истории позиций (архив отдаётся за всю жизнь проекта; есть ли ограничение по времени — неизвестно).
4. Добавление запросов текстом (не CSV): в бандле найден только импорт файлом `POST /keywords` (FormData) — возможно, есть текстовый режим в другом чанке; уточнить при первой интеграции.
5. Наличие у MagicSEO официального/закрытого API и ключей — спросить поддержку (`tickets/create`).
6. Семантика `ch` query-параметра (A/B-флаг, добавляется ко всем запросам, когда включён) — в API, похоже, игнорируется.
