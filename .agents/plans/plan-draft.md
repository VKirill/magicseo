# PM plan draft for ph_f16b2b8b06 (input for the planning stage)

Repo: this folder is now a git repo (main). No package.json yet. Template plugin to copy: ../bb-plugin-repo-pulse (package.json "bb" {server, app}, tsconfig, vitest, bb.storage.kv, bb.background.schedule, env-catalog RPC via bb.sdk.plugins.callRpc).
Checks: `npx --no-install tsc --noEmit` + `npx --no-install vitest run tests/<file>` (cwd "."); first task runs `npm install` when node_modules is missing.

| Wave | Piece | Owns | Depends |
| --- | --- | --- | --- |
| 1 | ms-client — scaffold + typed MagicSEO client (login JWT, Bearer, 1 re-login on 401, methods from endpoints.json, no delete/payment methods, onMutation audit hook, creds from Env Catalog MAGICSEO_LOGIN) | package.json, tsconfig, vitest.config, server.ts, lib/magicseo/, tests/magicseo-client.test.ts | — |
| 2 | concerts-geo — WP concerts source (paging, publish only, Basic auth only for drafts) + city→regionId/IANA tz table from .agents/plans/atmosphere-cities.json + magicseo-regions.json; ambiguous/unmapped never guessed | lib/concerts/, lib/geo/, tests | ms-client |
| 2 | sites-config — SiteConfig (domain, naming «АТМОСФЕРА [%город%]», keywordTemplates «оркестр при свечах %город%», «3000 свечей %город%», %в_городе%, stopHoursBefore 48, skipSoldOut, ignorePostponed, cityOverrides, dryRun true), keyword CSV, project matching by domain+region, kv store | lib/sites/, tests | ms-client |
| 3 | automation — pure planner (D2/D3: run while a published concert is >48h away, stop at 48h, restart for the next concert; create missing city project + keywords + start), executor with dry-run, stop verify + 3 retries, action log, 15-min background tick, agent tools | lib/automation/, server.ts, tests | concerts-geo, sites-config |
| 3 | positions — harvest daily positions (read-only), store, report per city/keyword, CSV | lib/positions/, tests | sites-config |
| 4 | ui-tree — app.tsx: site → city projects (state, spend, next concert, avg pos, top10), keyword positions, manual start/stop, CSV; RPC in server.ts; daily harvest schedule; en+ru i18n; Pokecut | app.tsx, app.css, i18n.ts, components/, server.ts, package.json, tests | automation, positions |
| 5 | ui-settings — site settings (templates with preview, city overrides, dry-run with confirmation), automation plan preview and log, add a second site by config | components/, app.tsx, i18n.ts, server.ts, tests | ui-tree |

Key test cases for the planner: 49h → start; 47h → stop; two concerts in a city (30h and 10 days) → stop now, start again after the first has started; Воткинск 2027-01-31 19:00 Europe/Samara = 15:00Z.
