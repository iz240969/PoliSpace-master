<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

$db = Database::getInstance();

requireAdmin();
$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'detail') {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if ($id <= 0) {
            jsonResponse(['success' => false, 'error' => 'Client ID required'], 400);
        }

        $user = $db->fetchOne(
            "SELECT id, email, full_name, phone, role, password IS NOT NULL AS has_password, created_at, updated_at
             FROM users
             WHERE id = ? AND role = 'user'",
            [$id]
        );

        if (!$user) {
            jsonResponse(['success' => false, 'error' => 'Client not found'], 404);
        }

        $bookings = $db->fetchAll(
            "SELECT b.booking_ref, b.booking_date, b.start_time, b.end_time, b.status, b.purpose,
                    f.name AS facility_name
             FROM bookings b
             LEFT JOIN facilities f ON b.facility_id = f.id
             WHERE b.email = ?
             ORDER BY b.created_at DESC",
            [$user['email']]
        );

        $user['has_password'] = (bool)$user['has_password'];
        jsonResponse(['success' => true, 'data' => ['user' => $user, 'bookings' => $bookings]]);
    }

    $users = $db->fetchAll(
        "SELECT u.id, u.email, u.full_name, u.phone, u.role, u.password IS NOT NULL AS has_password,
                u.created_at, u.updated_at, COUNT(b.id) AS booking_count, MAX(b.created_at) AS latest_booking
         FROM users u
         LEFT JOIN bookings b ON b.email = u.email
         WHERE u.role = 'user'
         GROUP BY u.id, u.email, u.full_name, u.phone, u.role, u.password, u.created_at, u.updated_at
         ORDER BY u.created_at DESC"
    );

    jsonResponse(['success' => true, 'data' => array_map(static function (array $user): array {
        $user['has_password'] = (bool)$user['has_password'];
        return $user;
    }, $users)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $password = (string)($input['password'] ?? '');

    if ($id <= 0) {
        jsonResponse(['success' => false, 'error' => 'Client ID required'], 400);
    }

    if (strlen($password) < 6) {
        jsonResponse(['success' => false, 'error' => 'Password must be at least 6 characters'], 400);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $db->update("UPDATE users SET password = ? WHERE id = ? AND role = 'user'", [$hash, $id]);

    jsonResponse(['success' => true, 'message' => 'Client password updated']);
}

jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
?>
