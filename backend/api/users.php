<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/account_types.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

$db = Database::getInstance();
ensureAccountTypeSchema($db, true);

set_exception_handler(static function (Throwable $error): void {
    $message = APP_DEBUG ? $error->getMessage() : 'Client request failed';
    jsonResponse(['success' => false, 'error' => $message], 500);
});

requireAdmin();
$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action !== '' && $action !== 'detail') {
        jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
    }
    if ($action === 'detail') {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if ($id <= 0) {
            jsonResponse(['success' => false, 'error' => 'Client ID required'], 400);
        }

        $user = $db->fetchOne(
            "SELECT id, email, full_name, phone, role, account_type, staff_number, staff_verification_status, is_blocked,
                    password IS NOT NULL AS has_password, created_at, updated_at
             FROM users
             WHERE id = ? AND role = 'user'",
            [$id]
        );

        if (!$user) {
            jsonResponse(['success' => false, 'error' => 'Client not found'], 404);
        }

        $bookings = $db->fetchAll(
            "SELECT b.booking_ref, b.booking_date, b.start_time, b.end_time, b.status, b.purpose,
                    b.account_type, b.payment_required, b.created_at,
                    f.name AS facility_name
             FROM bookings b
             LEFT JOIN facilities f ON b.facility_id = f.id
             WHERE b.email = ? AND b.status <> 'unpaid'
             ORDER BY b.created_at DESC",
            [$user['email']]
        );

        $user['has_password'] = (bool)$user['has_password'];
        $user['is_blocked'] = (bool)$user['is_blocked'];
        jsonResponse(['success' => true, 'data' => ['user' => $user, 'bookings' => $bookings]]);
    }

    $users = $db->fetchAll(
        "SELECT u.id, u.email, u.full_name, u.phone, u.role, u.account_type, u.staff_number,
                u.is_blocked,
                u.staff_verification_status, u.password IS NOT NULL AS has_password,
                u.created_at, u.updated_at, COUNT(b.id) AS booking_count, MAX(b.created_at) AS latest_booking
         FROM users u
         LEFT JOIN bookings b ON b.email = u.email AND b.status <> 'unpaid'
         WHERE u.role = 'user'
         GROUP BY u.id, u.email, u.full_name, u.phone, u.role, u.account_type, u.staff_number,
                  u.staff_verification_status, u.is_blocked, u.password, u.created_at, u.updated_at
         ORDER BY CASE WHEN u.account_type = 'staff' AND u.staff_verification_status = 'pending' THEN 0 ELSE 1 END,
                  u.created_at DESC"
    );

    jsonResponse(['success' => true, 'data' => array_map(static function (array $user): array {
        $user['has_password'] = (bool)$user['has_password'];
        $user['is_blocked'] = (bool)$user['is_blocked'];
        return $user;
    }, $users)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    $input = jsonInput();

    if ($id <= 0) {
        jsonResponse(['success' => false, 'error' => 'Client ID required'], 400);
    }

    $user = $db->fetchOne(
        "SELECT id, account_type, is_blocked FROM users WHERE id = ? AND role = 'user'",
        [$id]
    );
    if (!$user) {
        jsonResponse(['success' => false, 'error' => 'Client not found'], 404);
    }

    if ($action !== '' && !in_array($action, ['staff-verification', 'block'], true)) {
        jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
    }

    if ($action === 'block') {
        $blockedInput = $input['blocked'] ?? null;
        if (!in_array($blockedInput, [true, false, 0, 1, '0', '1'], true)) {
            jsonResponse(['success' => false, 'error' => 'Invalid account block status'], 400);
        }
        $blocked = $blockedInput === true || $blockedInput === 1 || $blockedInput === '1';
        $db->update(
            'UPDATE users SET is_blocked = ? WHERE id = ? AND role = ?',
            [$blocked ? 1 : 0, $id, 'user']
        );
        jsonResponse([
            'success' => true,
            'message' => $blocked
                ? 'Akaun pengguna berjaya disekat.'
                : 'Sekatan akaun pengguna berjaya dibuka.',
        ]);
    }

    if ($action === 'staff-verification') {
        $status = (string)($input['status'] ?? '');
        if ($user['account_type'] !== ACCOUNT_TYPE_STAFF) {
            jsonResponse(['success' => false, 'error' => 'Only staff accounts can be verified'], 400);
        }
        if (!in_array($status, [STAFF_VERIFICATION_VERIFIED, STAFF_VERIFICATION_REJECTED], true)) {
            jsonResponse(['success' => false, 'error' => 'Invalid staff verification status'], 400);
        }

        $db->update(
            'UPDATE users SET staff_verification_status = ? WHERE id = ? AND role = ?',
            [$status, $id, 'user']
        );
        jsonResponse([
            'success' => true,
            'message' => $status === STAFF_VERIFICATION_VERIFIED
                ? 'Akaun kakitangan berjaya disahkan.'
                : 'Pengesahan akaun kakitangan ditolak.',
        ]);
    }

    $password = (string)($input['password'] ?? '');
    if (strlen($password) < 6 || strlen($password) > 128) {
        jsonResponse(['success' => false, 'error' => 'Password must be between 6 and 128 characters'], 400);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $db->update("UPDATE users SET password = ? WHERE id = ? AND role = 'user'", [$hash, $id]);

    jsonResponse(['success' => true, 'message' => 'Client password updated']);
}

jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
?>
