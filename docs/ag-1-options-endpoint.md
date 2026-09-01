# AG-1 · Эндпоинт-справочник для ленивой загрузки опций

Цель: перестать вшивать в HTML тысячи `<option>` (селект сотрудника в модалке визита ~2280,
фильтры ~1161). Фронт грузит опции по AJAX при открытии поля, с серверным поиском и пагинацией.
Это убирает вес страницы (~1 МБ), основную часть 6–14 c серверной генерации и утечку ПДн в HTML.

## Что делает бэк

Один эндпоинт-справочник. Предлагаемый адрес: `GET /ajax/options.php`.

### Параметры запроса
| Параметр | Тип | Обяз. | Описание |
|----------|-----|-------|----------|
| `type` | string | да | Справочник: `employee` \| `pharmacy` \| `manager` \| `company`. Валидировать по белому списку. |
| `q` | string | нет | Поисковая строка. Пусто = первая страница всего списка. Поиск по названию/ФИО. |
| `page` | int | нет | Номер страницы, с 1. По умолчанию 1. |
| `size` | int | нет | Размер страницы. По умолчанию 50. Ограничить сверху (например ≤ 100). |
| `manager` | string | нет | Для `type=employee`: код менеджера — вернуть только его сотрудников (см. связь ниже). |

### Ответ (200, `application/json; charset=utf-8`)
```json
{
  "items": [
    { "value": "98b81383-544e-11ef-bbc6-005056011102", "label": "Андриевская О. Е." }
  ],
  "total": 2280,
  "page": 1,
  "size": 50,
  "hasMore": true
}
```
- `items` — массив `{ value, label }`. `value` — код (UUID), `label` — то, что видит пользователь.
- `total` — общее число записей под текущим `q`/`type`/`manager` (для счётчика и понимания, что есть ещё).
- `hasMore` — есть ли следующая страница (можно вычислять как `page * size < total`).

### Требования
1. **Скоуп по роли — на сервере.** Эндпоинт обязан отдавать только то, что доступно текущему
   пользователю по его роли (обычный менеджер — свой круг, руководитель — шире). Это одновременно
   закрывает AG-3: перестаём вшивать всех в HTML.
2. **Только подготовленные выражения / ORM.** `q` уходит в запрос только параметризованно (AG-12).
   `page`/`size` привести к `int`, `type`/`manager` — по белому списку.
3. **Кеш справочников** (список меняется редко) — чтобы запрос был быстрым.
4. **Стабильная сортировка** (по алфавиту), одинаковая между страницами, иначе пагинация «поедет».

### Связь менеджер → сотрудники
Сейчас в HTML отдаётся `window.AG_VISIT_EMPLOYEES_BY_MANAGER` (карта на 542 человека). После внедрения
она не нужна: фронт при выборе менеджера в модалке запросит
`/ajax/options.php?type=employee&manager=<код>` и получит только его сотрудников. Карту из HTML убрать.

## Что делает фронт (наша часть, уже в работе)
- `ui-select` (селект сотрудника/менеджера в модалке) и фильтр-поля переводятся на ленивую загрузку:
  опции грузятся при открытии поля, поиск шлёт `q` на сервер (с debounce), догрузка следующих страниц
  по скроллу. Включается атрибутом `data-options-src="/ajax/options.php?type=employee"` на поле —
  без него компонент работает по-старому на инлайн-опциях (миграция страниц по одной).
- Пустой `<select>`/фильтр в HTML: бэку достаточно вывести оболочку поля без `<option>`/`<label>` внутри
  и повесить `data-options-src`. Образцы разметки — ниже.

## Разметка полей (ленивый режим) — готово на фронте

Фронт-часть уже реализована и протестирована: и селект модалки, и мультиселект-фильтры. Бэку нужно
вывести оболочки полей БЕЗ опций внутри и повесить `data-options-src`.

**Фильтр (мультиселект):**
```html
<div class="filter-field" data-filter-key="employee" data-multi
     data-options-src="/ajax/options.php?type=employee">
  <button type="button" class="filter-field__trigger">
    <span class="filter-field__value" data-placeholder="Сотрудник">Сотрудник</span>
    <svg aria-hidden="true" width="16" height="16"><use href="#icon-caret"></use></svg>
  </button>
  <div class="filter-field__panel filter-field__panel--list"></div>
</div>
```
Панель пустая — JS сам вставит поиск и зоны (выбранные сверху + подгружаемый пул). Опционально
`data-options-depends="manager"` — тогда список сотрудников фильтруется по выбранному в фильтре менеджеру.

**Селект модалки визита (одиночный):**
```html
<div class="field__control ui-select" data-select data-select-search
     data-options-src="/ajax/options.php?type=employee">
  <button type="button" class="ui-select__trigger" data-select-trigger aria-haspopup="listbox">
    <span class="ui-select__value" data-select-value data-placeholder="Выбрать">Выбрать</span>
    <svg ...><use href="#icon-caret"></use></svg>
  </button>
  <div class="ui-select__panel ui-select__panel--scroll" data-select-panel role="listbox">
    <div class="ui-select__search">
      <input class="ui-select__search-input" data-select-search-input placeholder="Поиск" autocomplete="off">
    </div>
    <div class="ui-select__msg" data-select-loading hidden>Загрузка…</div>
    <div class="ui-select__msg" data-select-error hidden>Ошибка загрузки</div>
    <p class="ui-select__empty" data-select-empty hidden>Ничего не найдено</p>
    <div data-select-options></div>          <!-- сюда JS грузит опции -->
  </div>
  <input type="hidden" name="employee" value="" data-select-input data-required>
</div>
```
Ключевое: `data-options-src` на поле, пустой `data-select-options` внутри, и никаких инлайновых опций.
Для связи «сотрудник ← менеджер» на селекте сотрудника добавить `data-options-depends="manager"`.

## Порядок внедрения
1. Бэк поднимает `/ajax/options.php` по этому контракту (можно начать с `type=employee`).
2. Фронт включает ленивый режим на селекте модалки → проверяем на визитах.
3. Далее — фильтры (employee/pharmacy/manager/company) и остальные страницы.
4. Убираем инлайн-списки и `AG_VISIT_EMPLOYEES_BY_MANAGER` из HTML → вес и время падают.
