<?php
/**
 * ============================================================================
 *  СКЕЛЕТ AJAX-ЭНДПОИНТА ДЛЯ СЕРВЕРНОГО РЕЖИМА DataTable (mode: "server")
 * ============================================================================
 *
 *  Куда класть: например /local/ajax/employees.php  (адрес → config.endpoint)
 *
 *  Что приходит из фронта (GET):
 *    page      — номер страницы (с 1)
 *    pageSize  — размер страницы (0 = «все», но мы ограничиваем сверху)
 *    sort      — ключ колонки для сортировки (из columns[].key)
 *    dir       — asc | desc
 *    q         — строка поиска (уже в нижнем регистре)
 *    filters   — URL-encoded JSON-массив активных фильтров, элементы:
 *                  { "key":"region", "value":"Минск" }                 // select / мультивыбор
 *                  { "key":"index",  "range": { "from":"1","to":"2" } } // числовой/датный диапазон
 *                  { "key":"checks", "value":"...", "list":true }       // свободный список
 *
 *  Что вернуть (JSON):
 *    { "rows": [ { ...поля по columns[].key... } ], "total": <всего совпадений> }
 *      rows  — ТОЛЬКО текущая страница
 *      total — общее число совпадений (для пагинации и «Всего: N»)
 *
 *  БЕЗОПАСНОСТЬ: имена полей для сортировки/фильтра берём ТОЛЬКО из白-списка
 *  $COLUMNS. Значения уходят через ORM как параметры (экранируются Bitrix-ом).
 *  Никогда не подставляйте ключ/поле из запроса напрямую в ORDER BY / WHERE.
 * ============================================================================
 */

// --- 1. Ядро Bitrix (только ядро, без пролога шаблона) ----------------------
define('STOP_STATISTICS', true);
define('NO_KEEP_STATISTIC', true);
require $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/prolog_before.php';

use Bitrix\Main\Loader;
use Bitrix\Main\Web\Json;
use Bitrix\Main\Type\Date;

header('Content-Type: application/json; charset=utf-8');

// --- 2. Источник данных (пример — D7 ORM DataManager) -----------------------
// Loader::includeModule('vendor.module');
// $dataClass = \Vendor\Module\EmployeeTable::class;
//
// Подойдёт любой DataManager: кастомная таблица, HL-блок
//   (HighloadBlockTable::compileEntity($hlblock)->getDataClass()),
//   или замените блок запроса на CIBlockElement::GetList (см. примечание внизу).
$dataClass = \Vendor\Module\EmployeeTable::class;

// --- 3. БЕЛЫЙ СПИСОК колонок: ключ из фронта → поле в БД ---------------------
//    sortable   — можно ли по ней сортировать
//    searchable — участвует ли в общем поиске q
//    type       — string | number | date (для нормализации значений диапазонов)
$COLUMNS = [
	'employee' => ['field' => 'NAME',     'sortable' => true,  'searchable' => true,  'type' => 'string'],
	'region'   => ['field' => 'REGION',   'sortable' => true,  'searchable' => true,  'type' => 'string'],
	'category' => ['field' => 'CATEGORY', 'sortable' => true,  'searchable' => false, 'type' => 'string'],
	'index'    => ['field' => 'IDX',      'sortable' => true,  'searchable' => false, 'type' => 'number'],
	'turnover' => ['field' => 'TURNOVER', 'sortable' => true,  'searchable' => false, 'type' => 'number'],
];

// --- 4. Чтение и валидация входных параметров -------------------------------
$page     = max(1, (int) ($_GET['page'] ?? 1));
$pageSize = (int) ($_GET['pageSize'] ?? 20);
$pageSize = ($pageSize <= 0) ? 100 : min($pageSize, 100); // защита: не отдаём «всё» без предела
$q        = trim((string) ($_GET['q'] ?? ''));
$sortKey  = (string) ($_GET['sort'] ?? '');
$dir      = (strtoupper((string) ($_GET['dir'] ?? '')) === 'DESC') ? 'DESC' : 'ASC';

$filters = [];
if (!empty($_GET['filters'])) {
	$decoded = json_decode((string) $_GET['filters'], true);
	if (is_array($decoded)) {
		$filters = $decoded;
	}
}

// --- 5. Сортировка — только по разрешённой колонке --------------------------
$order = ['ID' => 'ASC']; // стабильный дефолт
if ($sortKey !== '' && !empty($COLUMNS[$sortKey]['sortable'])) {
	$order = [$COLUMNS[$sortKey]['field'] => $dir];
}

// --- 6. Сборка фильтра ORM (массивный фильтр getList) -----------------------
$ormFilter = [];

// 6a. Поиск q → LIKE %q% по всем searchable-полям (OR между полями)
if ($q !== '') {
	$search = ['LOGIC' => 'OR'];
	foreach ($COLUMNS as $col) {
		if (!empty($col['searchable'])) {
			$search[] = ['%' . $col['field'] => $q]; // префикс % = LIKE %значение%
		}
	}
	if (count($search) > 1) {
		$ormFilter[] = $search;
	}
}

// 6b. Активные фильтры: группируем по ключу → OR внутри ключа, AND между ключами
$byKey = [];
foreach ($filters as $f) {
	$key = $f['key'] ?? null;
	if ($key === null || !isset($COLUMNS[$key])) {
		continue; // игнорируем неизвестные/неразрешённые ключи
	}
	$byKey[$key][] = $f;
}

foreach ($byKey as $key => $items) {
	$field = $COLUMNS[$key]['field'];
	$type  = $COLUMNS[$key]['type'];
	$group = ['LOGIC' => 'OR']; // несколько значений одного фильтра = OR

	foreach ($items as $f) {
		if (isset($f['range'])) {
			// Числовой / датный диапазон: >= from AND <= to
			$from = (string) ($f['range']['from'] ?? '');
			$to   = (string) ($f['range']['to'] ?? '');
			$cond = [];
			if ($from !== '') {
				$cond['>=' . $field] = normalizeValue($from, $type);
			}
			if ($to !== '') {
				$cond['<=' . $field] = normalizeValue($to, $type);
			}
			if ($cond) {
				$group[] = $cond;
			}
		} elseif (!empty($f['list'])) {
			// Свободный список через запятую/пробел → каждое значение как LIKE
			foreach (preg_split('/[,\s]+/u', (string) ($f['value'] ?? '')) as $v) {
				if ($v !== '') {
					$group[] = ['%' . $field => $v];
				}
			}
		} else {
			// Обычный select / мультивыбор: точное совпадение.
			// Нужно «содержит» — замените на ['%' . $field => $f['value']].
			$group[] = [$field => (string) ($f['value'] ?? '')];
		}
	}

	if (count($group) > 1) {
		$ormFilter[] = $group;
	}
}

// --- 7. Запрос: total + срез текущей страницы -------------------------------
$selectFields = array_values(array_unique(array_merge(
	['ID'],
	array_column($COLUMNS, 'field')
)));

$total = (int) $dataClass::getCount($ormFilter);

$result = $dataClass::getList([
	'select' => $selectFields,
	'filter' => $ormFilter,
	'order'  => $order,
	'limit'  => $pageSize,
	'offset' => ($page - 1) * $pageSize,
]);

// --- 8. Маппинг строк БД → формат фронта ------------------------------------
//    Ключи объекта строки должны совпадать с columns[].key.
//    Здесь же формируем производные поля: url (для type:"link"),
//    trend (для type:"trend"/"index"), букву категории (для type:"cat") и т.д.
$rows = [];
while ($item = $result->fetch()) {
	$rows[] = [
		'employee' => $item['NAME'],
		'url'      => '/employee?id=' . $item['ID'],         // hrefKey:"url" у колонки employee
		'region'   => $item['REGION'],
		'category' => mb_strtolower((string) $item['CATEGORY']), // бейдж a/b/c/d
		'index'    => formatNumber($item['IDX']),            // "1,31"
		'trend'    => ((float) $item['IDX'] >= 0) ? 'up' : 'down',
		'turnover' => formatNumber($item['TURNOVER']),
	];
}

// --- 9. Ответ ---------------------------------------------------------------
echo Json::encode([
	'rows'  => $rows,
	'total' => $total,
]);

die();

// ============================================================================
//  Вспомогательные функции
// ============================================================================

/** Нормализуем значение диапазона под тип поля (число / дата). */
function normalizeValue(string $v, string $type)
{
	if ($type === 'number') {
		// "1 234,56" → 1234.56
		return (float) str_replace([' ', ','], ['', '.'], $v);
	}
	if ($type === 'date') {
		// "дд.мм.гггг" → объект даты Bitrix для корректного сравнения
		return Date::createFromText($v);
	}
	return $v;
}

/** Число → строка в формате вёрстки ("1.31" → "1,31"). */
function formatNumber($v): string
{
	return str_replace('.', ',', (string) $v);
}

/*
 * ----------------------------------------------------------------------------
 *  ПРИМЕЧАНИЕ. Если данные в инфоблоке (IBlock), вместо D7-блока (пп. 2 и 7)
 *  используйте CIBlockElement::GetList — логика та же:
 *
 *    Loader::includeModule('iblock');
 *    $arOrder  = [$COLUMNS[$sortKey]['field'] => $dir];      //白-список!
 *    $arFilter = ['IBLOCK_ID' => IBLOCK_ID] + $iblockFilter; // соберите по той же схеме
 *    $res = CIBlockElement::GetList($arOrder, $arFilter, false,
 *             ['nPageSize' => $pageSize, 'iNumPage' => $page], $selectFields);
 *    $total = $res->NavRecordCount;
 *    while ($el = $res->GetNext()) { $rows[] = [ ... ]; }
 *
 *  Принципы те же: белый список колонок, фильтр по ключам, ответ {rows,total}.
 * ----------------------------------------------------------------------------
 */
