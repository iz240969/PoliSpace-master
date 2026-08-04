<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/validation.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

$db = Database::getInstance();

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        requireAdmin();
        $messages = $db->fetchAll(
            'SELECT id, email, subject, message, is_read, replied_at, created_at
             FROM contact_messages
             ORDER BY created_at DESC'
        );
        jsonResponse(['success' => true, 'data' => $messages]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
        $sessionEmail = trim((string)($_SESSION['user_email'] ?? ''));
        if ($userId <= 0 || !filter_var($sessionEmail, FILTER_VALIDATE_EMAIL) || !empty($_SESSION['admin_id'])) {
            jsonResponse(['success' => false, 'error' => 'User login required'], 401);
        }

        $input = jsonInput();
        $input['email'] = $sessionEmail;
        $errors = validateContactMessage($input);
        if ($errors) {
            jsonResponse(['success' => false, 'error' => 'Validation failed', 'details' => $errors], 400);
        }

        $db->insert(
            'INSERT INTO contact_messages (email, subject, message) VALUES (?, ?, ?)',
            [$input['email'], $input['subject'], $input['message']]
        );

        jsonResponse(['success' => true, 'message' => 'Message sent successfully']);
    }

    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'Message request failed'], 500);
}
?>
