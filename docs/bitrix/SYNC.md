# Обмен с 1С

Страница статусов обменов с 1С. Шаблоны — `app/components/sections/sync/`, пример разметки —
`dist/sync.html`. Пункт «Обмен с 1С» — в группе CRM бокового и мобильного меню, иконка
`#icon-site-sync`.

## Страница

Внутри `wrapper__main`:

```html
<div class="wrapper__wide">
  <div class="sync-page">
    <!-- крошки (components/Breadcrumbs) -->
    <!-- SyncHero: h1 и описание -->
    <div class="sync-board">
      <section class="sync-board__group" aria-label="Аптеки"><!-- карточки SyncCard --></section>
      <section class="sync-board__group" aria-label="Сотрудники">…</section>
      <section class="sync-board__group" aria-label="Показатели">…</section>
    </div>
  </div>
</div>
```

Группа — колонка на компьютере; на телефоне все карточки идут одним списком в порядке групп.
Пустую группу не выводить.

## Карточка

Разметка — `SyncCard.hbs`. Главное:

- `article.sync-card.sync-card--{state}` с `id` (постоянный, уникальный), `data-state`,
  `data-run-href`, `data-status-href`, `data-started`.
- `state`: `running` — выполняется, `queue` — в очереди, `success`, `never` — не запускался,
  `error`. Статус в шапке — `.sync-status.sync-status--{state}`.
- Раскрыта при загрузке — `open` у `details`. Разумно раскрывать выполняющиеся и с ошибкой.
- Строки без значения не выводить (нет логов — нет строк «Лог …», нет счётчиков — нет блока).
- Нет права на ручной запуск — не выводить `.sync-card__run` и `data-run-href`.
- Поле периода (`select`) — только у обменов, где период нужен.
- Сообщение под кнопкой — `.sync-card__message--success` или `--error`, ссылка на лог —
  `.sync-card__link`.
- У выполняющегося в `data-started` — время начала (ISO 8601 с часовым поясом), от него идёт
  таймер. Без него таймер считает с открытия страницы.
- Подсказка «?» — скрипт, описание, ссылка на документацию; нет описания — нет кнопки.

## Запросы

Оба отвечают JSON.

- **Запуск** — `POST` на `data-run-href`: `sessid` и значение поля периода (по его `name`).
  Ответ `{ "status": "running" | "queue", "startedAt": "…" }`; отказ — код 4xx/5xx или другой
  `status` и `{ "message": "текст для пользователя" }`.
- **Статус** — `GET` на `data-status-href`, раз в 5 секунд, пока обмен идёт:
  `{ "status": "running" | "queue" | "success" | "error" }`.

Когда статус перестал быть `running`/`queue`, скрипт заново запрашивает текущую страницу и
заменяет карточку по `id`: итог обмена (дата, счётчики, сообщение) выводит шаблон, отдельный
ответ с ними не нужен.

`data-run-method="get"` — только для демо со статичными JSON, на сервере не ставить.
