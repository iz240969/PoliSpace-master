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

function picEmailEscape(mixed $value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function picEmailLayout(string $eyebrow, string $heading, string $intro, array $sections, string $accent = '#986600'): string
{
    $cards = '';
    foreach ($sections as $section) {
        $cards .= '<tr><td style="padding:0 28px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9e5dc;border-radius:12px;background:#fff">'
            . '<tr><td style="padding:20px 20px 8px;color:#986600;font:700 12px Arial,sans-serif;letter-spacing:1.3px;text-transform:uppercase">' . picEmailEscape($section['title']) . '</td></tr>';
        foreach ($section['rows'] as $label => $value) {
            $cards .= '<tr><td style="padding:10px 20px;border-top:1px solid #f0eee9"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
                . '<td width="42%" style="vertical-align:top;color:#68665f;font:14px/1.5 Arial,sans-serif">' . picEmailEscape($label) . '</td>'
                . '<td style="vertical-align:top;color:#252923;font:600 14px/1.5 Arial,sans-serif;overflow-wrap:anywhere">' . nl2br(picEmailEscape($value)) . '</td>'
                . '</tr></table></td></tr>';
        }
        $cards .= '<tr><td style="height:10px"></td></tr></table></td></tr>';
    }

    return '<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . picEmailEscape($heading) . '</title></head>'
        . '<body style="margin:0;padding:0;background:#f5f3ee;color:#252923;font-family:Arial,sans-serif">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ee"><tr><td align="center" style="padding:32px 12px">'
        . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e9e5dc;border-radius:16px">'
        . '<tr><td style="padding:25px 28px;border-bottom:1px solid #e9e5dc;color:#74510a;font:700 20px Arial,sans-serif">PoliSpace</td></tr>'
        . '<tr><td style="padding:28px 28px 22px"><span style="display:inline-block;padding:7px 11px;border-radius:99px;background:#f7f0df;color:' . $accent . ';font:700 11px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase">' . picEmailEscape($eyebrow) . '</span>'
        . '<h1 style="margin:18px 0 10px;color:#252923;font:700 26px/1.25 Arial,sans-serif">' . picEmailEscape($heading) . '</h1>'
        . '<p style="margin:0;color:#555a53;font:15px/1.65 Arial,sans-serif">' . picEmailEscape($intro) . '</p></td></tr>'
        . $cards
        . '<tr><td style="padding:4px 28px 28px;color:#68665f;font:13px/1.6 Arial,sans-serif">Terima kasih,<br><strong style="color:#252923">Pasukan PoliSpace</strong></td></tr>'
        . '</table><p style="max-width:600px;margin:18px 0;color:#77776f;font:12px/1.5 Arial,sans-serif">E-mel automatik daripada PoliSpace. Sila hubungi pentadbir jika maklumat tempahan tidak tepat.</p>'
        . '</td></tr></table></body></html>';
}

function bookingPicEmailHtml(array $booking, string $type): string
{
    $date = (string)($booking['booking_date'] ?? '');
    $displayDate = $date !== '' ? date('d M Y', strtotime($date)) : '-';
    $time = substr((string)($booking['start_time'] ?? ''), 0, 5);
    $sections = [
        ['title' => 'Maklumat tempahan', 'rows' => [
            'No. rujukan' => $booking['booking_ref'] ?: '-',
            'Fasiliti' => $booking['facility_name'] ?: '-',
            'Tarikh' => $displayDate,
            'Masa mula' => $time ?: '-',
            'Tempoh' => bookingDurationLabel($booking),
            'Jumlah pengguna' => (string)($booking['participant_count'] ?? 0),
            'Tujuan' => $booking['purpose'] ?: '-',
        ]],
        ['title' => 'Maklumat pelanggan', 'rows' => [
            'Nama' => $booking['full_name'] ?: '-',
            'Jenis pemohon' => ($booking['account_type'] ?? 'public') === 'staff' ? 'Kakitangan' : 'Orang Awam',
            'Telefon' => $booking['phone'] ?: '-',
            'E-mel' => $booking['email'] ?: '-',
            'Bayaran diperlukan' => !empty($booking['payment_required']) ? 'Ya' : 'Tidak',
        ]],
    ];
    if ($type === 'approved') {
        $sections[] = ['title' => 'Persediaan', 'rows' => [
            'Peralatan diminta' => trim((string)($booking['equipment_required'] ?? '')) ?: 'Tiada',
        ]];
        return picEmailLayout('Tempahan diluluskan', 'Sila sediakan fasiliti',
            !empty($booking['payment_required'])
                ? 'Bayaran pelanggan telah disahkan dan tempahan ini telah diluluskan. Sila buat persediaan mengikut maklumat di bawah.'
                : 'Tempahan ini telah diluluskan tanpa bayaran. Sila buat persediaan mengikut maklumat di bawah.', $sections, '#477447');
    }
    $sections[] = ['title' => 'Pembatalan', 'rows' => [
        'Sebab' => trim((string)($booking['cancellation_reason'] ?? '')) ?: '-',
    ]];
    return picEmailLayout('Tempahan dibatalkan', 'Persediaan tidak diperlukan',
        'Tempahan ini telah dibatalkan oleh pentadbir. PIC tidak perlu lagi membuat persediaan bagi tempahan ini.', $sections, '#a25035');
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

    $sent = $emailSender !== null
        ? $emailSender($picEmail, $subject, $body)
        : sendHtmlEmail($picEmail, $subject, $body, bookingPicEmailHtml($booking, $type));
    if (!$sent) {
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

    $html = picEmailLayout('Ujian e-mel PIC', 'Sambungan e-mel berjaya',
        'Alamat e-mel ini akan menerima pemberitahuan apabila tempahan diluluskan atau dibatalkan.', [
            ['title' => 'Maklumat PIC', 'rows' => [
                'Nama' => ($pic['full_name'] ?? '') ?: '-',
                'Telefon' => ($pic['phone'] ?? '') ?: '-',
                'Fasiliti diuruskan' => $facilityNames !== '' ? $facilityNames : 'Tiada PIC ditetapkan',
            ]],
        ]);
    return sendHtmlEmail($email, 'PoliSpace — Ujian E-mel PIC', $body, $html);
}
?>
