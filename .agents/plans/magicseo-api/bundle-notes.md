# bundle-notes.md — где в JS-бандле найдены мутирующие вызовы

Фронтенд: Nuxt 3, чанки `https://lk.magicseo.ru/_nuxt/*.js`. Сканировались все 122–125 загруженных чанков (entry + lazy): регулярки `method:"POST|PUT|PATCH|DELETE"` с контекстом ±300 символов, плюс точечные выборки. API-клиент — `apiFetch.dbaa5cdb.js`:

```js
// apiFetch.dbaa5cdb.js (полностью, 1750 байт)
const q = async (c, t) => {
  ...
  const e = await p(c, { headers: { Authorization: "Bearer " + f() }, ... t });
  // f() читает localStorage.auth; 401 -> g() = logout
  // ответ нормализуется: {data: result, total, error}
}
```
`baseURL` берётся из runtime config; фактический префикс запросов — `/backend/` (видно в live-логе), пути в чанках записаны без префикса.

## Мутирующие вызовы по файлам

### index.342909ee.js (дашборд: CreateProjectModal, FolderModal)
- `POST /project` — создание проекта:
  `const F={name:t.name,domain:t.domain,region:t.region,provider:t.provider,device:…,new_keywords_url:t.new_keywords_url,send_report:t.send_report,dynamic_semantics_enabled:…,category_auto_main_campaign:t.category_auto_main_campaign,use_main_balance_for_testing:t.use_main_balance_for_testing}; a.initialParentFolderId!=null&&(F.parent_id=a.initialParentFolderId); const T=await ke("/project",{method:"POST",body:F});`
- `POST /folders` — `const x={name:g,parent_id:$.value??T.value,children_ids:y.length>0?y:null,target_id:null}, Y=await ke("/folders",{method:"POST",body:x});`
- `PUT /folders/{id}`, `DELETE /folders/{id}` — обновление/удаление папки (тот же body).

### wizard.731e771f.js (projects store)
- `DELETE /project/{id}` — `async function y1(e){const t=await b(\`/project/${e}\`,{method:"DELETE"})…}`
- `POST /project/{id}/job` — запуск: `async function w1(e){const t=await b(\`/project/${e}/job\`,{method:"POST"})…}`
- `DELETE /project/{id}/job` — остановка: `async function $1(e){const t=await b(\`/project/${e}/job\`,{method:"DELETE"})…}`
- `POST /project/{id}/autolaunch/reset_error`
- `PATCH /project/{id}` — `body:{region:t.region,name:t.name,domain:t.domain,provider:t.provider,new_keywords_url:t.new_keywords_url,send_report:t.send_report}`
- `POST /catalog_items/{id}/move` — `body:{parent_id:t??0,target_id:d?.targetSiblingId??null}`
- `POST /project/{id}/separate_balance/enable` — `body:{amount:t,from_project_id:d}`; `POST …/separate_balance/disable`
- `POST /balance/transfer` — `body:{…(e===null?{}:{to_project_id:e}),…(t===null?{}:{from_project_id:t}),amount:d}`

### _id_.96804a8b.js (страница проекта, 348 КБ)
- `POST /project/{id}/public_report` — `body:{to:T,from:C}` → `data:{token,project_id}`, URL `/externalreport/…`
- `DELETE /project/{id}/keywords` — `params:{search,type}, body:{ids}`
- `PATCH /project/{id}/categories_limits` — `body:{category_limit_main_campaign,…,category_limit_testing_percent,category_auto_main_campaign}`
- `PATCH /project/{id}` (update modal: Название проекта / Адрес сайта / Город (RegionSelect) / Сервис съема позиций)
- `PATCH /project/{id}/toggle_expert_mode`
- `POST /project/copy` — `body:{project_id, name, region}`
- `DELETE /project/{id}`
- `POST /project/{id}/job`, `DELETE /project/{id}/job`, `POST /project/{id}/autolaunch/reset_error`
- `POST /project/{id}/keywords` — CSV: `const k=new FormData;k.append("file",a.value); …{method:"POST",body:k}`
- `POST /project/{id}/keywords/url_analyse` (старт анализа), `POST …/url_analyse_last` `body:{ids}`
- competitor semantics: `POST ${…}/semantics/copy` (params), `POST|DELETE ${…}/semantics/tags` (body)

### keywords_table.3c03573c.js (таблица ключей, 52 КБ)
- `PATCH /project/{id}/keywords` — `params:{search,type}, body:{ids, field, value}` (field: 'enabled' и др.)
- `PATCH /project/{id}/keywords/category` — `body:{ids, category}`
- `PATCH /projects/use_main_balance_for_testing` — `body:{use_main_balance_for_testing, ids}`
- `PATCH /lk/user/keywords_table_settings` — `body:{disabled_static_columns, disabled_dynamic_columns}`
- `POST /notifications/{id}/read`
- `POST /project/{id}/tags` `body:{name}`; `PATCH|DELETE /project/{id}/tags/{id}`
- `GET /project/{id}/keywords/all_ids`, `GET …/categories_stat?search`, `GET …/url_analyse_last`, `GET /project/{id}/notifications`, `GET /projects/{id}/per_query/status`

### ExpenseBreakdown.52c9960c.js (биллинг/интеграции/автопилот)
- `PATCH /project/{id}/autolaunch` — `body:Ae({active:o})` и полное сохранение: `…use_recommendations=…, click_target_pos=…, use_brand_click=…; s = e.defaultMode ? "/default_autolaunch" : \`/project/${e.projectId}/autolaunch\`; me(s,{method:"PATCH",body:Ae(v)})`
- `GET /yandex/metrica/counters?domain=`, `GET /yandex/webmaster/sites?domain=`
- `POST /yandex/integrations` `body:{domain, resource_id, service}`; `DELETE /yandex/integrations/{id}`
- `POST /projects/{id}/yandex/import` `body:{period, service}`; `POST /yandex/data-hub/token`

### manual-positions-capture.ee4a3f5e.js
- `POST /project/{id}/positions_job` — `{method:"POST",retry:0}` → `data.status`
- админские: `POST /admin/{uid}/projects_demo_balance`, `POST /admin/{uid}/manual_positions_capture`, `GET /admin/{uid}/projects_demo_balance`

### useExportPositionsReport.1707a589.js (выгрузка позиций)
- `GET /project/{id}/positions` — `params:{sort, search, provider, checks_mode, from, to}` → JSON для Excel-экспорта

### default.f72b53f9.js (глобальный стор/профиль/оплата/поддержка)
- `POST /payments/invoices` — `body:{amount, comment:"Оп…", inn, ogrName, contract}`
- `POST /payments/crypto` — `body:{amount}`; `GET /payments/crypto/{id}`
- CloudPayments: `POST payments/cloudpayments/start` — `body:{amount:…, c…}` (контекст обрезан)
- `POST /referals/payouts` — `body:{amount (копейки), type:"click…"}`
- `POST /tariff/1500`
- `PATCH /lk/positions_settings` — `body:{…xmlstock_userid+"|"+xmlstock_apikey, rush_apikey+"|"+rush_concurrent, topvisor_apikey}` (сборка тела по полям формы)
- `PATCH /notification_settings`
- `POST /wizard/progress` — `body:{wizard_name,…}`
- `POST /messages/{id}/dismiss`
- `POST /tickets/create` (attachments `{name: base64}`), `PUT /tickets/message`
- `POST /lk/email/send_code` `body:{email, from}`; `POST /lk/email/confirm` `body:{email, code}`
- `POST /audit-fix/submit`

### profile.8df2b181.js
- `PATCH /lk/user/notifications` (body = объект настроек), `PATCH /lk/user/projects` (body: id, send_report, send_daily, send_weekly)

### PhoneLoginForm.e46654e2.js / CodeVerification.6107a769.js (телефонный вход)
- `POST /lk/phone/request-call` / `POST /request-call` — `body:{phone|phone_number, from:"wizard"}`
- `POST /login/phone` — `body:{phone_number, code}`; варианты shared_access: `POST /login/shared_access`, `POST /flash_call/request_call`, `POST /flash_call/check_and_login`, `POST /flash_call/check_and_login/shared_access`, `POST /lk/phone/verify-call`, `POST /lk/phone/flash_call/verify-call`

### price.ff391703.js (тарифы)
- `POST /fixed_tariff` (создать), `PATCH /fixed_tariff/{id}`, `DELETE /fixed_tariff/{id}` — админские; пользовательские `GET /fixed_tariff`, `POST /fixed_tariff/pay`

### entry.8b370e30.js (entry, 351 КБ)
- `POST /admin/login` (loginAsUser — админская функция), `POST /users-and-accesses/add`, `POST /support/create`
- роуты приложения: `/profile`, `/billing`, `/users-and-accesses`, `/referral`, `/offer`, `/help/patchnotes`, `/invite`, `/login?token=…`, `/externalreport/`, `/admin/*` и др.

## Наблюдения
- Endpoint-строки в чанках хранятся **без** префикса `/backend` — поэтому поиск по `backend/` ничего не даёт; фактический префикс добавляет `apiFetch` (runtime config).
- Все вызовы идут через один враппер (`ke`/`We`/`ae`/`me`/`S` — один и тот же `apiFetch`), поэтому `method:"…"` — надёжный маркер мутаций.
- Регион-селектор: статическая карта городов→Yandex geo id в бандле (`regionsOptions` строится из `Object.keys(Ie)`); дефолт `region: 213` (Москва).
- Провайдеры позиций (consts.f2eef8e3.js): `topvisor, yaxml, yaxml_live, yaxml_demo, rush_analytics`.
