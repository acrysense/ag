# Внедрение вёрстки — полная инструкция для бэкенда (Bitrix)

Это сквозной гайд: прочитайте сверху вниз. Детали по каждому пункту — в отдельных
файлах (ссылки по ходу). Карта всех файлов — в конце.

## Как это устроено (общая модель)

Фронт собран через Vite. Все динамические блоки — **таблицы, задачи, календарь визитов** —
строятся на фронте из **JSON, который отдаёт ваш PHP**. Плюс есть механизмы **сохранения
действий** (AJAX) и **тостов** (уведомлений).

Порядок внедрения:
1. Собрать фронт и выложить в шаблон.
2. На нужные секции повесить `data-*`-атрибуты со ссылками на ваши PHP.
3. PHP отдаёт JSON (списки) и принимает POST (действия).

> Пока URL не задан — блок работает в демо-режиме на встроенных данных, ничего не ломается.

---

## 1. Сборка и выкладка (сначала это)

```bash
nvm use 22                                            # нужен Node 22 (не 16)
BASE=/bitrix/templates/auth/ npm run build -- --mode cms
```
Выложить **содержимое `dist/`** в корень шаблона `/bitrix/templates/auth/`
(вместе с `manifest.json`, `assets/`, `favicon/`, `fonts/`).

- **`BASE` обязателен** — иначе шрифты и ленивые скрипты грузятся от корня и ловят 404.
  Проверка собранного: `grep -o '/[^"]*fonts/Inter/Inter-Var.woff2' dist/assets/css/app-*.css`
  → должно быть `/bitrix/templates/auth/fonts/...`.
- Подключение CSS/JS — через **[`assets.php`](assets.php)** (вход ищется по `name === 'app'`,
  `$dir = SITE_TEMPLATE_PATH`). Замените им ваш старый assets.php.

Подробно и с чек-листом: **[UPDATE.md](UPDATE.md)**.

---

## 2. Общие правила для всех PHP-эндпоинтов

- Отдавать заголовок `Content-Type: application/json; charset=utf-8`.
- Путь к эндпоинту — **без HTTP-авторизации** (иначе браузер не заберёт данные).
- Для локальной проверки фронта без бэка есть фикстуры в `public/data/`
  (`employees.example.json`, `tasks.example.json`, `visits.example.json`) — их можно
  подставлять прямо в `data-*-src`.

---

## 3. Таблицы (Сотрудники / Аптеки / Менеджеры; План-факт и История визитов)

На секцию таблицы вешаем `data-table-src` — ссылку на PHP, который отдаёт JSON
`{columns, rows}`. `<thead>/<tbody>` руками писать не нужно.

```html
<section class="data-panel employees-table"
         data-data-table data-module="DataTable" data-path="components"
         data-table-src="/local/ajax/employees.php"></section>
```

JSON:
```jsonc
{
  "columns": [ { "key","label","type"?,"sort"?,"align"?,"filterKey"?,"hrefKey"? } ],
  "rows":    [ { "<key>": "<value>", ... } ],
  "pageSize": 20, "pageSizes": [20,50,100], "total": 835
}
```
Типы ячеек: без `type` — текст; `"link"` (адрес в поле `hrefKey`); `"cat"` — бейдж
категории `a/b/c/d`. Фильтр в шапке связывается по `filterKey` ↔ ключ поля фильтра.

- Заголовок панели + кнопка «Экспорт в Excel» — кладутся руками внутрь секции.
- Пустой `rows: []` → авто-заглушка «Нет данных».

**Детали, контракт колонок, экспорт, серверный режим для больших таблиц:**
**[TABLES.md](TABLES.md)** + PHP-пример **[datatable-config.php](datatable-config.php)**
(серверный режим — [datatable-endpoint.php](datatable-endpoint.php); фильтр в шапке — [README.md](README.md)).

---

## 4. Задачи

### 4.1. Список задач
Секция панели задач с `data-tasks-src`:
```html
<section class="tasks-panel" data-module="TasksPanel" data-path="components"
         data-tasks-src="/local/ajax/tasks.php"> … </section>
```
JSON: `{ "tasks": [ { id, title, assignee, due, hidden?, desc?, done?, awaitingConfirm?,
completedBy?, completedDate?, verifiedBy?, verifiedDate? } ] }`.
Состояния: активна / скрыта / выполнена-ждёт-подтверждения / выполнена / проверена.
Пустой `{tasks:[]}` → «Нет доступных задач».

### 4.2. Сохранение действий (AJAX)
Любое изменение задачи (**статус, комментарий, редактирование, создание, удаление**)
уходит POST-ом на ваш PHP. **Request-first**: изменение применяется в интерфейсе
**только после успешного ответа**; при ошибке — тост и откат.
```html
<section class="tasks-panel" data-module="TasksPanel" data-path="components"
         data-tasks-src="/local/ajax/tasks.php"
         data-tasks-action-url="/local/ajax/tasks-action.php"> … </section>
```
POST `{ "action": "...", ... }`:

| `action` | поля | ответ успех |
|----------|------|-------------|
| `status` | `id, done` | `{ok:true}` |
| `comment`| `id, comment` | `{ok:true}` |
| `update` | `id, title, assignee, due, hidden` | `{ok:true}` |
| `create` | `title, assignee, due, hidden` | `{ok:true, id:<новый>}` |
| `delete` | `id` | `{ok:true}` |

Ошибка — не-2xx статус или `{ok:false, error:"…"}`. Без `data-tasks-action-url` —
демо-режим (применяется сразу, без запросов).

**Детали + PHP-примеры:** **[TASKS.md](TASKS.md)**, [tasks-config.php](tasks-config.php)
(список), [tasks-action.php](tasks-action.php) (действия).

---

## 5. Визиты

Раздел из трёх частей:
- **План визитов (календарь)** — `data-visits-src` со списком визитов JSON:
  ```html
  <div class="vcal" data-module="VisitsCalendar" data-path="components"
       data-anchor="2026-05-01" data-visits-src="/local/ajax/visits.php"></div>
  ```
  JSON: `{ "visits": [ { date, time, name, cat, pharmacy, manager?, status?, … } ] }`
  (мин. за видимый месяц). Контракт визита — в [VISITS.md](VISITS.md), PHP — [visits-config.php](visits-config.php).
- **План-факт** и **История визитов** — это обычные таблицы (см. п.3), `data-table-src`.

> Сохранение действий календаря (создание/изменение визита) сделаем по аналогии с
> задачами, когда понадобится.

---

## 6. Тосты (уведомления)

Контейнер уже на каждой странице. Показать тост можно серверной разметкой — вывести
где угодно на странице:
```html
<div data-toast data-type="error" data-title="Ошибка" data-text="Не удалось сохранить"></div>
```
`data-type`: `success` | `error`. Или из JS: `window.toast.success('…')` / `.error('…')`.
Детали: **[TOASTS.md](TOASTS.md)**.

---

## 7. Пустые состояния

Встроены, отдельно верстать не нужно:
- таблица с `rows: []` → «Нет данных»; фильтр ничего не нашёл → «Ничего не найдено»;
- задачи `{tasks:[]}` → «Нет доступных задач»;
- визиты без событий в месяце → пустые ячейки календаря.

---

## Итоговый чек-лист

- [ ] собрано с `BASE=/bitrix/templates/auth/`, `dist` в корне шаблона, `assets.php` актуальный;
- [ ] таблицы: `data-table-src` → `{columns, rows}`;
- [ ] задачи: `data-tasks-src` → `{tasks:[…]}` + `data-tasks-action-url` для сохранения действий;
- [ ] визиты: календарь `data-visits-src` → `{visits:[…]}`; план-факт/история — как таблицы;
- [ ] все PHP: `application/json`, без HTTP-авторизации;
- [ ] у задач/визитов есть `id` (чтобы действия ссылались на запись).

## Карта файлов (docs/bitrix)

| файл | о чём |
|------|-------|
| **GUIDE.md** | этот сквозной гайд (начните отсюда) |
| UPDATE.md | сборка с BASE, выкладка dist, чек-лист |
| assets.php | подключение CSS/JS по манифесту (исправленный) |
| TABLES.md · datatable-config.php · datatable-endpoint.php · README.md | таблицы (JSON, серверный режим, фильтр в шапке) |
| TASKS.md · tasks-config.php · tasks-action.php | задачи (список + сохранение действий) |
| VISITS.md · visits-config.php | визиты (календарь) |
| TOASTS.md | тосты |
