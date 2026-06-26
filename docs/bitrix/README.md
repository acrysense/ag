# Внедрение таблиц и фильтров (для бэкенда / Bitrix)

Единый гайд: как прокинуть реальные данные в нашу таблицу (`DataTable`) и связать её
с фильтром в шапке (`HeaderSearch`). Учтены серверный режим, доставка конфига файлом
и AJAX-эндпоинт.

См. также готовый скелет эндпоинта: [`datatable-endpoint.php`](./datatable-endpoint.php).

---

## 1. Как это связано (общая схема)

Бэкенд отдаёт **конфиг таблицы** и (для фильтра) **поля фильтра с опциями**. Фронт строит UI.

```
[Bitrix]
  ├─ конфиг таблицы (columns + данные/эндпоинт) ─► <section data-module="DataTable"> ─► thead/строки/пагинация/сортировка
  └─ поля фильтра + опции ──────────────────────► HeaderSearch (шапка) ──applyFilters──► фильтрует те же данные
                                       ▲ связь по ключу: column.filterKey == field.data-filter-key
```

Таблица сама генерится из конфига (thead, tbody, контролы, футер, пагинация) — в разметке
страницы достаточно секции-хоста.

---

## 2. Два режима — выбираются по объёму данных

| Режим | Когда | Что отдаёт бэк | Пагинация/сортировка/фильтр |
|---|---|---|---|
| **client** (по умолчанию) | до ~неск. тысяч строк | весь набор в `rows` | считает фронт (мгновенно) |
| **server** (`"mode":"server"`) | десятки тысяч+ | `columns` + `endpoint` (без `rows`) | считает БД, фронт грузит срез страницы |

---

## 3. Доставка конфига — два способа

**А) Файлом/URL** (рекомендуется для Bitrix — не режется визуальным редактором/санитайзером):

```html
<section class="data-panel managers-table" data-data-table data-module="DataTable" data-path="components"
         data-table-src="/local/ajax/employees_config.php"></section>
```
По этому URL бэк отдаёт JSON-конфиг (см. ниже).

**Б) Инлайново** (только если секция выводится в шаблоне, а не в визуальном редакторе):

```html
<section class="data-panel managers-table" data-data-table data-module="DataTable" data-path="components">
  <script type="application/json" data-table-data>{ … конфиг … }</script>
</section>
```

> ⚠️ Инлайновый `<script type="application/json">` Bitrix может вырезать в «контентных»
> полях (детальный текст, HTML-свойства инфоблока, визуальный редактор → `CBXSanitizer`).
> Поэтому таблицу рендерим **в шаблоне** (`template.php`/`result_modifier.php`), либо отдаём
> конфиг способом **А (файлом)**.

---

## 4. Конфиг таблицы

### Клиентский режим (весь набор)
```json
{
  "table": "managers-table",
  "pageSize": 20,
  "pageSizes": [20, 50, 100],
  "columns": [ /* см. §6 */ ],
  "rows": [
    { "name":"Иванов И.И.", "url":"/employee?id=1", "region":"Минск", "category":"b", "index":"1,31", "trend":"up", "turnover":"134" }
  ]
}
```

### Серверный режим (срезы с эндпоинта)
```json
{
  "mode": "server",
  "endpoint": "/local/ajax/employees.php",
  "table": "managers-table",
  "pageSize": 20,
  "pageSizes": [20, 50, 100],
  "columns": [ /* см. §6, БЕЗ rows */ ]
}
```

---

## 5. Контракт эндпоинта (только для `mode:"server"`)

Фронт шлёт **GET** на `endpoint`:

| Параметр | Значение |
|---|---|
| `page` | номер страницы (с 1) |
| `pageSize` | размер страницы (`0` = все) |
| `sort` | ключ колонки (из `columns[].key`), если сортируют |
| `dir` | `asc` / `desc` |
| `q` | строка поиска (в нижнем регистре) |
| `filters` | URL-encoded **JSON-массив** активных фильтров |

Элементы `filters` (бэк транслирует в `WHERE`):
- select / мультивыбор — `{ "key":"region", "value":"Минск" }` (несколько с одним `key` = OR внутри ключа, AND между ключами);
- числовой диапазон — `{ "key":"index", "range":{ "from":"1", "to":"2" } }`;
- свободный список — `{ "key":"checks", "value":"...", "list":true }`;
- период/дата — `{ "key":"period", "range":{ "from":"01.05.2026", "to":"31.05.2026" } }`.

Пример:
```
GET /local/ajax/employees.php?page=3&pageSize=20&sort=turnover&dir=desc&q=иван&filters=%5B%7B%22key%22%3A%22region%22%2C%22value%22%3A%22Минск%22%7D%5D
```

Ответ (JSON):
```json
{ "rows": [ { "name":"Иванов И.И.", "url":"/employee?id=1", "region":"Минск", "category":"b", "index":"1,31", "trend":"up", "turnover":"134" } ],
  "total": 835 }
```
- `rows` — **только текущая страница**, ключи = `columns[].key`;
- `total` — число **всех** совпадений (для пагинации и «Всего: N»).

Готовая реализация (D7 ORM, с белыми списками и безопасностью): [`datatable-endpoint.php`](./datatable-endpoint.php).

---

## 6. Справочник колонок (`columns[]`)

| Поле | Назначение |
|---|---|
| `key` | имя поля в объекте строки |
| `label` | заголовок колонки (и подпись ячейки в моб. карточке) |
| `type` | `link` (+`hrefKey`) · `cat` (бейдж a/b/c/d) · `trend` (up/down) · `index` (+`trendKey`, цвет по тренду) · текст по умолчанию |
| `hrefKey` | для `type:"link"` — имя поля строки со ссылкой |
| `trendKey` | для `type:"index"` — имя поля с трендом (`up`/`down`) для цвета |
| `sort` | `text` / `number` / `date` → колонка сортируемая |
| `align` | `num` / `center` |
| `filterKey` | ключ для связи с полем фильтра в шапке |

Прочие поля конфига: `table` (класс ширин колонок: `managers-table`/`pharmacies-table`/…),
`pageSize`, `pageSizes`, `total` (необяз. — переопределить «Всего: N»).

> Числа/даты пишите как в вёрстке: `"1,31"`, `"1 234"`, `"10.05.2026"` — сортировка и
> диапазоны это понимают.

---

## 7. Фильтр в шапке (`HeaderSearch`)

Поля фильтра — отдельная разметка; бэк рендерит её с динамическими опциями. Тип задаётся атрибутом.

**Мультивыбор** (`data-multi`):
```html
<div class="filter-field" data-filter-key="region" data-multi>
  <button type="button" class="filter-field__trigger">
    <span class="filter-field__value" data-placeholder="Регион">Регион</span>
    <svg aria-hidden="true" width="16" height="16"><use href="#icon-caret"></use></svg>
  </button>
  <div class="filter-field__panel filter-field__panel--list">
    <input class="filter-field__search" type="text" placeholder="Найти" autocomplete="off"><!-- поиск по опциям, необяз. -->
    <div class="filter-field__options">
      <!-- ЦИКЛ по опциям -->
      <label class="filter-option">
        <input class="filter-option__input" type="checkbox" value="Минск" data-label="Минск">
        <span class="filter-option__box" aria-hidden="true"></span>
        <span>Минск</span>
      </label>
    </div>
  </div>
</div>
```

**Одиночный выбор** (без `data-multi`):
```html
<div class="filter-field" data-filter-key="region">
  <button type="button" class="filter-field__trigger">
    <span class="filter-field__value" data-placeholder="Область">Область</span>
    <svg aria-hidden="true" width="16" height="16"><use href="#icon-caret"></use></svg>
  </button>
  <div class="filter-field__panel">
    <button type="button" class="filter-option" data-value="Минск" data-label="Минск">Минская обл.</button>
  </div>
</div>
```

**Свободный ввод** (`data-input`):
```html
<div class="filter-field filter-field--inline" data-filter-key="checks" data-input>
  <input type="text" class="filter-field__input" data-filter-text placeholder="Кол-во чеков" autocomplete="off">
</div>
```

**Числовой диапазон** (`data-range`):
```html
<div class="filter-field filter-field--inline" data-filter-key="index" data-range>
  <div class="filter-range">
    <input type="text" class="filter-field__input" data-range-from placeholder="Индекс от" inputmode="decimal">
    <span class="filter-range__dash">–</span>
    <input type="text" class="filter-field__input" data-range-to placeholder="до" inputmode="decimal">
  </div>
</div>
```

**Период / дата** (`data-daterange` / `data-date`) — календарь строит JS, бэк задаёт только обёртку:
```html
<div class="filter-field" data-filter-key="period" data-daterange> … триггер … </div>
```

Поля кладутся в группу страницы внутри панели шапки: `<div data-page-fields="employees"> … </div>`.
Опции (`value`/`data-label`/текст) бэк формирует из своих справочников.

---

## 8. Связка фильтр ↔ таблица (главное правило)

Совпадение **по ключу**:
```
column.filterKey == filter-field.data-filter-key
```

Как применяется значение:
- **client-режим** — фильтр сверяется с **текстом ячейки** (значение опции должно быть
  подстрокой видимого текста: `value="ADEL"` ↔ ячейка «ADEL»). Диапазоны — числовое/датное
  сравнение значения ячейки.
- **server-режим** — массив фильтров уходит на `endpoint`, сопоставление делает **БД**.
  Значение опции должно соответствовать **значению в БД** (маппинг `key → поле` — в белом
  списке эндпоинта).

Сортировка во **всех** режимах — на стороне таблицы и берётся из `columns[].sort` (клик по
заголовку + моб. выпадашка «Сортировать по»). Фильтр сортировкой не управляет.

---

## 9. Поведение и нюансы

- **server-режим:** в DOM всегда ~`pageSize` строк; пагинация/сортировка/фильтр считаются
  в БД (масштабируется неограниченно).
- Живой ввод в поиске/фильтре **дебаунсится 300 мс** — на сервер уходит не каждый символ.
- На время запроса на секцию вешается класс `is-loading` (таблица притухает, клики
  блокируются). Устаревшие ответы игнорируются (защита от гонок).
- При смене фильтра/сортировки страница сбрасывается на 1-ю.
- В моб. режиме строки превращаются в карточки автоматически (подписи берутся из заголовков).

---

## 10. Чеклист бэка

1. Выбрать режим: **client** (весь набор) или **server** (срезы).
2. Отдать **конфиг** таблицы — файлом (`data-table-src`, рекомендуется) или инлайн `<script>` в шаблоне.
3. В `columns` проставить `filterKey` (фильтруемые) и `sort` (сортируемые).
4. Для **server**: поднять эндпоинт по контракту §5 (см. [`datatable-endpoint.php`](./datatable-endpoint.php)) — белый список колонок, маппинг `key → поле`, ответ `{rows,total}`.
5. Поля фильтра в шапке — нужного типа, с `data-filter-key` == `column.filterKey`, опции из справочников.
6. Проверить совпадение ключей и значений (см. §8).

Деплой фронта как обычно: `npm ci` → `npm run build -- --mode cms` → выложить `dist/assets` (+ `manifest.json`).
