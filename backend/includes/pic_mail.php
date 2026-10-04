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
                b.account_type, b.payment_required,
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
        'No. Rujukan Tempahan: ' . ($booking['booking_ref'] ?: '-'),
        'Fasiliti: ' . ($booking['facility_name'] ?: '-'),
        'Nama pelanggan: ' . ($booking['full_name'] ?: '-'),
        'No. Telefon pelanggan: ' . ($booking['phone'] ?: '-'),
        'Alamat e-mel pelanggan: ' . ($booking['email'] ?: '-'),
        'Jenis pemohon: ' . (($booking['account_type'] ?? 'public') === 'staff' ? 'Kakitangan' : 'Orang Awam'),
        'Bayaran diperlukan: ' . (!empty($booking['payment_required']) ? 'Ya' : 'Tidak'),
        'Tarikh tempahan: ' . ($booking['booking_date'] ?: '-'),
        'Masa mula: ' . ($startTime ?: '-'),
        'Tempoh: ' . bookingDurationLabel($booking),
        'Tujuan: ' . ($booking['purpose'] ?: '-'),
        'Jumlah pengguna: ' . (string)($booking['participant_count'] ?? 0),
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
    if (!$booking) {
        return [
            'sent' => false,
            'skipped' => true,
            'warning' => 'Tempahan berjaya dikemas kini, tetapi maklumat tempahan tidak ditemui untuk e-mel PIC.',
        ];
    }

    $configuredEmail = trim(envValue('PIC_NOTIFICATION_EMAIL'));
    if ($configuredEmail === '' && empty($booking['pic_full_name'])) {
        return [
            'sent' => false,
            'skipped' => true,
            'warning' => 'Tempahan berjaya dikemas kini, tetapi fasiliti ini belum mempunyai PIC.',
        ];
    }

    $picEmail = $configuredEmail !== '' ? $configuredEmail : trim((string)($booking['pic_email'] ?? ''));
    if (!filter_var($picEmail, FILTER_VALIDATE_EMAIL)) {
        return [
            'sent' => false,
            'skipped' => true,
            'warning' => 'Tempahan berjaya dikemas kini, tetapi alamat e-mel PIC tidak sah.',
        ];
    }

    $picName = trim((string)($booking['pic_full_name'] ?? ''));
    $greeting = 'Assalamualaikum / Salam sejahtera' . ($picName !== '' ? ' ' . $picName : '') . ',';
    $details = bookingNotificationLines($booking);

    if ($type === 'approved') {
        $subject = 'PoliSpace — Tempahan Diluluskan (' . $booking['booking_ref'] . ')';
        $equipment = trim((string)($booking['equipment_required'] ?? ''));
        $approvalMessage = !empty($booking['payment_required'])
            ? [
                'Bayaran pelanggan telah disahkan dan tempahan berikut telah diluluskan.',
                'Sila buat persediaan bagi fasiliti ini mengikut maklumat tempahan.',
            ]
            : [
                'Permohonan tempahan fasiliti bagi kakitangan berikut telah diluluskan.',
                'Tiada bayaran dikenakan untuk tempahan ini. Sila buat persediaan bagi fasiliti mengikut maklumat yang diberikan.',
            ];
        $body = implode("\n", array_merge([
            $greeting,
            '',
        ], $approvalMessage, [
            '',
        ], $details, [
            'Peralatan diminta: ' . ($equipment !== '' ? $equipment : 'Tiada'),
            '',
            'Terima kasih.',
        ]));
    } elseif ($type === 'cancelled') {
        $subject = 'PoliSpace — Tempahan Dibatalkan (' . $booking['booking_ref'] . ')';
        $reason = trim((string)($booking['cancellation_reason'] ?? ''));
        $body = implode("\n", array_merge([
            $greeting,
            '',
            'Tempahan yang telah diluluskan ini dibatalkan oleh pentadbir.',
            'PIC tidak perlu lagi membuat persediaan bagi tempahan ini.',
            '',
        ], $details, [
            'Sebab pembatalan: ' . ($reason !== '' ? $reason : '-'),
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
            'warning' => 'Tempahan berjaya dikemas kini, tetapi e-mel kepada PIC tidak dapat dihantar. Semak tetapan e-mel sistem.',
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
        'Ini ialah e-mel ujian daripada PoliSpace.',
        '',
        'Maklumat PIC:',
        'Nama: ' . (($pic['full_name'] ?? '') ?: '-'),
        'Telefon: ' . (($pic['phone'] ?? '') ?: '-'),
        'Fasiliti yang diuruskan: ' . ($facilityNames !== '' ? $facilityNames : 'Tiada PIC ditetapkan'),
        '',
        'Alamat e-mel ini akan menerima pemberitahuan apabila tempahan diluluskan atau dibatalkan.',
        '',
        'Terima kasih.',
    ]);

    return sendPlainEmail($email, 'PoliSpace — Ujian E-mel PIC', $body);
}
?>
