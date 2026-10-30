# Progress — bb-plugin-magicseo

## Now
- Library layer only so far: repo holds the `lib/**` foundation of the future BB plugin (no `server.ts`/UI yet — that is wave 2, task T3).
- MagicSEO cabinet client (`lib/magicseo/`): JWT login with token reuse and one re-login on 401, typed reads (projects, catalog, autolaunch, keywords, positions, balance, folders) on documented endpoints, every mutation logged once via `onMutation`; payment/transfer/project-delete/admin endpoints deliberately not implemented.
- Verified promotion lifecycle (`lib/magicseo/lifecycle.ts`): start/stop drive the autolaunch switch (`PATCH active` + `DELETE /job`), confirmed by `GET autolaunch`, up to 3 stop attempts then `StopFailedError`.
- Site rules config (`lib/config.ts`): validated `SiteConfig`/`Config` with defaults for atmosphere-show.ru — `dry-run` mode, 48 h stop window, keyword templates; live mode requires explicit config.
- Site data sources: read-only WordPress concerts fetch (`lib/concerts/wordpress.ts`, meta-mapped city/date/local time/sold-out/postponed) and city map (`lib/cities/`: 152 cities → Yandex region, 143 mapped, 9 ambiguous → null unless overridden, IANA timezone, `concertStartUtc`).

## Blocked
- none

## Next
- [ ] Wave 2 (phase ph_f16b2b8b06): T3 plugin server + UI (Env Catalog login, site → city-project tree, manual Start/Stop/Check, EN/RU) and T4 rules engine (per-city plan, keyword CSV, dry-run executor)
- [ ] PM acceptance steps: public GitHub VKirill/magicseo + `gitnexus analyze`, install on the hub, REGISTRY/journal entries

## Last verify
- command: node --test "tests/**/*.test.ts"
- result: green (24 pass, 0 fail)
- when: 2026-10-30

## Pointers
- Open todos: none (.agents/todos/ does not exist yet)
- Plans: .agents/plans/items/T1.4/PLAN.md (done), .agents/plans/items/T2.5/PLAN.md (done); phase map .agents/phases/ph_f16b2b8b06/PLAN.md
- Changelog: .agents/CHANGELOG.md
