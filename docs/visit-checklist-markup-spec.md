# Чек-лист визита — спека разметки для фронта

Что `detail.php` должен отрендерить, чтобы наш JS собрал ответы и отправил
`save`/`submit`. POST-контракт уже согласован (`ajax/visit-checklist.php`):

```jsonc
{ "action": "save"|"submit", "visitId": 123, "resultComment": "…",
  "answers": [
    { "templateId": 45, "type": "qual",  "answer": "Да"|"Нет", "comment": "" },
    { "templateId": 61, "type": "quant", "qualityScore": 4, "buyersCount": 6, "recsCount": 5, "comment": "" }
  ] }
```

JS собирает `answers` из DOM по хукам ниже. Пункты без ответа (нет активного
Да/Нет; нет qualityScore) в `answers` не попадают — это норм для опциональных `*`.

## 1. Корень (уже есть) + эндпоинт

```html
<section class="data-panel visit"
         data-checklist-root
         data-visit-id="14777"
         data-checklist-url="/ajax/visit-checklist.php">   <!-- ДОБАВИТЬ: URL эндпоинта -->
```
(или глобалка `window.AG_VISIT_CHECKLIST_URL` — как удобнее).

## 2. Качественный пункт (уже есть — добавить состояние ответа и комментарий)

```html
<li class="visit-q__item"
    data-template-id="14780" data-type="qual" data-optional="0"
    data-comment="сохранённый комментарий или пусто">      <!-- ДОБАВИТЬ: комментарий пункта -->
  <div class="visit-q__toggle">
    <!-- ДОБАВИТЬ is-active на выбранный ответ (если пункт уже отвечен) -->
    <button type="button" class="visit-q__yn visit-q__yn--yes is-active" data-yn="yes">Да</button>
    <button type="button" class="visit-q__yn visit-q__yn--no" data-yn="no">Нет</button>
  </div>
  <div class="visit-q__body">…критерий + описание…</div>
  <!-- меню «Комментировать» можно оставить как есть -->
</li>
```
- Ответ JS читает по `is-active` на `.visit-q__yn` (`--yes` → `"Да"`, `--no` → `"Нет"`).
- Комментарий — из `data-comment` на `<li>` (редактор его же и обновляет).

## 3. Количественная строка (сейчас НЕ рендерится — нужна)

Та же структура `.visit-quant__row`, но с хуками:

```html
<div class="visit-quant__row"
     data-template-id="14791" data-type="quant" data-optional="0"
     data-comment="">
  <div class="visit-quant__td visit-quant__td--idx">1.</div>
  <div class="visit-quant__td visit-quant__td--crit"><span class="visit-quant__crit">Критерий…</span></div>
  <div class="visit-quant__td visit-quant__td--num" data-label="Качество (Балы, 1-5)">
    <input class="visit-quant__input" data-quant-field="quality" type="text" inputmode="numeric" value="4"></div>
  <div class="visit-quant__td visit-quant__td--num" data-label="Покупателей">
    <input class="visit-quant__input" data-quant-field="buyers" type="text" inputmode="numeric" value="6"></div>
  <div class="visit-quant__td visit-quant__td--num" data-label="Рекомендации">
    <input class="visit-quant__input" data-quant-field="recs" type="text" inputmode="numeric" value="5"></div>
  <div class="visit-quant__td visit-quant__td--pct" data-label="%">83</div>   <!-- вычисляется на фронте -->
  <!-- меню «Комментировать» как есть -->
</div>
```
- `qualityScore` ← `[data-quant-field="quality"]`, `buyersCount` ← `buyers`, `recsCount` ← `recs`.
- `%` фронт считает сам (`recs/buyers*100`) — свойство слать не надо.
- Пустой `data-quant-field="quality"` (без балла) → пункт в `answers` не попадает.

Главное: у количественных **не должно быть** действий «Редактировать/Удалить»
критерий — каталог правится только в админке. Оставляем только «Комментировать».

## 4. Кнопки сохранения + вывод по сотруднику (нужны)

Где-то в корне чек-листа:

```html
<textarea data-checklist-result-comment placeholder="Вывод по сотруднику">…</textarea>
<button type="button" data-checklist-save>Сохранить черновик</button>
<button type="button" data-checklist-submit>Отправить</button>
```
- `data-checklist-save` → POST `action:"save"`, `data-checklist-submit` → `action:"submit"`.
- `resultComment` ← значение `[data-checklist-result-comment]`.

## Итог: что добавить бэку в detail.php
1. `data-checklist-url` (или глобалка) на корне.
2. `is-active` на выбранный Да/Нет + `data-comment` на каждый `.visit-q__item`.
3. Рендер количественных строк с `data-template-id`, `data-type="quant"`,
   тремя `data-quant-field` и `data-comment` (и починить типы 16/9 в каталоге).
4. `textarea[data-checklist-result-comment]` + кнопки `data-checklist-save` /
   `data-checklist-submit`.

Как отрендерят по этой спеке — вешаю JS сбора и отправки сразу, без переделок.
