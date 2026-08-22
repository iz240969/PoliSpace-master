<?php
declare(strict_types=1);

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
        'adminNote' => $booking['admin_note'],
        'paymentFile' => $booking['payment_file'],
        'cartGroupRef' => $booking['cart_group_ref'] ?? '',
        'estimatedCost' => $booking['estimated_cost'],
        'createdAt' => $booking['created_at'],
        'completedAt' => $booking['completed_at'] ?? null,
        'completionEmailSentAt' => $booking['completion_email_sent_at'] ?? null,
    ];
}

function sendBookingCompletionEmail(array $booking): bool
{
    $recipient = trim((string)($booking['email'] ?? ''));
    if (!filter_var($recipient, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $recipient)) {
        return false;
    }

    $customerName = trim((string)($booking['full_name'] ?? 'Pelanggan')) ?: 'Pelanggan';
    $reference = trim((string)($booking['booking_ref'] ?? '-')) ?: '-';
    $facility = trim((string)($booking['facility_name'] ?? 'Fasiliti')) ?: 'Fasiliti';
    $bookingDate = trim((string)($booking['booking_date'] ?? '-')) ?: '-';
    $picName = trim((string)($booking['pic_full_name'] ?? ''));
    $picPhone = trim((string)($booking['pic_phone'] ?? ''));

    $subject = APP_NAME . ' - Tempahan ' . $reference . ' Selesai';
    $lines = [
        'Salam ' . $customerName . ',',
        '',
        'Tempahan anda telah ditandakan sebagai selesai.',
        'Rujukan: ' . $reference,
        'Fasiliti: ' . $facility,
        'Tarikh tempahan: ' . $bookingDate,
    ];
    if ($picName !== '') {
        $lines[] = 'Pegawai bertanggungjawab (PIC): ' . $picName;
    }
    if ($picPhone !== '') {
        $lines[] = 'No. telefon PIC: ' . $picPhone;
    }
    $lines[] = '';
    $lines[] = 'Terima kasih kerana menggunakan ' . APP_NAME . '.';

    $fromAddress = filter_var(MAIL_FROM_ADDRESS, FILTER_VALIDATE_EMAIL) && !preg_match('/[\r\n]/', MAIL_FROM_ADDRESS)
        ? MAIL_FROM_ADDRESS
        : 'no-reply@polspace.local';
    $fromName = preg_replace('/[\r\n]+/', ' ', MAIL_FROM_NAME) ?: APP_NAME;
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: ' . $fromName . ' <' . $fromAddress . '>',
    ];

    return @mail($recipient, $subject, implode("\r\n", $lines), implode("\r\n", $headers));
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

function requireAdmin(): void
{
    if (empty($_SESSION['admin_id']) || !empty($_SESSION['user_id'])) {
        jsonResponse(['success' => false, 'error' => 'Admin login required'], 401);
    }
}
?>
