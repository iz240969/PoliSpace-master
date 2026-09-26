<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/validation.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

$db = Database::getInstance();
$action = $_GET['action'] ?? '';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($action !== '' && $action !== 'my') {
            jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
        }
        if ($action === 'my') {
            $user = requireUserAccount($db);

            $messages = $db->fetchAll(
                'SELECT id, subject, message, admin_reply, replied_at, created_at
                 FROM contact_messages
                 WHERE email = ?
                 ORDER BY created_at DESC',
                [$user['email']]
            );
            jsonResponse(['success' => true, 'data' => $messages]);
        }

        requireAdmin();
        $messages = $db->fetchAll(
            'SELECT id, email, subject, message, admin_reply, is_read, replied_at, created_at
             FROM contact_messages
             ORDER BY created_at DESC'
        );
        jsonResponse(['success' => true, 'data' => $messages]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if ($action !== '') {
            jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
        }
        $user = requireUserAccount($db);

        $input = jsonInput();
        $input['email'] = (string)$user['email'];
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

    if ($_SERVER['REQUEST_METHOD'] === 'PUT' && $action === 'reply') {
        requireAdmin();
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if ($id <= 0) {
            jsonResponse(['success' => false, 'error' => 'Message not found'], 404);
        }

        $input = jsonInput();
        $reply = trim((string)($input['reply'] ?? ''));
        $replyLength = strlen($reply);
        if ($replyLength < 2 || $replyLength > 5000) {
            jsonResponse(['success' => false, 'error' => 'Reply must be between 2 and 5000 characters'], 400);
        }

        $message = $db->fetchOne('SELECT id FROM contact_messages WHERE id = ?', [$id]);
        if (!$message) {
            jsonResponse(['success' => false, 'error' => 'Message not found'], 404);
        }

        $db->update(
            'UPDATE contact_messages
             SET admin_reply = ?, replied_at = NOW(), replied_by = ?, is_read = TRUE
             WHERE id = ?',
            [$reply, (int)$_SESSION['admin_id'], $id]
        );

        jsonResponse(['success' => true, 'message' => 'Reply sent successfully']);
    }

    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'Message request failed'], 500);
}
?>
