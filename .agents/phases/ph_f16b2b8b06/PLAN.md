# Plan — MagicSEO plugin (phase ph_f16b2b8b06)

Contracts: [plan.json](plan.json) (task-v2, 6 tasks, 3 waves).

| Wave | Task | What | Covers |
| --- | --- | --- | --- |
| 1 | T1 | MagicSEO client: JWT login, documented endpoints, logged mutations, start/stop with verify and retry | D6, D7 |
| 1 | T2 | Site rules config, read-only WordPress concerts source, city → Yandex region + IANA timezone | D5, D6 |
| 2 | T3 | Plugin server, Env Catalog login, site → city-project tree with state/spend/positions, manual Start/Stop/Check (EN/RU) | D1, D6, D7 |
| 2 | T4 | Rules engine: per-city plan create/start/stop at 48 h, keyword templates, dry-run executor | D1–D4, D6, D8 |
| 3 | T5 | Automation schedule, lifecycle log, site rules editor, preview, Live switch with confirm (EN/RU) | D2, D3, D5, D6, D8 |
| 3 | T6 | Position harvesting on schedule, reports per site/city/keyword, CSV export (EN/RU) | D1 |

## Free decisions taken

- The "API service" is the plugin server itself (TypeScript), storage is BB plugin KV, not SQLite: no native dependency, nothing new to run.
- `lib/**` has no npm dependencies, tests run with `node --test` (Node type stripping), so wave 1 runs without `npm install`.
- Start = `PATCH autolaunch {active:true}`; stop = `PATCH autolaunch {active:false}` + `DELETE /job`, verified by `GET autolaunch`, 3 attempts, then an alert. Working assumption from the recon (api-map §5); first live use only after the owner's yes.
- New site defaults to mode `dry-run`; live needs a confirm in the UI.
- Intervals: automation every 30 min, positions every 6 h, 1 s pause between projects (rate limits unknown).
- Published concerts are public: `ATMOSPHERE_WP_APP` (administrator) is not used by default (`credentialName: null`).

## Left out

- Deferred: promotion settings of new projects (live create is `blocked` until the owner fills `site.newProject`), sold-out/postponement rules, report recipients and delivery.
- No-gos: payments, balance transfer, project delete, admin endpoints.
- PM steps after acceptance: install on the hub, public GitHub `VKirill/magicseo` + `gitnexus analyze`, REGISTRY/journal entries, rotation of the MagicSEO password (SECURITY.md).

## Open points for the owner

- Confirm that "start/stop" means the autopilot switch (autolaunch.active) and not one-off runs (`POST /job`).
- Confirm that `total_money_spent` / `period_money_spent` (kopecks, from catalog_items) are the spend to show; `total_spent` / `period_spent` look like click counts.

## Revision after the plan critic (2026-10-30)

- T1: `stopPromotion` treats 404/body error from `DELETE /job` as non-fatal when `GET autolaunch` shows `active:false`; reads `catalog_items.txt` and `magicseo-api/shapes.md`.
- T2: city → region from the committed `.agents/plans/atmosphere-cities.json` + `magicseo-regions.json`, no bundle download; 9 ambiguous/unmapped cities resolve to null unless `regionOverrides` names them.
- T3: reads CONTEXT.md, api-map.md, catalog sample; spend in ₽ from `period_money_spent`/`total_money_spent`; `total_spent` is clicks.
- T4: no live fetch; keyword CSV = one keyword per line, no header (confirmed in the owner-approved live check).
- T5/T6: KV ≤ 256 KiB per key: lifecycle log max 200 entries without keyword arrays, positions split per project and month; scheduling via `bb.background.schedule`.
