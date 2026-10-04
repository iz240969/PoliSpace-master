<?php
declare(strict_types=1);

require_once __DIR__ . '/account_types.php';

function jsonResponse(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function generateBookingRef(): string
{
    return 'PS' . date('ym') . strtoupper(substr(uniqid('', true), -6));
}

function jsonInput(): array
{
    $input = json_decode(file_get_contents('php://input'), true);
    return is_array($input) ? $input : [];
}

function formatBookingForFrontend(array $booking): array
{
    $accountType = ($booking['account_type'] ?? 'public') === 'staff' ? 'staff' : 'public';
    $paymentRequired = !array_key_exists('payment_required', $booking) || (bool)$booking['payment_required'];

    return [
        'dbId' => (int)$booking['id'],
        'id' => $booking['booking_ref'],
        'booking_ref' => $booking['booking_ref'],
        'name' => $booking['full_name'],
        'org' => $booking['organization'],
        'email' => $booking['email'],
        'phone' => $booking['phone'],
        'facilityId' => (string)$booking['facility_id'],
        'facilityName' => $booking['facility_name'] ?? '',
        'facilityIcon' => '<i class="bi ' . htmlspecialchars($booking['icon'] ?? 'bi-building', ENT_QUOTES, 'UTF-8') . '"></i>',
        'picFullName' => $booking['pic_full_name'] ?? '',
        'pic_full_name' => $booking['pic_full_name'] ?? '',
        'picPhone' => $booking['pic_phone'] ?? '',
        'pic_phone' => $booking['pic_phone'] ?? '',
        'date' => $booking['booking_date'],
        'start' => substr((string)$booking['start_time'], 0, 5),
        'end' => $booking['end_time'] ? substr((string)$booking['end_time'], 0, 5) : '',
        'duration' => $booking['duration'],
        'durationUnit' => $booking['duration_unit'] ?? 'hour',
        'duration_unit' => $booking['duration_unit'] ?? 'hour',
        'purpose' => $booking['purpose'],
        'setup' => $booking['setup_required'],
        'equipment' => $booking['equipment_required'] ?? '',
        'asramaType' => $booking['asrama_type'] ?? '',
        'asrama_type' => $booking['asrama_type'] ?? '',
        'asramaLelakiRooms' => (int)($booking['asrama_lelaki_rooms'] ?? 0),
        'asrama_lelaki_rooms' => (int)($booking['asrama_lelaki_rooms'] ?? 0),
        'asramaPerempuanRooms' => (int)($booking['asrama_perempuan_rooms'] ?? 0),
        'asrama_perempuan_rooms' => (int)($booking['asrama_perempuan_rooms'] ?? 0),
        'roomCount' => (int)($booking['room_count'] ?? 1),
        'room_count' => (int)($booking['room_count'] ?? 1),
        'pax' => $booking['participant_count'],
        'status' => $booking['status'],
        'accountType' => $accountType,
        'account_type' => $accountType,
        'accountTypeLabel' => $accountType === 'staff' ? 'Kakitangan' : 'Orang Awam',
        'paymentRequired' => $paymentRequired,
        'payment_required' => $paymentRequired,
        'adminNote' => $booking['admin_note'],
        'cancellationReason' => $booking['cancellation_reason'] ?? '',
        'cancellation_reason' => $booking['cancellation_reason'] ?? '',
        'paymentFile' => $booking['payment_file'],
        'cartGroupRef' => $booking['cart_group_ref'] ?? '',
        'estimatedCost' => $booking['estimated_cost'],
        'createdAt' => $booking['created_at'],
    ];
}

function handlePaymentUpload(array $file): array
{
    $allowedTypes = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'application/pdf' => 'pdf',
    ];
    $maxSize = 5 * 1024 * 1024;

    if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        return ['error' => 'Invalid upload.'];
    }

    $type = mime_content_type($file['tmp_name']) ?: ($file['type'] ?? '');
    if (!isset($allowedTypes[$type])) {
        return ['error' => 'File type not allowed. Upload JPG, PNG, GIF, or PDF.'];
    }

    if ((int)$file['size'] > $maxSize) {
        return ['error' => 'File size exceeds 5MB limit.'];
    }

    if (!is_dir(UPLOAD_DIR) && !mkdir(UPLOAD_DIR, 0755, true)) {
        return ['error' => 'Upload directory could not be created.'];
    }

    $extension = $allowedTypes[$type];
    $filename = 'payment_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $extension;
    $destination = UPLOAD_DIR . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        return ['error' => 'Failed to upload file.'];
    }

    return ['filename' => $filename];
}

function handlePaymentEvidenceUpload(array $data): array
{
    if (isset($_FILES['payment_file'])) {
        return handlePaymentUpload($_FILES['payment_file']);
    }

    $encoded = $data['payment_file_base64'] ?? null;
    if (!is_string($encoded) || $encoded === '') {
        return ['error' => 'Receipt upload is required'];
    }
    // A 5 MB file needs at most 6,990,508 base64 characters.
    if (strlen($encoded) > 6990508) {
        return ['error' => 'File size exceeds 5MB limit.'];
    }
    $contents = base64_decode($encoded, true);
    if ($contents === false || $contents === '') {
        return ['error' => 'Invalid upload.'];
    }
    if (strlen($contents) > 5 * 1024 * 1024) {
        return ['error' => 'File size exceeds 5MB limit.'];
    }

    $extensions = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'application/pdf' => 'pdf',
    ];
    $type = (new finfo(FILEINFO_MIME_TYPE))->buffer($contents);
    if (!isset($extensions[$type])) {
        return ['error' => 'File type not allowed. Upload JPG, PNG, GIF, or PDF.'];
    }
    if (!is_dir(UPLOAD_DIR) && !mkdir(UPLOAD_DIR, 0755, true)) {
        return ['error' => 'Upload directory could not be created.'];
    }
    $filename = 'payment_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $extensions[$type];
    if (file_put_contents(UPLOAD_DIR . $filename, $contents, LOCK_EX) === false) {
        return ['error' => 'Failed to upload file.'];
    }
    return ['filename' => $filename];
}

function requireAdmin(): void
{
    if (empty($_SESSION['admin_id']) || !empty($_SESSION['user_id'])) {
        if (!empty($_SESSION['admin_id']) && !empty($_SESSION['user_id'])) {
            unset(
                $_SESSION['admin_id'],
                $_SESSION['admin_email'],
                $_SESSION['admin_name'],
                $_SESSION['user_id'],
                $_SESSION['user_email']
            );
        }
        jsonResponse(['success' => false, 'error' => 'Admin login required'], 401);
    }

    $admin = Database::getInstance()->fetchOne(
        "SELECT id FROM users WHERE id = ? AND role = 'admin'",
        [(int)$_SESSION['admin_id']]
    );
    if (!$admin) {
        unset($_SESSION['admin_id'], $_SESSION['admin_email'], $_SESSION['admin_name']);
        jsonResponse(['success' => false, 'error' => 'Admin login required'], 401);
    }
}

function requireUserAccount(Database $db): array
{
    ensureAccountTypeSchema($db);
    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    if ($userId <= 0 || !empty($_SESSION['admin_id'])) {
        if ($userId > 0 && !empty($_SESSION['admin_id'])) {
            unset(
                $_SESSION['admin_id'],
                $_SESSION['admin_email'],
                $_SESSION['admin_name'],
                $_SESSION['user_id'],
                $_SESSION['user_email']
            );
        }
        jsonResponse(['success' => false, 'error' => 'User login required'], 401);
    }

    $user = $db->fetchOne(
        "SELECT id, email, full_name, phone, account_type, staff_number, staff_verification_status, is_blocked
         FROM users WHERE id = ? AND role = 'user'",
        [$userId]
    );
    if (!$user) {
        unset($_SESSION['user_id'], $_SESSION['user_email']);
        jsonResponse(['success' => false, 'error' => 'User login required'], 401);
    }

    if ((int)$user['is_blocked'] === 1) {
        unset($_SESSION['user_id'], $_SESSION['user_email']);
        session_regenerate_id(true);
        jsonResponse(['success' => false, 'error' => 'Account blocked. Please contact an administrator.'], 401);
    }

    $_SESSION['user_email'] = (string)$user['email'];
    return $user;
}

function sendPlainEmail(string $to, string $subject, string $body): bool
{
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $fromAddress = defined('MAIL_FROM_ADDRESS') ? MAIL_FROM_ADDRESS : 'no-reply@polspace.local';
    $fromName = defined('MAIL_FROM_NAME') ? MAIL_FROM_NAME : 'PoliSpace';
    if (function_exists('app') && app()->bound('mailer')) {
        // The API is served by Laravel in production. Use its configured transport
        // so SMTP credentials in .env actually apply to PIC notifications.
        $mailer = (string)config('mail.default', 'log');
        $nestedMailers = (array)config('mail.mailers.' . $mailer . '.mailers', []);
        if (in_array($mailer, ['log', 'array'], true)
            || array_intersect($nestedMailers, ['log', 'array']) !== []) {
            error_log('[PoliSpace] PIC email not sent: configure a delivery mailer.');
            return false;
        }

        try {
            \Illuminate\Support\Facades\Mail::raw($body, static function ($message) use ($to, $subject, $fromAddress, $fromName): void {
                $message->to($to)->subject($subject)->from($fromAddress, $fromName);
            });
            return true;
        } catch (Throwable $e) {
            error_log('[PoliSpace] Email delivery failed: ' . $e->getMessage());
            return false;
        }
    }

    $encodedFromName = function_exists('mb_encode_mimeheader')
        ? mb_encode_mimeheader($fromName)
        : $fromName;
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: ' . $encodedFromName . ' <' . $fromAddress . '>',
        'Reply-To: ' . $fromAddress,
        'X-Mailer: PHP/' . phpversion(),
    ];

    return @mail($to, $subject, $body, implode("\r\n", $headers));
}
?>
