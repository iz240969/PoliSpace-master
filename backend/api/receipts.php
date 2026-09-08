<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
}

$filename = basename((string)($_GET['file'] ?? ''));
if ($filename === '' || !preg_match('/^payment_[A-Za-z0-9_.-]+\.(?:jpe?g|png|gif|pdf)$/i', $filename)) {
    jsonResponse(['success' => false, 'error' => 'Invalid receipt file'], 400);
}

$isAdmin = !empty($_SESSION['admin_id']) && empty($_SESSION['user_id']);
$userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
$userEmail = trim((string)($_SESSION['user_email'] ?? ''));
if (!$isAdmin && ($userId <= 0 || !filter_var($userEmail, FILTER_VALIDATE_EMAIL))) {
    jsonResponse(['success' => false, 'error' => 'Login required'], 401);
}

$db = Database::getInstance();
if ($isAdmin) {
    $booking = $db->fetchOne('SELECT id FROM bookings WHERE payment_file = ? LIMIT 1', [$filename]);
} else {
    $booking = $db->fetchOne(
        'SELECT id FROM bookings WHERE payment_file = ? AND (user_id = ? OR LOWER(email) = LOWER(?)) LIMIT 1',
        [$filename, $userId, $userEmail]
    );
}
if (!$booking) {
    jsonResponse(['success' => false, 'error' => 'Receipt not found'], 404);
}

$path = UPLOAD_DIR . $filename;
if (!is_file($path) || !is_readable($path)) {
    jsonResponse(['success' => false, 'error' => 'Receipt file unavailable'], 404);
}

$mime = mime_content_type($path) ?: 'application/octet-stream';
$allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
if (!in_array($mime, $allowedMimeTypes, true)) {
    jsonResponse(['success' => false, 'error' => 'Unsupported receipt type'], 415);
}

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($path));
header('Content-Disposition: inline; filename="' . $filename . '"');
header('Cache-Control: private, no-store, max-age=0');
readfile($path);
exit;
?>
