<?php
/**
 * ============================================================================
 *  ПРИМЕР ОТДАЧИ ВИЗИТОВ ДЛЯ КАЛЕНДАРЯ (План визитов). Клиентский режим.
 * ============================================================================
 *
 *  Фронт (календарь .vcal) строит месяц/неделю/день из этого JSON.
 *  Подключение — атрибутом data-visits-src на элементе календаря (см. VISITS.md).
 *
 *    <div class="vcal" data-module="VisitsCalendar" data-path="components"
 *         data-anchor="2026-05-01" data-visits-src="/local/ajax/visits.php"></div>
 *
 *  Формат: { "visits": [ { date, time, name, cat, pharmacy, ... }, ... ] }
 *  Поля визита — в VISITS.md. Отдавать минимум за видимый месяц.
 *
 *  Таблицы «План-факт» и «История» — это обычный DataTable (data-table-src),
 *  см. datatable-config.php / TABLES.md.
 * ----------------------------------------------------------------------------
 */

// require($_SERVER['DOCUMENT_ROOT'].'/bitrix/modules/main/include/prolog_before.php');

header('Content-Type: application/json; charset=utf-8');

/* ЗАГЛУШКА-ПРИМЕР (заменить на реальную выборку визитов за нужный период) */
$visits = [
    [
        'date' => '05.05.2026', 'time' => '09:00',
        'name' => 'Медицинская Т.В.', 'cat' => 'b',
        'pharmacy' => 'Могилев, ADEL, Аптека №12',
        'phone' => '+375 29 890-23-23',
        'manager' => 'Петров А.И.', 'managerPhone' => '+375 29 123-10-10',
        'managerEmail' => 'petrov_manager@phg.by',
        'type' => 'Коучинг',
        'comment' => 'Обсудить показатели продаж СТМ.',
        'status' => 'planned',
    ],
    [
        'date' => '06.05.2026', 'time' => '10:00',
        'name' => 'Петров С.В.', 'cat' => 'a',
        'pharmacy' => 'Минск, ADEL, Аптека №3',
        'manager' => 'Петров А.И.', 'managerPhone' => '+375 29 123-10-10',
        'type' => 'Коучинг',
        'status' => 'confirmed',                 // подтверждён → другой вид попапа
        'confirmedDate' => '09.03.2026, 12:24',
        'coords' => '5534444.442442 , 455543.222345',
        'checklist' => '78 / 100',
    ],
    [
        'date' => '07.05.2026', 'time' => '11:00',
        'name' => 'Иванова О.А.', 'cat' => 'd',
        'pharmacy' => 'Брест, Эконом, Аптека №8',
        'type' => 'Диагностика',
        'status' => 'planned',
        'cancelled' => true,                     // отменён → метка зачёркнута
    ],
];

echo json_encode(['visits' => $visits], JSON_UNESCAPED_UNICODE);
