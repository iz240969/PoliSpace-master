<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

$db = Database::getInstance();

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $facilities = $db->fetchAll('SELECT * FROM facilities ORDER BY id');
        jsonResponse(['success' => true, 'data' => $facilities]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        requireAdmin();
        $id = $_GET['id'] ?? null;
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        if (!$id) {
            jsonResponse(['success' => false, 'error' => 'Facility ID required'], 400);
        }

        $isAvailable = isset($input['is_available']) ? (int)(bool)$input['is_available'] : null;
        if ($isAvailable !== null) {
            $db->update('UPDATE facilities SET is_available = ? WHERE id = ?', [$isAvailable, $id]);
        }

        jsonResponse(['success' => true, 'message' => 'Facility updated']);
    }

    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'Facility request failed'], 500);
}
?>
