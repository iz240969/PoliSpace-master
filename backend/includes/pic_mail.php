<?php
declare(strict_types=1);

/**
 * Load the current PIC assignment together with the booking details used by
 * booking lifecycle notifications. The assignment is intentionally resolved
 * at send time so reassigned facilities notify their current PIC.
 */
function getBookingPicNotificationData(Database $db, int $bookingId): array|false
{
    return $db->fetchOne(
        "SELECT b.booking_ref, b.full_name, b.phone, b.email, b.booking_date,
                b.start_time, b.end_time, b.duration, b.duration_unit, b.purpose,
                b.participant_count, b.equipment_required, b.cancellation_reason,
                f.name AS facility_name, p.full_name AS pic_full_name,
                p.phone AS pic_phone, p.email AS pic_email
         FROM bookings b
         INNER JOIN facilities f ON f.id = b.facility_id
         LEFT JOIN pics p ON p.id = f.pic_id
         WHERE b.id = ?",
        [$bookingId]
    );
}

function bookingDurationLabel(array $booking): string
{
    $duration = trim((string)($booking['duration'] ?? '1')) ?: '1';
    return $duration . ((string)($booking['duration_unit'] ?? 'hour') === 'day' ? ' hari' : ' jam');
}

function bookingNotificationLines(array $booking): array
{
    $startTime = substr((string)($booking['start_time'] ?? ''), 0, 5);

    return [
        'Rujukan tempahan: ' . ($booking['booking_ref'] ?: '-'),
        'Fasiliti: ' . ($booking['facility_name'] ?: '-'),
        'Nama pelanggan: ' . ($booking['full_name'] ?: '-'),
        'Telefon pelanggan: ' . ($booking['phone'] ?: '-'),
        'E-mel pelanggan: ' . ($booking['email'] ?: '-'),
        'Tarikh tempahan: ' . ($booking['booking_date'] ?: '-'),
        'Masa mula: ' . ($startTime ?: '-'),
        'Tempoh: ' . bookingDurationLabel($booking),
        'Tujuan: ' . ($booking['purpose'] ?: '-'),
        'Bilangan peserta: ' . (string)($booking['participant_count'] ?? 0),
    ];
}

/**
 * @return array{sent: bool, skipped: bool, warning: string|null}
 */
function sendBookingPicNotification(
    Database $db,
    int $bookingId,
    string $type,
    ?callable $emailSender = null
): array
{
    $booking = getBookingPicNotificationData($db, $bookingId);
    if (!$booking || empty($booking['pic_full_name'])) {
        return [
            'sent' => false,
            'skipped' => true,
            'warning' => 'Status tempahan telah dikemas kini, tetapi fasiliti ini belum mempunyai PIC.',
        ];
    }

    $picEmail = trim((string)($booking['pic_email'] ?? ''));
    if (!filter_var($picEmail, FILTER_VALIDATE_EMAIL)) {
        return [
            'sent' => false,
            'skipped' => true,
            'warning' => 'Status tempahan telah dikemas kini, tetapi PIC tidak mempunyai alamat e-mel yang sah.',
        ];
    }

    $greeting = 'Assalamualaikum / Salam sejahtera ' . trim((string)$booking['pic_full_name']) . ',';
    $details = bookingNotificationLines($booking);

    if ($type === 'approved') {
        $subject = 'PoliSpace - Tempahan Diluluskan (' . $booking['booking_ref'] . ')';
        $equipment = trim((string)($booking['equipment_required'] ?? ''));
        $body = implode("\n", array_merge([
            $greeting,
            '',
            'Bayaran pelanggan telah disahkan dan tempahan berikut telah diluluskan.',
            'Sila sediakan dan urus fasiliti untuk tempahan yang telah diluluskan ini.',
            '',
        ], $details, [
            'Peralatan diminta: ' . ($equipment !== '' ? $equipment : 'Tiada'),
            '',
            'Terima kasih.',
        ]));
    } elseif ($type === 'cancelled') {
        $subject = 'PoliSpace - Tempahan Diluluskan Telah Dibatalkan (' . $booking['booking_ref'] . ')';
        $reason = trim((string)($booking['cancellation_reason'] ?? ''));
        $body = implode("\n", array_merge([
            $greeting,
            '',
            'Tempahan yang sebelum ini telah diluluskan kini telah dibatalkan oleh pentadbir.',
            'PIC tidak lagi perlu menyediakan fasiliti untuk tempahan ini.',
            '',
        ], $details, [
            'Sebab pembatalan / nota pentadbir: ' . ($reason !== '' ? $reason : '-'),
            '',
            'Terima kasih.',
        ]));
    } else {
        throw new InvalidArgumentException('Unsupported PIC notification type.');
    }

    $emailSender ??= 'sendPlainEmail';
    if (!$emailSender($picEmail, $subject, $body)) {
        return [
            'sent' => false,
            'skipped' => false,
            'warning' => 'Status tempahan berjaya dikemas kini, tetapi e-mel kepada PIC gagal dihantar. Semak konfigurasi mail server.',
        ];
    }

    return ['sent' => true, 'skipped' => false, 'warning' => null];
}

function sendPicTestEmail(array $pic): bool
{
    $email = trim((string)($pic['email'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $facilityNames = trim((string)($pic['facility_names'] ?? ''));
    $body = implode("\n", [
        'Assalamualaikum / Salam sejahtera ' . trim((string)($pic['full_name'] ?? '')) . ',',
        '',
        'Ini ialah e-mel percubaan daripada sistem PoliSpace.',
        '',
        'Maklumat PIC:',
        'Nama: ' . (($pic['full_name'] ?? '') ?: '-'),
        'Telefon: ' . (($pic['phone'] ?? '') ?: '-'),
        'Fasiliti ditugaskan: ' . ($facilityNames !== '' ? $facilityNames : 'Belum ada'),
        '',
        'Alamat e-mel ini boleh digunakan untuk notifikasi kelulusan dan pembatalan tempahan.',
        '',
        'Terima kasih.',
    ]);

    return sendPlainEmail($email, 'PoliSpace - Percubaan E-mel PIC', $body);
}
?>
