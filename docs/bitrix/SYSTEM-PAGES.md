# Системные страницы

404, «Нет данных для отображения» и ошибка 1С. Шаблон — `app/components/sections/error/NotFound/`,
пример разметки — `dist/404.html`, `dist/error.html`, `dist/sync-error.html`.

Текущая разметка работает без правок: новый вид применяется к ней сам. Если меняете шаблон —
так, как ниже (классы те же, что на сайте).

```html
<section class="not-found" aria-labelledby="not-found-title">
  <span class="not-found__decor" aria-hidden="true">404</span>
  <div class="not-found__wrapper">
    <h1 class="not-found__title" id="not-found-title">Страница не найдена</h1>
    <p class="not-found__description">Возможно, страница устарела или изменился её адрес.</p>
    <a class="btn btn--general btn--m not-found__btn" href="/">На главную</a>
  </div>
</section>
```

- «Нет данных»: код `NO DATA`, свой заголовок и текст.
- Ошибка 1С: код `1С ERROR`, у `section` класс `not-found--wide` (карточка шире), заголовка нет —
  `h1` с классом `visually-hidden` «Ошибка 1С», текст ошибки — в `.not-found__description`.
- 404 отдавать с кодом ответа 404 (`CHTTP::SetStatus("404 Not Found")`).
