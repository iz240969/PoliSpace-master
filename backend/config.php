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

        if ($key !== ''
            && getenv($key) === false
            && !array_key_exists($key, $_ENV)
            && !array_key_exists($key, $_SERVER)) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
        }
    }
}

function envValue(string $key, string $default = ''): string
{
    $value = getenv($key);
    if ($value === false && array_key_exists($key, $_ENV)) {
        $value = $_ENV[$key];
    }
    if ($value === false && array_key_exists($key, $_SERVER)) {
        $value = $_SERVER[$key];
    }
    return $value === false ? $default : (string)$value;
}

function firstEnvValue(array $keys, string $default = ''): string
{
    foreach ($keys as $key) {
        $value = trim(envValue($key));
        if ($value !== '') {
            return $value;
        }
    }

    return $default;
}

loadEnv(dirname(__DIR__) . '/.env');

define('DB_HOST', envValue('DB_HOST', 'localhost'));
define('DB_NAME', firstEnvValue(['DB_NAME', 'DB_DATABASE'], 'polspace'));
define('DB_USER', firstEnvValue(['DB_USER', 'DB_USERNAME'], 'root'));
define('DB_PASS', firstEnvValue(['DB_PASS', 'DB_PASSWORD']));

define('APP_NAME', envValue('APP_NAME', 'PoliSpace'));
define('APP_URL', envValue('APP_URL', 'http://localhost'));
define('APP_DEBUG', filter_var(envValue('APP_DEBUG', 'false'), FILTER_VALIDATE_BOOLEAN));
define('UPLOAD_DIR', dirname(__DIR__) . '/uploads/payments/');
define('MAIL_FROM_ADDRESS', envValue('MAIL_FROM_ADDRESS', 'no-reply@polspace.local'));
define('MAIL_FROM_NAME', envValue('MAIL_FROM_NAME', APP_NAME));

date_default_timezone_set(envValue('APP_TIMEZONE', 'Asia/Kuala_Lumpur'));

ini_set('session.cookie_httponly', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.use_strict_mode', '1');
ini_set('session.cookie_samesite', 'Lax');
$httpsDetected = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
$trustProxyHttps = filter_var(envValue('TRUST_PROXY_HTTPS', 'false'), FILTER_VALIDATE_BOOLEAN);
$forwardedProtocol = strtolower(trim(explode(',', (string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0]));
$appUrlParts = parse_url(APP_URL);
$appUrlHost = strtolower((string)($appUrlParts['host'] ?? ''));
$appUrlScheme = strtolower((string)($appUrlParts['scheme'] ?? ''));
$requestHost = strtolower((string)parse_url('http://' . (string)($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST));
$configuredHttpsHost = $appUrlScheme === 'https' && $appUrlHost !== '' && $requestHost === $appUrlHost;
if (!$httpsDetected && $forwardedProtocol === 'https' && ($trustProxyHttps || $configuredHttpsHost)) {
    $httpsDetected = true;
}
$secureCookiesConfigured = filter_var(envValue('SESSION_COOKIE_SECURE', 'false'), FILTER_VALIDATE_BOOLEAN);
if ($httpsDetected || $secureCookiesConfigured) {
    ini_set('session.cookie_secure', '1');
}
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: frame-ancestors 'self'");
if (!empty($_SERVER['HTTP_ORIGIN'])) {
    $origin = (string)$_SERVER['HTTP_ORIGIN'];
    $scheme = $httpsDetected ? 'https' : 'http';
    $requestOrigin = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? '');
    $sameOrigin = rtrim($origin, '/') === rtrim($requestOrigin, '/');
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true) && !$sameOrigin) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Cross-origin request rejected']);
        exit;
    }
    if ($sameOrigin) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
    }
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
?>
