<?php
declare(strict_types=1);

function loadEnv(string $path): void
{
    if (!is_file($path) || !is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = array_map('trim', explode('=', $line, 2));
        $value = trim($value, "\"'");

        if ($key !== '' && getenv($key) === false) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
        }
    }
}

function envValue(string $key, string $default = ''): string
{
    $value = getenv($key);
    return $value === false ? $default : (string)$value;
}

loadEnv(dirname(__DIR__) . '/.env');

define('DB_HOST', envValue('DB_HOST', 'localhost'));
define('DB_NAME', envValue('DB_NAME', 'polspace'));
define('DB_USER', envValue('DB_USER', 'root'));
define('DB_PASS', envValue('DB_PASS', ''));

define('APP_NAME', envValue('APP_NAME', 'PoliSpace'));
define('APP_URL', envValue('APP_URL', 'http://localhost'));
define('APP_DEBUG', filter_var(envValue('APP_DEBUG', 'false'), FILTER_VALIDATE_BOOLEAN));
define('UPLOAD_DIR', dirname(__DIR__) . '/uploads/payments/');

ini_set('session.cookie_httponly', '1');
ini_set('session.use_only_cookies', '1');
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
?>
