<?php
declare(strict_types=1);

function jsonResponse(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function generateBookingRef(): string
{
    return 'PS' . date('ym') . strtoupper(substr(uniqid('', true), -6));
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
        'date' => $booking['booking_date'],
        'start' => substr((string)$booking['start_time'], 0, 5),
        'end' => $booking['end_time'] ? substr((string)$booking['end_time'], 0, 5) : '',
        'duration' => $booking['duration'],
        'purpose' => $booking['purpose'],
        'setup' => $booking['setup_required'],
        'pax' => $booking['participant_count'],
        'status' => $booking['status'],
        'adminNote' => $booking['admin_note'],
        'paymentFile' => $booking['payment_file'],
        'estimatedCost' => $booking['estimated_cost'],
        'createdAt' => $booking['created_at'],
    ];
}

function handlePaymentUpload(array $file): array
{
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    $maxSize = 5 * 1024 * 1024;

    if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        return ['error' => 'Invalid upload.'];
    }

    $type = mime_content_type($file['tmp_name']) ?: $file['type'];
    if (!in_array($type, $allowedTypes, true)) {
        return ['error' => 'File type not allowed. Upload JPG, PNG, GIF, or PDF.'];
    }

    if ((int)$file['size'] > $maxSize) {
        return ['error' => 'File size exceeds 5MB limit.'];
    }

    if (!is_dir(UPLOAD_DIR) && !mkdir(UPLOAD_DIR, 0755, true)) {
        return ['error' => 'Upload directory could not be created.'];
    }

    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $filename = 'payment_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $extension;
    $destination = UPLOAD_DIR . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        return ['error' => 'Failed to upload file.'];
    }

    return ['filename' => $filename];
}

function requireAdmin(): void
{
    if (empty($_SESSION['admin_id'])) {
        jsonResponse(['success' => false, 'error' => 'Admin login required'], 401);
    }
}
?>
