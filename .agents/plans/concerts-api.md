# atmosphere-show.ru concerts API (probed 2026-10-30)

WordPress REST + JetEngine meta, probed read-only.

- List: `GET https://atmosphere-show.ru/wp-json/wp/v2/concerts?per_page=100&page=N` (X-WP-Total / X-WP-TotalPages; 138 total).
- Published concerts are public (meta exposed, no auth). Drafts / `status=any` / `context=edit` need Basic auth from Env Catalog `ATMOSPHERE_WP_APP` (WordPress administrator — service must only read).
- Cities: taxonomy `gorod-kontserta` (`/wp-json/wp/v2/gorod-kontserta?per_page=100`); `status-kontserta` has one term 51 «Sold out»; also `programma-kontserta`, `skidka-na-bilety`.

Key fields: `id`, `status` (publish|draft), `link` (concert URL), `title.raw` («Воткинск — 31 января 2027 — 19:00»), `modified_gmt`,
`meta.gorod`, `meta.v_gorode`, `meta.data_kontserta` (YYYY-MM-DD), `meta.vremia_kontserta` (HH:MM, city local time, no tz stored),
`meta.mesto_provedeniia`, `meta.adres_provedeniia`, `meta.ssylka_na_bilety`, `meta.sold_out`, `meta.perenos_kontserta` (new URL),
`meta.novaya_data_kontserta`, `meta.sleduyushchiy_kontsert`, `meta.atm_remaining`, `meta.atm_stock_state`.

Observations: 99 published (all future; past ones go to draft), 39 drafts; 68 cities upcoming, 24 cities with 2–5 concerts.
The 48h stop rule needs a city→timezone map. Postponement and sold-out need rules.
