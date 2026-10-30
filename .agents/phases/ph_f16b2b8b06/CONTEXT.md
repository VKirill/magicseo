# Context — MagicSEO API service, BB plugin and concert automation

Phase `ph_f16b2b8b06`. Rewritten 2026-10-30 after the recon errand (thr_emb8s7ejz8) and the owner's answers; supersedes the first draft written before recon.

## Problem

The owner runs SEO behavioural-factors promotion for concert brands in MagicSEO (lk.magicseo.ru), one MagicSEO project per city. Starting and stopping city projects around concert dates is manual. He wants:

1. our own API client over the MagicSEO cabinet;
2. a BB plugin that shows the hierarchy *client site → MagicSEO city projects* with state, spend and positions, and lets him control them by hand;
3. automation: city projects start and stop by concerts on the client site, first for atmosphere-show.ru, then for other sites of the same kind by configuration;
4. position reports per site, city and keyword.

## Evidence

- MagicSEO recon: `.bb/chats/thr_tus6ykzucc/artifacts/recon/api-map.md`, `endpoints.json` (118 endpoints: ~35 live, ~83 from the JS bundle), `bundle-notes.md`, `samples/`, `screenshots/`.
- Concerts API probe: `.agents/plans/concerts-api.md`.

## Facts (verified 2026-10-30)

**MagicSEO**
- No official API or API key. The integration is the cabinet's internal API under `https://lk.magicseo.ru/backend/*`.
- Auth: `POST /backend/login {username, password}` → `result.token` (JWT HS256, ~7 days). Every call sends `Authorization: Bearer <jwt>`. No cookies, CSRF, refresh endpoint, 2FA or captcha seen. Re-login on 401 or expiry. No websockets; the front polls 5–30 s.
- A MagicSEO **project = one domain + one region** (integer Yandex geo id, 213 = Moscow). Projects live in folders (`/backend/folders`, `/backend/catalog_items/{id}/move`). There are no tasks inside a project and no dates or schedules on a project.
- Lifecycle: create `POST /backend/project {name, domain, region, provider, device, ...}`; copy `POST /backend/project/copy {project_id, name, region}`; start promotion `POST /backend/project/{id}/job`; stop `DELETE /backend/project/{id}/job`; autopilot `PATCH /backend/project/{id}/autolaunch {active, click_freq_mins, pos_check_freq_mins, target_pos, budget, ...}`; keywords only as CSV multipart `POST /backend/project/{id}/keywords`.
- Positions: `GET /backend/project/{id}/positions?from&to&checks_mode=one_per_day`, `GET /backend/project/{id}/keywords/v2` (pc/mobile position per check, found_url, >100 reported as 101); manual check `POST /backend/project/{id}/positions_job`.
- Account today: 61 projects, none for atmosphere-show.ru. Sister brands already follow one-project-per-city: «ПРО АРТ [Город]» (proart-show.ru, 7), «[Город] MUSESHOW.RU» (museshow.ru, 16).

**atmosphere-show.ru**
- WordPress, post type `concerts`: `GET https://atmosphere-show.ru/wp-json/wp/v2/concerts?per_page=100&page=N`. Published concerts are public with meta; drafts need Basic auth `ATMOSPHERE_WP_APP` (an administrator account: read only).
- Fields: `status`, `link`, `meta.gorod`, `meta.v_gorode`, `meta.data_kontserta`, `meta.vremia_kontserta` (city local time, no timezone stored), `meta.sold_out`, `meta.perenos_kontserta` / `meta.novaya_data_kontserta` (postponement), taxonomy `gorod-kontserta`.
- 99 published concerts (all future), 39 drafts, 68 cities upcoming, 24 cities with 2–5 concerts.

## Decisions

### Locked

| Id | Decision | Why |
| --- | --- | --- |
| D1 | Owner's «task per city» = **one MagicSEO project per (site, city)**; the plugin hierarchy is site → city projects → keywords/positions. | MagicSEO has no tasks inside a project; a project is bound to one region; existing brands already work this way. |
| D2 | **Start** a city project when a concert with `status=publish` and a `link` exists in that city and its start is more than 48 h away; **create** the city project if the site has none for that city. | Owner, 2026-10-30. |
| D3 | **Stop** the city project when 48 h remain before the start of the nearest concert in that city, computed in the city's timezone. If another published concert in that city is still more than 48 h away after this one has passed, start again. | Owner: «когда до концерта начала остается 48 часов, задачу можно стопать». Multi-concert reading is the PM's working assumption, told to the owner. |
| D4 | Balance is not a start/stop criterion. | Owner, 2026-10-30. |
| D5 | Rules are per client site configuration (domain, concerts source, naming template, project template, timezone map); a second concert site is added by config. | Owner: «потом ещё такой же тематики будет сайт». |
| D6 | Read-only towards atmosphere-show.ru; MagicSEO mutations only via the documented endpoints, each logged. | The WP account is administrator; MagicSEO spends money. |
| D7 | Credentials come from Env Catalog only (`MAGICSEO_LOGIN`, `ATMOSPHERE_WP_APP`), never in files or git. | Project rules. |
| D8 | Keywords of a new city project are generated from the site's keyword templates with placeholders: `%город%` = `meta.gorod` (e.g. «оркестр при свечах %город%» → «оркестр при свечах Воткинск», «3000 свечей %город%»; the list is per site and editable in the plugin settings); `%в_городе%` = `meta.v_gorode` is also supported. The list is uploaded as CSV to `POST /backend/project/{id}/keywords`. | Owner, 2026-10-30: «ключи сделаем шаблонным вариантом … оркестр при свечах %город%». |

### Free (writer/PM decides)

- Stack and storage of the service (default: TypeScript service + SQLite on the Mac mini, BB plugin UI on the Pokecut kit).
- Polling intervals for concerts and positions.
- Dry-run mode before the first live run (recommended: the first automation run prints the plan without calling start/stop/create).

### Deferred (ask before that wave)

- Promotion settings for new projects (provider, device, autopilot budget/target position).
- Postponed and sold-out concerts: stop early on sold-out or keep running.
- Report format and recipients.

## Risks

- **value:** positions may lag a day; history depth unknown (served for the whole project life, no stated limit).
- **usability:** city names differ between the site and MagicSEO titles (СПб / Санкт-Петербург); an alias table and region-id mapping are needed.
- **feasibility:** internal API may change without notice (Nuxt v2.9.1, backend live-2.0.177); rate limits unknown.
- **viability:** a failed stop call or expired token could keep paid promotion running after the 48 h point: stops must retry, verify state and alert.
- **security:** the MagicSEO password appeared in plaintext in the original goal text; rotate it.

## Appetite

4 waves over 1–2 weeks: (1) MagicSEO client; (2) concerts sync and city/region/timezone mapping; (3) automation rules with dry-run and lifecycle log; (4) position harvesting, reports and the BB plugin UI.

## No-gos

- No balance top-ups or payments.
- No scraping beyond MagicSEO and the concert sites.
- No captcha bypass; alert the owner if a challenge appears.
- No writes to atmosphere-show.ru.
- No plaintext secrets in source or git.

## FAQ

- *Does recon cover POST requests?* Yes: GETs observed live, mutations taken from the JS bundle without pressing buttons (money and live projects). One controlled reversible check (stop/start on one project) may be done later with the owner's yes.
