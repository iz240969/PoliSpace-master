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
        $messages = $db->fetchAll('SELECT * FROM contact_messages ORDER BY created_at DESC');
        jsonResponse(['success' => true, 'data' => $messages]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
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
