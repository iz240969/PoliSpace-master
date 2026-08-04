<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

$db = Database::getInstance();
$input = $_POST ?: jsonInput();
$action = $_GET['action'] ?? '';

function establishAdminSession(array $user): void
{
    session_regenerate_id(true);
    unset($_SESSION['user_id'], $_SESSION['user_email']);
    $_SESSION['admin_id'] = $user['id'];
    $_SESSION['admin_email'] = $user['email'];
    $_SESSION['admin_name'] = $user['full_name'];
}

function establishUserSession(int $userId, string $email): void
{
    session_regenerate_id(true);
    unset($_SESSION['admin_id'], $_SESSION['admin_email'], $_SESSION['admin_name']);
    $_SESSION['user_id'] = $userId;
    $_SESSION['user_email'] = $email;
}

set_exception_handler(static function (Throwable $error): void {
    if ($error instanceof PDOException && $error->getCode() === '23000') {
        jsonResponse(['success' => false, 'error' => 'Account already exists. Please login.'], 409);
    }
    $message = APP_DEBUG ? $error->getMessage() : 'Authentication request failed';
    jsonResponse(['success' => false, 'error' => $message], 500);
});

if ($action === 'auto') {
    $email = trim((string)($input['email'] ?? ''));
    $password = (string)($input['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
        jsonResponse(['success' => false, 'error' => 'Email and password required'], 400);
    }

    $user = $db->fetchOne(
        'SELECT id, email, password, full_name, role FROM users WHERE email = ?',
        [$email]
    );
    if (!$user || empty($user['password']) || !password_verify($password, (string)$user['password'])) {
        jsonResponse(['success' => false, 'error' => 'Invalid credentials'], 401);
    }

    if ($user['role'] === 'admin') {
        establishAdminSession($user);

        jsonResponse([
            'success' => true,
            'message' => 'Login successful',
            'role' => 'admin',
            'redirect' => 'admin-dashboard.html',
            'user' => [
                'id' => (int)$user['id'],
                'name' => $user['full_name'],
                'email' => $user['email'],
            ],
        ]);
    }

    if ($user['role'] === 'user') {
        establishUserSession((int)$user['id'], (string)$user['email']);

        jsonResponse([
            'success' => true,
            'message' => 'Login successful',
            'role' => 'user',
            'redirect' => 'dashboard.html',
            'email' => $user['email'],
        ]);
    }

    jsonResponse(['success' => false, 'error' => 'Invalid account role'], 401);
}

if ($action === 'signup') {
    $email = trim((string)($input['email'] ?? ''));
    $password = (string)($input['password'] ?? '');
    $confirm = (string)($input['password_confirm'] ?? '');
    $fullName = trim((string)($input['full_name'] ?? ''));
    $phone = trim((string)($input['phone'] ?? ''));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 100) {
        jsonResponse(['success' => false, 'error' => 'Valid email required'], 400);
    }

    if (strlen($fullName) < 2 || strlen($fullName) > 100) {
        jsonResponse(['success' => false, 'error' => 'Full name must contain between 2 and 100 characters'], 400);
    }

    if (strlen($phone) < 7 || strlen($phone) > 20 || !preg_match('/^[0-9+()\-\s]+$/', $phone)) {
        jsonResponse(['success' => false, 'error' => 'Valid phone number required'], 400);
    }

    if (strlen($password) < 6) {
        jsonResponse(['success' => false, 'error' => 'Password must be at least 6 characters'], 400);
    }

    if ($password !== $confirm) {
        jsonResponse(['success' => false, 'error' => 'Password confirmation does not match'], 400);
    }

    $user = $db->fetchOne('SELECT id, email, password, role FROM users WHERE email = ?', [$email]);
    if ($user && $user['role'] === 'admin') {
        jsonResponse(['success' => false, 'error' => 'Admin account cannot use client signup'], 400);
    }

    if ($user && !empty($user['password'])) {
        jsonResponse(['success' => false, 'error' => 'Account already exists. Please login.'], 409);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($user) {
        $db->update(
            "UPDATE users SET password = ?, full_name = COALESCE(NULLIF(?, ''), full_name), phone = COALESCE(NULLIF(?, ''), phone), role = 'user' WHERE id = ?",
            [$hash, $fullName, $phone, $user['id']]
        );
        $userId = (int)$user['id'];
    } else {
        $userId = (int)$db->insert(
            'INSERT INTO users (email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?)',
            [$email, $hash, $fullName, $phone, 'user']
        );
    }

    establishUserSession($userId, $email);

    jsonResponse([
        'success' => true,
        'message' => 'Signup successful',
        'role' => 'user',
        'redirect' => 'booking.html',
        'email' => $email,
    ]);
}

if ($action === 'me') {
    if (!empty($_SESSION['user_id']) && !empty($_SESSION['admin_id'])) {
        $_SESSION = [];
        session_regenerate_id(true);
        jsonResponse(['success' => false, 'error' => 'Session role conflict. Please login again.'], 401);
    }

    if (!empty($_SESSION['user_id'])) {
        $user = $db->fetchOne("SELECT id, email, full_name, phone, role FROM users WHERE id = ? AND role = 'user'", [$_SESSION['user_id']]);
        if ($user) {
            jsonResponse([
                'success' => true,
                'role' => 'user',
                'user' => [
                    'id' => (int)$user['id'],
                    'email' => $user['email'],
                    'name' => $user['full_name'],
                    'phone' => $user['phone'],
                ],
            ]);
        }
    }

    if (!empty($_SESSION['admin_id'])) {
        jsonResponse(['success' => true, 'role' => 'admin']);
    }

    jsonResponse(['success' => false, 'error' => 'Login required'], 401);
}

if ($action === 'profile') {
    if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
        jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
    }

    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    if ($userId <= 0 || !empty($_SESSION['admin_id'])) {
        jsonResponse(['success' => false, 'error' => 'User login required'], 401);
    }

    $fullName = trim((string)($input['full_name'] ?? ''));
    $phone = trim((string)($input['phone'] ?? ''));

    if (strlen($fullName) < 2 || strlen($fullName) > 100) {
        jsonResponse(['success' => false, 'error' => 'Full name must contain between 2 and 100 characters'], 400);
    }

    if (strlen($phone) < 7 || strlen($phone) > 20 || !preg_match('/^[0-9+()\-\s]+$/', $phone)) {
        jsonResponse(['success' => false, 'error' => 'Valid phone number required'], 400);
    }

    $db->update(
        "UPDATE users SET full_name = ?, phone = ? WHERE id = ? AND role = 'user'",
        [$fullName, $phone, $userId]
    );

    $user = $db->fetchOne(
        "SELECT id, email, full_name, phone FROM users WHERE id = ? AND role = 'user'",
        [$userId]
    );
    if (!$user) {
        jsonResponse(['success' => false, 'error' => 'User account not found'], 404);
    }

    jsonResponse([
        'success' => true,
        'message' => 'Profile updated',
        'user' => [
            'id' => (int)$user['id'],
            'email' => $user['email'],
            'name' => $user['full_name'],
            'phone' => $user['phone'],
        ],
    ]);
}

if ($action === 'login') {
    $email = trim((string)($input['email'] ?? ''));
    $password = (string)($input['password'] ?? '');

    if ($email === '' || $password === '') {
        jsonResponse(['success' => false, 'error' => 'Email and password required'], 400);
    }

    $user = $db->fetchOne(
        "SELECT id, email, password, full_name, role FROM users WHERE email = ? AND role = 'admin'",
        [$email]
    );
    $validPassword = $user && password_verify($password, (string)$user['password']);

    if ($user && $validPassword) {
        establishAdminSession($user);

        jsonResponse([
            'success' => true,
            'message' => 'Login successful',
            'user' => [
                'id' => (int)$user['id'],
                'name' => $user['full_name'],
                'email' => $user['email'],
            ],
        ]);
    }

    jsonResponse(['success' => false, 'error' => 'Invalid credentials'], 401);
}

if ($action === 'user') {
    $email = trim((string)($input['email'] ?? ''));
    $password = (string)($input['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'error' => 'Valid email required'], 400);
    }

    if ($password === '') {
        jsonResponse(['success' => false, 'error' => 'Password required'], 400);
    }

    $user = $db->fetchOne("SELECT id, email, password, role FROM users WHERE email = ? AND role = 'user'", [$email]);
    if (!$user || empty($user['password'])) {
        jsonResponse(['success' => false, 'error' => 'Client password has not been set by admin'], 401);
    }

    if (!password_verify($password, (string)$user['password'])) {
        jsonResponse(['success' => false, 'error' => 'Invalid credentials'], 401);
    }

    establishUserSession((int)$user['id'], (string)$user['email']);
    jsonResponse(['success' => true, 'message' => 'Login successful', 'email' => $email]);
}

if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    jsonResponse(['success' => true, 'message' => 'Logged out']);
}

jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
?>
