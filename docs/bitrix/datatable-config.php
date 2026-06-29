<?php
/**
 * ============================================================================
 *  ПРИМЕР ОТДАЧИ ДАННЫХ ДЛЯ ТАБЛИЦЫ (вариант "весь набор одним JSON").
 * ============================================================================
 *
 *  ИДЕЯ ПРОСТАЯ И ОДНА:
 *    - этот файл отдаёт ОДИН JSON со ВСЕМИ строками таблицы;
 *    - фронт сам делает сортировку, фильтрацию и пагинацию в браузере;
 *    - никаких "режимов", постранично ничего догружать не нужно.
 *
 *  Подходит для таблиц примерно до нескольких тысяч строк (сотрудники,
 *  аптеки, менеджеры). Это ровно наш случай.
 *
 *  КАК ПОДКЛЮЧИТЬ НА СТРАНИЦЕ (в шаблоне Bitrix):
 *    <section class="data-panel employees-table"
 *             data-data-table data-module="DataTable" data-path="components"
 *             data-table-src="/local/ajax/employees.php"></section>
 *    Фронт сам сходит по этому URL, заберёт JSON и построит таблицу.
 *
 *  Положить файл можно куда удобно (например /local/ajax/employees.php),
 *  главное чтобы он был доступен по URL, который указан в data-table-src,
 *  и отдавал 200 + JSON (без HTTP-авторизации на этом пути).
 *
 *  Формат ответа (контракт):
 *    {
 *      "columns": [ { "key", "label", "type"?, "sort"?, "align"?,
 *                     "filterKey"?, "hrefKey"? }, ... ],
 *      "rows":    [ { <key>: <value>, ... }, ... ],
 *      "pageSize": 20,
 *      "pageSizes": [20, 50, 100],
 *      "total": 2000
 *    }
 *  Подробное описание полей — в TABLES.md.
 * ----------------------------------------------------------------------------
 */

// Если нужен Bitrix-контекст (D7 ORM, CIBlock и т.п.) — подключите пролог:
// require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/prolog_before.php');

header('Content-Type: application/json; charset=utf-8');

/* ----------------------------------------------------------------------------
 * 1) ОПИСАНИЕ КОЛОНОК. Порядок здесь = порядок колонок в таблице.
 *
 *    key       — имя поля в каждой строке rows (по нему берётся значение)
 *    label     — заголовок колонки (и подпись в мобильных карточках)
 *    type      — как рисовать ячейку:
 *                  "link" — ссылка (текст = key, адрес = поле hrefKey)
 *                  "cat"  — бейдж категории; значение "a"|"b"|"c"|"d"
 *                           (регистр любой, буква покажется заглавной)
 *                  (без type) — обычный текст
 *    sort      — делает колонку сортируемой: "text" | "number" | "date"
 *    align     — "num" (число, вправо) | "center" | (без — влево)
 *    filterKey — связывает колонку с фильтром из шапки сайта (см. TABLES.md)
 *    hrefKey   — для type:"link": имя поля со ссылкой
 * -------------------------------------------------------------------------- */
$columns = [
    ['key' => 'employee',    'label' => 'Сотрудник',                  'type' => 'link', 'hrefKey' => 'employeeHref', 'sort' => 'text',   'filterKey' => 'employee'],
    ['key' => 'category',    'label' => 'Кат.',                       'type' => 'cat',  'align' => 'center',          'filterKey' => 'category'],
    ['key' => 'index',       'label' => 'Индекс',                     'align' => 'num', 'sort' => 'number'],
    ['key' => 'checks',      'label' => 'Количество чеков',           'align' => 'num', 'sort' => 'number'],
    ['key' => 'avg',         'label' => 'Ср. чек',                    'align' => 'num', 'sort' => 'number'],
    ['key' => 'stm',         'label' => 'Доля СТМ',                   'align' => 'num', 'sort' => 'number'],
    ['key' => 'fill',        'label' => 'Наполняемость чека',         'align' => 'num', 'sort' => 'number'],
    ['key' => 'rank',        'label' => 'Доля товаров 4-6 ранга',     'align' => 'num', 'sort' => 'number'],
    ['key' => 'penetration', 'label' => 'Пенетрация карт лояльности', 'align' => 'num', 'sort' => 'number'],
    ['key' => 'region',      'label' => 'Регион',                     'filterKey' => 'region'],
    ['key' => 'brand',       'label' => 'Бренд',                      'filterKey' => 'brand'],
    ['key' => 'pharmacy',    'label' => 'Аптека',                     'type' => 'link', 'hrefKey' => 'pharmacyHref', 'sort' => 'text', 'filterKey' => 'pharmacy'],
    ['key' => 'months',      'label' => 'Мес. в кат.',                'align' => 'num'],
];

/* ----------------------------------------------------------------------------
 * 2) СТРОКИ. Здесь надо отдать ВСЕ записи (без LIMIT/постранички).
 *
 *    Каждая строка — ассоциативный массив, ключи совпадают с column.key.
 *    Для колонок type:"link" добавляем поле со ссылкой (hrefKey).
 *
 *    Ниже — заглушка-пример. Замените на реальную выборку из вашего
 *    источника. Примеры реальных выборок:
 *
 *    --- D7 ORM ---------------------------------------------------------
 *    use Bitrix\Main\Loader;
 *    Loader::includeModule('iblock');
 *    $res = \Bitrix\Iblock\Elements\ElementEmployeesTable::getList([
 *        'select' => ['ID', 'NAME', 'CATEGORY_' => 'CATEGORY', ...],
 *        'order'  => ['NAME' => 'ASC'],
 *    ]);
 *    while ($el = $res->fetch()) { $rows[] = mapRow($el); }
 *
 *    --- CIBlockElement -------------------------------------------------
 *    $res = CIBlockElement::GetList(['NAME' => 'ASC'], ['IBLOCK_ID' => 7],
 *           false, false, ['ID','NAME','PROPERTY_CATEGORY', ...]);
 *    while ($el = $res->GetNextElement()) {
 *        $f = $el->GetFields(); $p = $el->GetProperties();
 *        $rows[] = [ 'employee' => $f['NAME'], 'employeeHref' => '/employee?id='.$f['ID'], ... ];
 *    }
 * -------------------------------------------------------------------------- */
$rows = [];

// --- ЗАГЛУШКА (удалить, когда подключите реальную выборку) ---
$demoNames   = ['Василевская М.В.', 'Ковш Т.А.', 'Зайцева Д.М.', 'Иванов М.С.'];
$demoRegions = ['Минск', 'Витебская обл.', 'Гомельская обл.'];
$demoBrands  = ['ADEL', 'Добрыя лекі', 'Эконом'];
$demoCats    = ['a', 'b', 'c', 'd'];
for ($i = 1; $i <= 2000; $i++) {
    $brand = $demoBrands[$i % count($demoBrands)];
    $rows[] = [
        'employee'     => $demoNames[$i % count($demoNames)],
        'employeeHref' => '/employee?id=' . $i,        // ссылка для type:"link"
        'category'     => $demoCats[$i % count($demoCats)],
        'index'        => number_format(1 + ($i % 400) / 100, 2, ',', ''),
        'checks'       => 100 + ($i * 7) % 900,
        'avg'          => 120 + ($i * 3) % 80,
        'stm'          => 10 + ($i % 40),
        'fill'         => 2 + ($i % 6),
        'rank'         => 5 + ($i % 30),
        'penetration'  => 20 + ($i % 60),
        'region'       => $demoRegions[$i % count($demoRegions)],
        'brand'        => $brand,
        'pharmacy'     => $brand . ' №' . ($i % 50 + 1),
        'pharmacyHref' => '/pharmacy?id=' . $i,
        'months'       => 1 + ($i % 18),
    ];
}
// --- /ЗАГЛУШКА ---

/* ----------------------------------------------------------------------------
 * 3) ОТВЕТ. Отдаём конфиг целиком. Всё — остальное делает фронт.
 *    pageSize / pageSizes — размер страницы по умолчанию и варианты в селекте.
 *    total можно не считать отдельно — это просто count($rows).
 * -------------------------------------------------------------------------- */
echo json_encode([
    'columns'   => $columns,
    'rows'      => $rows,
    'pageSize'  => 20,
    'pageSizes' => [20, 50, 100],
    'total'     => count($rows),
], JSON_UNESCAPED_UNICODE);
