# MagicSEO (BB-плагин)

Назначение: экран BB-плагина «сайт → проекты городов» для продвижения в MagicSEO
(lk.magicseo.ru): состояние каждого проекта города, ключи, расход за период и
всего, позиции по ключам и ручной запуск/остановка продвижения. Один проект
MagicSEO = один домен + один регион (город).
Владелец работы: Lane Pilot task T3.3 (phase ph_f16b2b8b06).
Статус: experimental.
Проверено: 2026-10-30; модульные тесты (`node --test`), типчек и `bb plugin build`
проверены локально; живой вызов lk.magicseo.ru не выполнялся (запрещён контрактом).

| Поле | Значение |
|---|---|
| Host | BB desktop 0.48.x |
| Канонические исходники | этот репозиторий (worktree), ветка main после приёмки |
| Публичный GitHub | после приёмки (шаг PM, вне задачи) |
| GitNexus | не индексирован (шаг PM, вне задачи) |
| Установка | `npm install && npm run build`, затем установка собранного плагина в BB |
| Данные | KV плагина: `config` (настройки сайтов), `mutation-log` (последние 500 записей о мутациях MagicSEO) |
| Зависимости | плагин BB `env-catalog` (логин `MAGICSEO_LOGIN` через RPC `env_get_value`), аккаунт lk.magicseo.ru |

## Работа

- Вход (Env Catalog): кабинет MagicSEO читается только через Env Catalog по
  имени `MAGICSEO_LOGIN` (тип login: access.username / access.password).
  Значение нигде не сохраняется: ни в KV, ни в файлах, ни в логах, ни в UI
  (D7). Если пароля в access нет, плагин сообщает об ошибке, называя имя
  переменной, но не логин.
- Вкладка «Проекты»: баланс аккаунта в ₽ (`balance().money_balance` копеек /
  100), сайты (`buildHierarchy` над `catalog_items`), в каждом — проекты
  городов: состояние (`autolaunch_settings.active`), ключей
  (`keywords.keywords_count`), расход ₽ за период и всего
  (`period_money_spent` / `total_money_spent` копеек / 100), раскрытие списка
  ключей с последними позициями ПК/мобильных и найденным URL
  (`keywords/v2`). Кнопки «Запустить/Остановить»
  (`startPromotion`/`stopPromotion`) и «Снять позиции»
  (`POST /backend/project/{id}/positions_job`).
- Каждая мутация клиента пишется в KV `mutation-log` (не более 500 записей,
  только method/path/status/ok/at); RPC `mutation_log` возвращает журнал (D6).
- RPC: `tree`, `project_keywords`, `project_start`, `project_stop`,
  `positions_check`, `mutation_log`, `config`, `save_config`. Контракты
  автоматизации (T5) и позиций (T6) подключаются расширением в `server.ts`.
- Интерфейс: английский по умолчанию, русский при
  `document.documentElement.lang`, начинающемся с `ru`
  (`i18n/hierarchy.ts`); стиль Pokecut, классы `ms-*`, только токены
  `--pk-*` с запасными токенами BB, без hex-цветов (docs/DESIGN.md).

Проверки:

```bash
node --test tests/credentials.test.ts   # Env Catalog RPC, ошибка без пароля не выдаёт логин
node --test tests/hierarchy.test.ts     # дерево сайтов/городов, деньги из копеек
node --test tests/log-store.test.ts     # журнал мутаций ограничен 500 записями < 256 KiB
npm run typecheck                        # tsc --noEmit
npm run build                            # bb plugin build
```

Восстановление прежнего состояния: плагин только читает кабинет и по явному
нажатию кнопок запускает/останавливает продвижение или съём позиций; «стоп»
повторяется до трёх раз (`stopPromotion`), каждая попытка остаётся в журнале
мутаций.

## Результаты и следующий шаг

- Проверки: см. блок выше; приёмка задачи T3.3 (контракт `.agents/plans/items/T3.3/`).
- Следующий шаг: T4/T5 — правила автоматизации «концерт → старт/стоп проекта
  города» (сначала atmosphere-show.ru), T6 — история позиций и отчёты.
