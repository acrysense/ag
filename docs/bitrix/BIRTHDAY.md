# День рождения: салют

В свой день рождения сотрудник при открытии «Моей страницы» видит салют: конфетти от фото и шары
снизу. Пример — `dist/profile-birthday.html`, шаблон — `components/Celebration`.

В блоке профиля, между строкой с ФИО (`.profile__topping`) и строками «должность / аптека / телефон»
(`.profile__info`), — невидимый блок:

```html
<div class="celebration profile__celebration" hidden data-module="Celebration" data-path="components"
  data-celebration-key="ID сотрудника" data-celebration-origin=".profile__img"></div>
```

- Выводить только в день рождения — тем же сотрудникам и по той же дате, что и в блоке «День
  рождения» на сайте; в остальные дни блока нет.
- `data-celebration-key` — постоянный ID сотрудника: салют сам показывается один раз в день.
- Если страница кэшируется, признак «сегодня день рождения» считать вне кэша.
- Запасной вид — видимая метка «С днём рождения!» под ФИО (нажатие повторяет салют): вместо блока —
  кнопка `button.celebration.celebration--badge.profile__celebration` из `Celebration.hbs` (`badge`).
- Кнопка «Салют (тест)» на демо-странице — только для показа, в шаблон не входит.
