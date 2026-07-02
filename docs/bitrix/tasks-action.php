<?php
/**
 * ============================================================================
 *  ПРИМЕР ЭНДПОИНТА ДЕЙСТВИЙ С ЗАДАЧАМИ (сохранение в БД).
 * ============================================================================
 *
 *  Фронт шлёт сюда POST c JSON на КАЖДОЕ изменяющее действие и применяет
 *  изменение в UI ТОЛЬКО при успешном ответе (request-first). См. TASKS.md.
 *
 *  Подключение — на секции панели задач:
 *    <section class="tasks-panel" data-module="TasksPanel" data-path="components"
 *             data-tasks-src="/local/ajax/tasks.php"
 *             data-tasks-action-url="/local/ajax/tasks-action.php"> … </section>
 *
 *  Тело запроса: { "action": "...", ... }
 *    status  → { id, done }
 *    comment → { id, comment }
 *    update  → { id, title, assignee, due, hidden }
 *    create  → { title, assignee, due, hidden }
 *    delete  → { id }
 *
 *  Ответ:
 *    успех:  { "ok": true }         (для create лучше { "ok": true, "id": <новый id> })
 *    ошибка: HTTP 4xx/5xx  ИЛИ  { "ok": false, "error": "текст" }
 * ----------------------------------------------------------------------------
 */

// require($_SERVER['DOCUMENT_ROOT'].'/bitrix/modules/main/include/prolog_before.php');

header('Content-Type: application/json; charset=utf-8');

// маленький помощник ответа
function respond($data, int $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// читаем JSON-тело
$raw = file_get_contents('php://input');
$req = json_decode($raw, true);
if (!is_array($req) || empty($req['action'])) {
    respond(['ok' => false, 'error' => 'Некорректный запрос'], 400);
}

$action = $req['action'];

// (опционально) проверка CSRF / прав доступа:
// if (!check_bitrix_sessid()) respond(['ok' => false, 'error' => 'Недействительная сессия'], 403);

try {
    switch ($action) {
        case 'status': // выполнить / вернуть в работу
            $id   = (int)($req['id'] ?? 0);
            $done = !empty($req['done']);
            // TODO: ваша логика — пометить задачу $id выполненной/невыполненной
            respond(['ok' => true]);

        case 'comment': // сохранить/снять комментарий
            $id      = (int)($req['id'] ?? 0);
            $comment = trim((string)($req['comment'] ?? ''));
            // TODO: сохранить комментарий к задаче $id
            respond(['ok' => true]);

        case 'update': // сохранить отредактированную задачу
            $id       = (int)($req['id'] ?? 0);
            $title    = trim((string)($req['title'] ?? ''));
            $assignee = (string)($req['assignee'] ?? '');
            $due      = (string)($req['due'] ?? '');       // 'дд.мм.гггг'
            $hidden   = !empty($req['hidden']);
            if ($title === '') respond(['ok' => false, 'error' => 'Пустой заголовок'], 422);
            // TODO: обновить задачу $id
            respond(['ok' => true]);

        case 'create': // создать новую задачу
            $title    = trim((string)($req['title'] ?? ''));
            $assignee = (string)($req['assignee'] ?? '');
            $due      = (string)($req['due'] ?? '');
            $hidden   = !empty($req['hidden']);
            if ($title === '') respond(['ok' => false, 'error' => 'Пустой заголовок'], 422);
            // TODO: создать задачу, получить её id
            $newId = 0; // <-- подставьте реальный id
            respond(['ok' => true, 'id' => $newId]);

        case 'delete': // удалить задачу
            $id = (int)($req['id'] ?? 0);
            // TODO: удалить задачу $id
            respond(['ok' => true]);

        default:
            respond(['ok' => false, 'error' => 'Неизвестное действие: ' . $action], 400);
    }
} catch (\Throwable $e) {
    // любую ошибку сохранения возвращаем фронту — он покажет тост и не применит изменение
    respond(['ok' => false, 'error' => $e->getMessage()], 500);
}
