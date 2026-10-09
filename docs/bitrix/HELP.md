# Помощь

Главная Помощи, страница раздела и блок «Вопросы по странице» в разделах CRM. Шаблоны —
`app/components/sections/help/`, пример разметки — `dist/help.html`, `dist/help-section.html`,
`dist/tasks.html`.

## Страницы

Внутри `wrapper__main`:

```html
<div class="wrapper__wide">
  <div class="help-page">
    <!-- крошки (components/Breadcrumbs, class="help-page__crumbs") -->

    <!-- главная: HelpHero, HelpCategories, затем -->
    <div class="help-page__row">
      <!-- HelpFaq -->
      <div class="help-page__side"><!-- HelpUpdates, HelpSupport --></div>
    </div>

    <!-- раздел: -->
    <div class="help-page__layout">
      <!-- HelpNav -->
      <div class="help-page__main"><!-- HelpSection, HelpFaq --></div>
    </div>
  </div>
</div>
```

## Поля

Все тексты и ссылки — из админки. Пустой список — блок не выводится.

- **HelpHero** — заголовок, описание, «Часто ищут» (текст + ссылка на результаты поиска в шапке).
- **HelpCategories** — разделы: иконка (имя из спрайта: `erp-tasks`, `site-home`…), название,
  «N статей», описание, до 3 статей, ссылка на раздел.
- **HelpFaq** — вопрос, ответ (текст), ссылка на статью; `open` — раскрыт при загрузке.
- **HelpUpdates** — дата, название, ссылка.
- **HelpSupport** — текст, кнопка (ссылка), телефон.
- **HelpNav** — разделы (название, ссылка). У текущего раздела: класс `is-open` и список его статей,
  текущая статья — `aria-current="page"`. Статьи других разделов не выводить.
- **HelpSection** — заголовок (`h1`), «N статей», описание, статьи (название, пояснение, ссылка).

## Вопросы по странице

Блок `HelpInline` на странице раздела CRM. Поля: заголовок, подпись, вопросы (как у HelpFaq), ссылки «Все статьи» и
«Написать в поддержку».

На странице задач — после вкладок, у обёртки добавить класс `wrapper__narrow--aside`:

```html
<div class="wrapper__narrow wrapper__narrow--aside">
  <!-- вкладки задач, как сейчас -->
  <section class="help-inline" aria-labelledby="help-tasks-title">…</section>
</div>
```

## Меню

Пункт «Помощь» в группе CRM бокового и мобильного меню, иконка `#icon-site-help`.
