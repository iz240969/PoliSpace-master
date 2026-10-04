<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/validation.php';
require_once __DIR__ . '/../includes/booking_availability.php';
require_once __DIR__ . '/../includes/pic_mail.php';
require_once __DIR__ . '/../includes/account_types.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
ensureAccountTypeSchema($db, true);
ensureBookingEquipmentColumn($db);
ensureBookingCartGroupColumn($db);
ensureBookingDurationUnitColumn($db);
ensureBookingAsramaColumns($db);
ensureBookingFacilityMaxRoomsColumn($db);

try {
    if ($method === 'GET') {
        if ($action === 'user') {
            getUserBookings($db, (string)($_GET['email'] ?? ''));
        } elseif ($action === 'ref' && isset($_GET['ref'])) {
            getBookingByRef($db, (string)$_GET['ref']);
        } elseif ($action === 'public-stats') {
            getPublicStats($db);
        } elseif ($action === 'calendar') {
            getPublicCalendarBookings($db);
        } elseif ($action === 'report') {
            requireAdmin();
            getAdminReport($db, (string)($_GET['period'] ?? 'all'));
        } elseif ($action === 'stats') {
            requireAdmin();
            getDashboardStats($db);
        } else {
            requireAdmin();
            getAllBookings($db, $_GET['status'] ?? null);
        }
    }

    if ($method === 'PUT' && $action === 'status' && isset($_GET['id'])) {
        $input = jsonInput();
        if (!empty($_SESSION['admin_id'])) {
            requireAdmin();
            updateBookingStatus($db, (string)$_GET['id'], $input);
        } else {
            cancelOwnBooking($db, (string)$_GET['id'], $input);
        }
    }

    if ($method === 'PUT' && $action === 'user-update' && isset($_GET['id'])) {
        $input = jsonInput();
        updateOwnPendingBooking($db, (string)$_GET['id'], $input);
    }

    if ($method === 'POST' && $action === 'receipt' && isset($_GET['id'])) {
        uploadOwnReceipt($db, (string)$_GET['id']);
    }

    if ($method === 'POST' && $action === 'admin-create') {
        createBooking($db, true);
    }

    if ($method === 'POST') {
        createBooking($db);
    }

    if ($method === 'DELETE' && isset($_GET['id'])) {
        requireAdmin();
        deleteBooking($db, (string)$_GET['id']);
    }

    jsonResponse(['success' => false, 'error' => 'Invalid booking request'], 400);
} catch (BookingAvailabilityException $e) {
    jsonResponse(['success' => false, 'error' => $e->getMessage()], $e->httpStatus());
} catch (PDOException $e) {
    if ($e->getCode() === '23000' && str_contains($e->getMessage(), 'uniq_blocking_facility_date')) {
        jsonResponse([
            'success' => false,
            'error' => 'Tarikh ini telah dikunci oleh tempahan berbayar. Sila pilih tarikh lain.',
        ], 409);
    }
    $message = defined('APP_DEBUG') && APP_DEBUG ? $e->getMessage() : 'Booking request failed';
    jsonResponse(['success' => false, 'error' => $message], 500);
} catch (Throwable $e) {
    $message = defined('APP_DEBUG') && APP_DEBUG ? $e->getMessage() : 'Booking request failed';
    jsonResponse(['success' => false, 'error' => $message], 500);
}

function getAllBookings(Database $db, mixed $status = null): void
{
    $sql = "SELECT b.*, f.name AS facility_name, f.icon, p.full_name AS pic_full_name, p.phone AS pic_phone
            FROM bookings b
            LEFT JOIN facilities f ON b.facility_id = f.id
            LEFT JOIN pics p ON f.pic_id = p.id";
    $params = [];

    if ($status === 'unpaid') {
        jsonResponse(['success' => true, 'data' => []]);
    }

    if ($status && in_array($status, ['pending', 'approved', 'rejected', 'cancelled'], true)) {
        $sql .= ' WHERE b.status = ?';
        $params[] = $status;
    } else {
        $sql .= " WHERE b.status <> 'unpaid'";
    }

    $sql .= ' ORDER BY b.created_at DESC';
    $bookings = array_map('formatBookingForFrontend', $db->fetchAll($sql, $params));
    jsonResponse(['success' => true, 'data' => $bookings]);
}

function getAdminReport(Database $db, string $period): void
{
    if (!in_array($period, ['all', 'month', 'year'], true)) {
        jsonResponse(['success' => false, 'error' => 'Invalid report period'], 400);
    }

    $where = '';
    $params = [];
    $periodStart = null;
    $periodEnd = null;
    $now = new DateTimeImmutable('now');

    if ($period === 'month') {
        $start = $now->modify('first day of this month')->setTime(0, 0);
        $end = $start->modify('+1 month');
        $periodStart = $start->format('Y-m-d');
        $periodEnd = $end->format('Y-m-d');
    } elseif ($period === 'year') {
        $start = $now->setDate((int)$now->format('Y'), 1, 1)->setTime(0, 0);
        $end = $start->modify('+1 year');
        $periodStart = $start->format('Y-m-d');
        $periodEnd = $end->format('Y-m-d');
    }

    if ($periodStart !== null && $periodEnd !== null) {
        $where = ' WHERE b.created_at >= ? AND b.created_at < ?';
        $params = [$periodStart, $periodEnd];
    }

    $summary = $db->fetchOne(
        "SELECT COUNT(*) AS total,
                SUM(CASE WHEN b.status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid,
                SUM(CASE WHEN b.status = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN b.status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN b.status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
                SUM(CASE WHEN b.status IN ('pending', 'approved') THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN b.payment_required = TRUE AND b.payment_file IS NOT NULL AND b.payment_file <> '' THEN 1 ELSE 0 END) AS evidence_count,
                SUM(CASE WHEN b.payment_required = TRUE AND b.status = 'approved' AND (b.payment_file IS NULL OR b.payment_file = '') THEN 1 ELSE 0 END) AS approved_without_evidence,
                SUM(CASE WHEN b.payment_required = TRUE THEN 1 ELSE 0 END) AS payment_required_count,
                SUM(CASE WHEN b.payment_required = FALSE THEN 1 ELSE 0 END) AS payment_exempt_count,
                SUM(CASE WHEN b.account_type = 'public' THEN 1 ELSE 0 END) AS public_count,
                SUM(CASE WHEN b.account_type = 'staff' THEN 1 ELSE 0 END) AS staff_count,
                COALESCE(SUM(CASE WHEN b.payment_required = TRUE AND b.status = 'approved' THEN b.estimated_cost ELSE 0 END), 0) AS approved_estimated_value,
                COALESCE(SUM(CASE WHEN b.payment_required = TRUE AND b.status = 'pending' THEN b.estimated_cost ELSE 0 END), 0) AS pending_estimated_value
         FROM bookings b" . $where,
        $params
    ) ?: [];

    $countFields = ['total', 'unpaid', 'pending', 'approved', 'rejected', 'cancelled', 'active', 'evidence_count', 'approved_without_evidence', 'payment_required_count', 'payment_exempt_count', 'public_count', 'staff_count'];
    foreach ($countFields as $field) {
        $summary[$field] = (int)($summary[$field] ?? 0);
    }
    $summary['approved_estimated_value'] = (string)($summary['approved_estimated_value'] ?? '0.00');
    $summary['pending_estimated_value'] = (string)($summary['pending_estimated_value'] ?? '0.00');

    $bookings = $db->fetchAll(
        "SELECT b.*, f.name AS facility_name, f.icon, p.full_name AS pic_full_name, p.phone AS pic_phone
         FROM bookings b
         LEFT JOIN facilities f ON b.facility_id = f.id
         LEFT JOIN pics p ON f.pic_id = p.id" . $where . '
         ORDER BY b.created_at DESC',
        $params
    );

    jsonResponse([
        'success' => true,
        'data' => [
            'period' => $period,
            'period_start' => $periodStart,
            'period_end' => $periodEnd,
            'generated_at' => date(DATE_ATOM),
            'summary' => $summary,
            'bookings' => array_map('formatBookingForFrontend', $bookings),
        ],
    ]);
}

function getUserBookings(Database $db, string $email = ''): void
{
    $user = requireUserAccount($db);
    $userId = (int)$user['id'];
    $sessionEmail = (string)$user['email'];

    if ($email !== '' && strtolower($sessionEmail) !== strtolower($email)) {
        jsonResponse(['success' => false, 'error' => 'You can only view your own bookings'], 403);
    }

    $bookings = $db->fetchAll(
        "SELECT b.*, f.name AS facility_name, f.icon, p.full_name AS pic_full_name, p.phone AS pic_phone
         FROM bookings b
         LEFT JOIN facilities f ON b.facility_id = f.id
         LEFT JOIN pics p ON f.pic_id = p.id
         WHERE b.user_id = ? OR LOWER(b.email) = LOWER(?)
         ORDER BY b.created_at DESC",
        [$userId, $sessionEmail]
    );

    jsonResponse(['success' => true, 'data' => array_map('formatBookingForFrontend', $bookings)]);
}

function getBookingByRef(Database $db, string $ref): void
{
    $isAdmin = !empty($_SESSION['admin_id']) && empty($_SESSION['user_id']);
    $isUser = !empty($_SESSION['user_id']) && empty($_SESSION['admin_id']) && !empty($_SESSION['user_email']);
    if ($isUser) {
        requireUserAccount($db);
    }
    if (!$isAdmin && !$isUser) {
        jsonResponse(['success' => false, 'error' => 'Login required'], 401);
    }

    $booking = $db->fetchOne(
        "SELECT b.*, f.name AS facility_name, f.icon, p.full_name AS pic_full_name, p.phone AS pic_phone
         FROM bookings b
         LEFT JOIN facilities f ON b.facility_id = f.id
         LEFT JOIN pics p ON f.pic_id = p.id
         WHERE b.booking_ref = ?",
        [$ref]
    );

    if (!$booking) {
        $groupBookings = $db->fetchAll(
            "SELECT b.*, f.name AS facility_name, f.icon, p.full_name AS pic_full_name, p.phone AS pic_phone
             FROM bookings b
             LEFT JOIN facilities f ON b.facility_id = f.id
             LEFT JOIN pics p ON f.pic_id = p.id
             WHERE b.cart_group_ref = ?
             ORDER BY b.booking_date ASC, b.start_time ASC, b.created_at DESC",
            [$ref]
        );

        if (!$groupBookings) {
            jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
        }

        if ($isAdmin) {
            $groupBookings = array_values(array_filter(
                $groupBookings,
                static fn(array $item): bool => (string)$item['status'] !== 'unpaid'
            ));
            if (!$groupBookings) {
                jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
            }
        }

        if (!$isAdmin) {
            foreach ($groupBookings as $groupBooking) {
                if (strtolower((string)$groupBooking['email']) !== strtolower((string)$_SESSION['user_email'])) {
                    jsonResponse(['success' => false, 'error' => 'You can only view your own booking'], 403);
                }
            }
        }

        jsonResponse([
            'success' => true,
            'data' => [
                'type' => 'group',
                'id' => $ref,
                'cartGroupRef' => $ref,
                'bookings' => array_map('formatBookingForFrontend', $groupBookings),
            ],
        ]);
    }

    if ($isAdmin && (string)$booking['status'] === 'unpaid') {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    if (!$isAdmin
        && strtolower((string)$booking['email']) !== strtolower((string)$_SESSION['user_email'])) {
        jsonResponse(['success' => false, 'error' => 'You can only view your own booking'], 403);
    }

    jsonResponse(['success' => true, 'data' => formatBookingForFrontend($booking)]);
}

function createBooking(Database $db, bool $adminCreate = false): void
{
    $userAccount = null;
    $userId = 0;
    $userEmail = '';
    $bookingAccountType = ACCOUNT_TYPE_PUBLIC;
    $paymentRequired = true;
    if ($adminCreate) {
        requireAdmin();
    } else {
        $userAccount = requireUserAccount($db);
        $userId = (int)$userAccount['id'];
        $userEmail = (string)$userAccount['email'];
    }

    $data = $_POST ?: jsonInput();
    if ($adminCreate) {
        $data['email'] = trim((string)($data['email'] ?? ''));
        $data['full_name'] = trim((string)($data['full_name'] ?? ''));
        $data['phone'] = trim((string)($data['phone'] ?? ''));
        $matchedUser = filter_var((string)$data['email'], FILTER_VALIDATE_EMAIL)
            ? $db->fetchOne(
                "SELECT id, account_type, staff_verification_status FROM users WHERE email = ? AND role = 'user'",
                [$data['email']]
            )
            : null;
        $userId = $matchedUser ? (int)$matchedUser['id'] : 0;
        if ($matchedUser) {
            $bookingAccountType = normalizedAccountType($matchedUser['account_type'] ?? '');
            $paymentRequired = !isVerifiedStaffAccount($matchedUser);
        }
    } else {
        $data['email'] = (string)$userAccount['email'];
        $data['full_name'] = trim((string)($userAccount['full_name'] ?? ''));
        $data['phone'] = trim((string)($userAccount['phone'] ?? ''));
        $bookingAccountType = normalizedAccountType($userAccount['account_type'] ?? '');
        $paymentRequired = !isVerifiedStaffAccount($userAccount);
    }
    $facility = null;
    if (!empty($data['facility_id']) && ctype_digit((string)$data['facility_id'])) {
        $facility = $db->fetchOne('SELECT name, capacity, price_per_hour, max_rooms, is_available FROM facilities WHERE id = ?', [$data['facility_id']]);
        if ($facility && isAsramaRoomFacilityName((string)$facility['name'])) {
            $data['start_time'] = '00:00';
            $data['end_time'] = '';
            $data['equipment_required'] = '';
            $data['participant_count'] = 1;
        }
    }
    $errors = validateBookingData($data);

    if ($errors) {
        jsonResponse(['success' => false, 'error' => array_values($errors)[0], 'details' => $errors], 400);
    }

    $ref = generateBookingRef();
    if (!$facility) {
        $facility = $db->fetchOne('SELECT name, capacity, price_per_hour, max_rooms, is_available FROM facilities WHERE id = ?', [$data['facility_id']]);
    }
    if (!$facility) {
        jsonResponse(['success' => false, 'error' => 'Facility not found'], 404);
    }
    if (!(bool)$facility['is_available']) {
        jsonResponse(['success' => false, 'error' => 'Fasiliti ini tidak tersedia untuk tempahan.'], 409);
    }
    $isAsramaFacility = isAsramaRoomFacilityName((string)$facility['name']);
    $durationUnitError = bookingFacilityDurationUnitError(
        $isAsramaFacility,
        (string)($data['duration_unit'] ?? 'hour')
    );
    if ($durationUnitError !== null) {
        jsonResponse(['success' => false, 'error' => $durationUnitError], 400);
    }
    if (!$isAsramaFacility && (int)$data['participant_count'] > (int)$facility['capacity']) {
        jsonResponse(['success' => false, 'error' => 'Jumlah pengguna melebihi kapasiti fasiliti.'], 400);
    }
    $packageOnlyFacilities = ['dewan utama', 'dewan syarahan', 'bilik persidangan', 'bilik seminar'];
    if ($facility && in_array(strtolower((string)$facility['name']), $packageOnlyFacilities, true)) {
        $data['setup_required'] = 'full';
    }
    if ($isAsramaFacility) {
        $data['start_time'] = '00:00';
        $data['end_time'] = '';
        $data['equipment_required'] = '';
        validateAsramaBookingMeta($data, ASRAMA_TOTAL_ROOM_LIMIT_MAX);
        $data['asrama_type'] = normalizeAsramaTypeFromRooms($data);
        $data['room_count'] = normalizeAsramaRoomCount($data['room_count'] ?? 1, ASRAMA_TOTAL_ROOM_LIMIT_MAX);
        $data['participant_count'] = $data['room_count'] * max(1, (int)$facility['capacity']);
    }

    $paymentFile = null;
    $autoCancelledCount = 0;
    $bookingStatus = $adminCreate ? 'approved' : ($paymentRequired ? 'unpaid' : 'pending');
    $hasPaymentFile = (!empty($_FILES['payment_file']) && $_FILES['payment_file']['error'] !== UPLOAD_ERR_NO_FILE)
        || array_key_exists('payment_file_base64', $data);
    if (isset($_FILES['payment_file']) && $_FILES['payment_file']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['success' => false, 'error' => 'Receipt upload failed'], 400);
    }
    if ($hasPaymentFile && !$paymentRequired) {
        jsonResponse(['success' => false, 'error' => 'Payment evidence is not accepted for verified staff bookings'], 400);
    }
    if ($hasPaymentFile && !$adminCreate) $bookingStatus = 'pending';

    $requestedBookingDates = bookingBlockedDates(
        (string)$data['booking_date'],
        $data['duration'] ?? '1',
        (string)($data['duration_unit'] ?? 'hour')
    );

    withFacilityBookingDateLocks($db, (int)$data['facility_id'], $requestedBookingDates, function () use (
        $db,
        $data,
        $requestedBookingDates,
        $userId,
        $ref,
        $hasPaymentFile,
        $bookingStatus,
        $bookingAccountType,
        $paymentRequired,
        &$paymentFile,
        &$autoCancelledCount
    ): void {
        $latestFacility = $db->fetchOne('SELECT name, capacity, price_per_hour, max_rooms, is_available FROM facilities WHERE id = ?', [$data['facility_id']]);
        if (!$latestFacility || !(bool)$latestFacility['is_available']) {
            throw new BookingAvailabilityException('Fasiliti ini tidak tersedia untuk tempahan.');
        }
        $latestIsAsramaFacility = isAsramaRoomFacilityName((string)$latestFacility['name']);
        $durationUnitError = bookingFacilityDurationUnitError(
            $latestIsAsramaFacility,
            (string)($data['duration_unit'] ?? 'hour')
        );
        if ($durationUnitError !== null) {
            throw new BookingAvailabilityException($durationUnitError, 400);
        }
        if (!$latestIsAsramaFacility && (int)$data['participant_count'] > (int)$latestFacility['capacity']) {
            throw new BookingAvailabilityException('Jumlah pengguna melebihi kapasiti fasiliti.', 400);
        }
        if ($latestIsAsramaFacility) {
            validateAsramaBookingMeta($data, ASRAMA_TOTAL_ROOM_LIMIT_MAX);
            $data['asrama_type'] = normalizeAsramaTypeFromRooms($data);
            assertAsramaCapacityAvailable(
                $db,
                (int)$data['facility_id'],
                $requestedBookingDates,
                (int)($data['asrama_lelaki_rooms'] ?? 0),
                (int)($data['asrama_perempuan_rooms'] ?? 0)
            );
        } else {
            assertBookingDatesAvailable($db, (int)$data['facility_id'], $requestedBookingDates);
        }

        if ($hasPaymentFile) {
            $upload = handlePaymentEvidenceUpload($data);
            if (!empty($upload['error'])) {
                throw new BookingAvailabilityException((string)$upload['error'], 400);
            }
            $paymentFile = $upload['filename'];
        }

        try {
            $db->transaction(function () use ($db, $data, $userId, $ref, $bookingAccountType, $paymentRequired, $paymentFile, $bookingStatus, $latestFacility, &$autoCancelledCount): void {
                $createdId = (int)$db->insert(
                "INSERT INTO bookings (
                    booking_ref, user_id, account_type, payment_required, facility_id, full_name, organization, email, phone,
                    booking_date, start_time, end_time, duration, duration_unit, purpose, participant_count,
                    setup_required, equipment_required, asrama_type, asrama_lelaki_rooms, asrama_perempuan_rooms,
                    room_count, payment_file, status, estimated_cost, cart_group_ref
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    $ref,
                    $userId > 0 ? $userId : null,
                    $bookingAccountType,
                    $paymentRequired ? 1 : 0,
                    $data['facility_id'],
                    $data['full_name'],
                    $data['organization'] ?? '',
                    $data['email'],
                    $data['phone'],
                    $data['booking_date'],
                    $data['start_time'],
                    $data['end_time'] ?? null,
                    $data['duration'] ?? '1',
                    $data['duration_unit'] ?? 'hour',
                    $data['purpose'],
                    $data['participant_count'] ?? 0,
                    $data['setup_required'] ?? 'none',
                    $data['equipment_required'] ?? '',
                    normalizeAsramaType((string)($data['asrama_type'] ?? '')),
                    (int)($data['asrama_lelaki_rooms'] ?? 0),
                    (int)($data['asrama_perempuan_rooms'] ?? 0),
                    (int)($data['room_count'] ?? 1),
                    $paymentFile,
                    $bookingStatus,
                    bookingEstimatedCost(
                        (float)$latestFacility['price_per_hour'],
                        (int)($data['duration'] ?? 1),
                        (string)($data['duration_unit'] ?? 'hour'),
                        (int)($data['room_count'] ?? 1)
                    ),
                    trim((string)($data['cart_group_ref'] ?? '')),
                ]
                );
                if ($bookingStatus === 'approved') {
                    $autoCancelledCount = cancelSupersededUnpaidBookings($db, [
                        'id' => $createdId,
                        'facility_id' => $data['facility_id'],
                        'facility_name' => $latestFacility['name'],
                        'booking_date' => $data['booking_date'],
                        'duration' => $data['duration'] ?? '1',
                        'duration_unit' => $data['duration_unit'] ?? 'hour',
                    ]);
                }
            });
        } catch (Throwable $e) {
            if ($paymentFile) {
                $uploadedPath = UPLOAD_DIR . basename($paymentFile);
                if (is_file($uploadedPath)) unlink($uploadedPath);
            }
            throw $e;
        }
    });

    $response = ['success' => true, 'message' => 'Booking created successfully', 'booking_ref' => $ref];
    if ($autoCancelledCount > 0) $response['auto_cancelled_unpaid_count'] = $autoCancelledCount;
    if ($bookingStatus === 'approved') {
        try {
            $created = $db->fetchOne('SELECT id FROM bookings WHERE booking_ref = ?', [$ref]);
            $notification = $created
                ? sendBookingPicNotification($db, (int)$created['id'], 'approved')
                : ['sent' => false, 'skipped' => false, 'warning' => 'Tempahan berjaya dibuat, tetapi e-mel kepada PIC gagal dihantar.'];
        } catch (Throwable $e) {
            $notification = ['sent' => false, 'skipped' => false, 'warning' => 'Tempahan berjaya dibuat, tetapi e-mel kepada PIC gagal dihantar.'];
        }
        $response['notification'] = $notification;
        if (!empty($notification['warning'])) {
            $response['warning'] = $notification['warning'];
        }
    }

    jsonResponse($response);
}

function updateBookingStatus(Database $db, string $id, array $data): void
{
    $status = $data['status'] ?? '';
    $adminNote = trim((string)($data['admin_note'] ?? ''));
    $cancellationReason = trim((string)($data['cancellation_reason'] ?? ''));

    if (!in_array($status, ['approved', 'rejected', 'cancelled'], true)) {
        jsonResponse(['success' => false, 'error' => 'Invalid status'], 400);
    }

    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $booking = $db->fetchOne("SELECT id, facility_id, booking_date, duration, duration_unit FROM bookings WHERE {$field} = ?", [$id]);
    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    if ($status === 'rejected' && $adminNote === '') {
        jsonResponse(['success' => false, 'error' => 'Rejection reason required'], 400);
    }
    if ($status === 'cancelled' && $cancellationReason === '') {
        jsonResponse(['success' => false, 'error' => 'Sebab pembatalan diperlukan.'], 400);
    }

    $bookingDates = bookingBlockedDates(
        (string)$booking['booking_date'],
        $booking['duration'] ?? '1',
        (string)($booking['duration_unit'] ?? 'hour')
    );

    $updatedBookingId = 0;
    $autoCancelledCount = 0;
    withBookingMutationLocks($db, (int)$booking['id'], (int)$booking['facility_id'], $bookingDates, false, function () use (
        $db,
        $field,
        $id,
        $status,
        $adminNote,
        $cancellationReason,
        &$updatedBookingId,
        &$autoCancelledCount
    ): void {
        $current = $db->fetchOne(
            "SELECT b.id, b.status, b.payment_file, b.payment_required, b.account_type,
                    b.facility_id, b.booking_date, b.duration, b.duration_unit,
                    b.asrama_lelaki_rooms, b.asrama_perempuan_rooms, f.name AS facility_name
             FROM bookings b
             JOIN facilities f ON f.id = b.facility_id
             WHERE b.{$field} = ?",
            [$id]
        );
        if (!$current) {
            throw new BookingAvailabilityException('Booking not found', 404);
        }

        $transitionError = bookingStatusTransitionError((string)$current['status'], (string)$status);
        if ($transitionError !== null) {
            throw new BookingAvailabilityException($transitionError);
        }
        if (in_array($status, BLOCKING_BOOKING_STATUSES, true)) {
            if ((bool)$current['payment_required'] && empty($current['payment_file'])) {
                throw new BookingAvailabilityException('Bukti bayaran perlu dimuat naik sebelum tempahan ini boleh diluluskan.');
            }
            if (!isAsramaRoomFacilityName((string)$current['facility_name'])) {
                assertBookingDatesAvailable(
                    $db,
                    (int)$current['facility_id'],
                    bookingBlockedDates(
                        (string)$current['booking_date'],
                        $current['duration'] ?? '1',
                        (string)($current['duration_unit'] ?? 'hour')
                    ),
                    (int)$current['id']
                );
            }
        }

        if ($status === 'cancelled') {
            $db->update(
                'UPDATE bookings SET status = ?, cancellation_reason = ? WHERE id = ?',
                [$status, $cancellationReason, $current['id']]
            );
        } elseif ($status === 'approved') {
            if (isAsramaRoomFacilityName((string)$current['facility_name'])) {
                ensureAsramaCapacitySettingsTable($db);
            }
            $db->transaction(function () use ($db, $status, $adminNote, $current, &$autoCancelledCount): void {
                $db->update('UPDATE bookings SET status = ?, admin_note = ? WHERE id = ?', [$status, $adminNote, $current['id']]);
                $autoCancelledCount = cancelSupersededUnpaidBookings($db, $current);
            });
        } else {
            $db->update('UPDATE bookings SET status = ?, admin_note = ? WHERE id = ?', [$status, $adminNote, $current['id']]);
        }
        $updatedBookingId = (int)$current['id'];
    });

    $notification = null;
    if ($status === 'approved' || $status === 'cancelled') {
        try {
            $notification = sendBookingPicNotification($db, $updatedBookingId, $status);
        } catch (Throwable $e) {
            $notification = [
                'sent' => false,
                'skipped' => false,
                'warning' => 'Status tempahan berjaya dikemas kini, tetapi e-mel kepada PIC gagal dihantar.',
            ];
        }
    }

    $response = [
        'success' => true,
        'message' => $status === 'cancelled' ? 'Tempahan berjaya dibatalkan.' : 'Booking status updated',
    ];
    if ($autoCancelledCount > 0) $response['auto_cancelled_unpaid_count'] = $autoCancelledCount;
    if ($notification !== null) {
        $response['notification'] = $notification;
        if (!empty($notification['warning'])) {
            $response['warning'] = $notification['warning'];
        }
    }
    jsonResponse($response);
}

function cancelOwnBooking(Database $db, string $id, array $data): void
{
    $status = $data['status'] ?? '';
    if ($status !== 'cancelled') {
        jsonResponse(['success' => false, 'error' => 'Admin login required'], 401);
    }

    $user = requireUserAccount($db);
    $userId = (int)$user['id'];
    $userEmail = (string)$user['email'];

    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $booking = $db->fetchOne("SELECT id, facility_id, booking_date, duration, duration_unit, payment_required FROM bookings WHERE {$field} = ?", [$id]);
    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    withBookingMutationLocks(
        $db,
        (int)$booking['id'],
        (int)$booking['facility_id'],
        bookingBlockedDates(
            (string)$booking['booking_date'],
            $booking['duration'] ?? '1',
            (string)($booking['duration_unit'] ?? 'hour')
        ),
        false,
        function () use (
        $db,
        $field,
        $id,
        $userId,
        $userEmail
    ): void {
        $current = $db->fetchOne("SELECT id, user_id, email, status FROM bookings WHERE {$field} = ?", [$id]);
        if (!$current) {
            throw new BookingAvailabilityException('Booking not found', 404);
        }
        $ownsBooking = (int)$current['user_id'] === $userId
            || strtolower((string)$current['email']) === strtolower($userEmail);
        if (!$ownsBooking) {
            throw new BookingAvailabilityException('You can only cancel your own booking', 403);
        }
        if (!in_array($current['status'], ['unpaid', 'pending'], true)) {
            throw new BookingAvailabilityException('Only unpaid or pending bookings can be cancelled');
        }

        $db->update(
            "UPDATE bookings SET status = 'cancelled', admin_note = ? WHERE id = ?",
            ['Dibatalkan oleh pengguna.', $current['id']]
        );
    });
    jsonResponse(['success' => true, 'message' => 'Booking cancelled']);
}

function updateOwnPendingBooking(Database $db, string $id, array $data): void
{
    $user = requireUserAccount($db);
    $userId = (int)$user['id'];
    $userEmail = (string)$user['email'];

    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $booking = $db->fetchOne("SELECT id, facility_id, booking_date, duration, duration_unit FROM bookings WHERE {$field} = ?", [$id]);
    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    $bookingDate = trim((string)($data['booking_date'] ?? ''));
    $startTime = trim((string)($data['start_time'] ?? ''));
    $endTime = trim((string)($data['end_time'] ?? ''));
    $duration = trim((string)($data['duration'] ?? '1'));
    $durationUnit = trim((string)($data['duration_unit'] ?? 'hour'));
    $purpose = trim((string)($data['purpose'] ?? ''));
    $equipment = trim((string)($data['equipment_required'] ?? ''));
    $participantCount = (int)($data['participant_count'] ?? 0);

    $scheduleErrors = validateBookingScheduleData([
        'booking_date' => $bookingDate,
        'start_time' => $startTime,
        'end_time' => $endTime,
        'duration' => $duration,
        'duration_unit' => $durationUnit,
        'participant_count' => $participantCount,
    ]);
    if ($scheduleErrors) {
        jsonResponse(['success' => false, 'error' => array_values($scheduleErrors)[0], 'details' => $scheduleErrors], 400);
    }

    if ($purpose === '' || strlen($purpose) > 1000) {
        jsonResponse(['success' => false, 'error' => 'Purpose is required'], 400);
    }

    if (!isAllowedBookingEquipment($equipment)) {
        jsonResponse(['success' => false, 'error' => 'Invalid equipment option'], 400);
    }

    $newBookingDates = bookingBlockedDates($bookingDate, $duration, $durationUnit);
    $oldBookingDates = bookingBlockedDates(
        (string)$booking['booking_date'],
        $booking['duration'] ?? '1',
        (string)($booking['duration_unit'] ?? 'hour')
    );

    withBookingMutationLocks(
        $db,
        (int)$booking['id'],
        (int)$booking['facility_id'],
        array_merge($oldBookingDates, $newBookingDates),
        true,
        function () use (
            $db,
            $field,
            $id,
            $userId,
            $userEmail,
            $bookingDate,
            $startTime,
            $endTime,
            $duration,
            $durationUnit,
            $purpose,
            $equipment,
            $participantCount
        ): void {
            $current = $db->fetchOne(
                "SELECT b.id, b.user_id, b.email, b.status, b.facility_id,
                        b.asrama_lelaki_rooms, b.asrama_perempuan_rooms,
                        f.name AS facility_name, f.capacity, f.is_available
                 FROM bookings b
                 JOIN facilities f ON f.id = b.facility_id
                 WHERE b.{$field} = ?",
                [$id]
            );
            if (!$current) {
                throw new BookingAvailabilityException('Booking not found', 404);
            }
            $ownsBooking = (int)$current['user_id'] === $userId
                || strtolower((string)$current['email']) === strtolower($userEmail);
            if (!$ownsBooking) {
                throw new BookingAvailabilityException('You can only edit your own booking', 403);
            }
            if (!in_array($current['status'], ['unpaid', 'pending'], true)) {
                throw new BookingAvailabilityException('Only unpaid or pending bookings can be edited');
            }
            if (!(bool)$current['is_available']) {
                throw new BookingAvailabilityException('Fasiliti ini tidak tersedia untuk tempahan.');
            }
            $isAsramaFacility = isAsramaRoomFacilityName((string)$current['facility_name']);
            $durationUnitError = bookingFacilityDurationUnitError($isAsramaFacility, $durationUnit);
            if ($durationUnitError !== null) {
                throw new BookingAvailabilityException($durationUnitError, 400);
            }
            if (!$isAsramaFacility && $participantCount > (int)$current['capacity']) {
                throw new BookingAvailabilityException('Jumlah pengguna melebihi kapasiti fasiliti.', 400);
            }

            $updatedDates = bookingBlockedDates($bookingDate, $duration, $durationUnit);
            if ($isAsramaFacility) {
                assertAsramaCapacityAvailable(
                    $db,
                    (int)$current['facility_id'],
                    $updatedDates,
                    (int)$current['asrama_lelaki_rooms'],
                    (int)$current['asrama_perempuan_rooms'],
                    (int)$current['id']
                );
            } else {
                assertBookingDatesAvailable(
                    $db,
                    (int)$current['facility_id'],
                    $updatedDates,
                    (int)$current['id']
                );
            }
            $db->update(
                'UPDATE bookings SET booking_date = ?, start_time = ?, end_time = ?, duration = ?, duration_unit = ?, purpose = ?, equipment_required = ?, participant_count = ? WHERE id = ?',
                [$bookingDate, $startTime, $endTime ?: null, $duration, $durationUnit, $purpose, $equipment, $participantCount, $current['id']]
            );
        }
    );

    jsonResponse(['success' => true, 'message' => 'Booking updated']);
}

function ensureBookingEquipmentColumn(Database $db): void
{
    $column = $db->fetchOne("SHOW COLUMNS FROM bookings LIKE 'equipment_required'");
    if (!$column) {
        $db->query('ALTER TABLE bookings ADD COLUMN equipment_required TEXT AFTER setup_required');
    }

    $statusColumn = $db->fetchOne("SHOW COLUMNS FROM bookings LIKE 'status'");
    if ($statusColumn && isset($statusColumn['Type']) && strpos((string)$statusColumn['Type'], "'completed'") !== false) {
        $db->update("UPDATE bookings SET status = 'approved' WHERE status = 'completed'");
        $db->query("ALTER TABLE bookings MODIFY status ENUM('unpaid', 'pending', 'approved', 'rejected', 'cancelled') DEFAULT 'unpaid'");
    }
}

function ensureBookingCartGroupColumn(Database $db): void
{
    static $checked = false;
    if ($checked) return;
    $checked = true;

    $column = $db->fetchOne(
        "SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'bookings'
           AND COLUMN_NAME = 'cart_group_ref'"
    );

    if (!$column) {
        $db->query("ALTER TABLE bookings ADD COLUMN cart_group_ref VARCHAR(32) NULL AFTER booking_ref");
        $db->query("ALTER TABLE bookings ADD INDEX idx_cart_group_ref (cart_group_ref)");
    }
}

function ensureBookingDurationUnitColumn(Database $db): void
{
    static $checked = false;
    if ($checked) return;
    $checked = true;

    $column = $db->fetchOne(
        "SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'bookings'
           AND COLUMN_NAME = 'duration_unit'"
    );

    if (!$column) {
        $db->query("ALTER TABLE bookings ADD COLUMN duration_unit ENUM('hour', 'day') NOT NULL DEFAULT 'hour' AFTER duration");
    }
}

function ensureBookingAsramaColumns(Database $db): void
{
    static $checked = false;
    if ($checked) return;
    $checked = true;

    $asramaTypeColumn = $db->fetchOne(
        "SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'bookings'
           AND COLUMN_NAME = 'asrama_type'"
    );
    if (!$asramaTypeColumn) {
        $db->query('ALTER TABLE bookings ADD COLUMN asrama_type VARCHAR(30) NULL AFTER equipment_required');
    }

    $roomCountColumn = $db->fetchOne(
        "SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'bookings'
           AND COLUMN_NAME = 'room_count'"
    );
    if (!$roomCountColumn) {
        $db->query('ALTER TABLE bookings ADD COLUMN room_count INT NOT NULL DEFAULT 1 AFTER asrama_type');
    }

    $lelakiRoomsColumn = $db->fetchOne(
        "SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'bookings'
           AND COLUMN_NAME = 'asrama_lelaki_rooms'"
    );
    if (!$lelakiRoomsColumn) {
        $db->query('ALTER TABLE bookings ADD COLUMN asrama_lelaki_rooms INT NOT NULL DEFAULT 0 AFTER asrama_type');
    }

    $perempuanRoomsColumn = $db->fetchOne(
        "SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'bookings'
           AND COLUMN_NAME = 'asrama_perempuan_rooms'"
    );
    if (!$perempuanRoomsColumn) {
        $db->query('ALTER TABLE bookings ADD COLUMN asrama_perempuan_rooms INT NOT NULL DEFAULT 0 AFTER asrama_lelaki_rooms');
    }
}

function ensureBookingFacilityMaxRoomsColumn(Database $db): void
{
    static $checked = false;
    if ($checked) return;
    $checked = true;

    $column = $db->fetchOne(
        "SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'facilities'
           AND COLUMN_NAME = 'max_rooms'"
    );
    if (!$column) {
        $db->query('ALTER TABLE facilities ADD COLUMN max_rooms INT NULL AFTER price_per_hour');
    }

    $db->update("UPDATE facilities SET max_rooms = 10 WHERE LOWER(name) LIKE '%asrama%' AND LOWER(name) LIKE '%bilik%' AND (max_rooms IS NULL OR max_rooms < 1)");
}

function isAsramaRoomFacilityName(string $name): bool
{
    $normalized = strtolower($name);
    return strpos($normalized, 'asrama') !== false && strpos($normalized, 'bilik') !== false;
}

function normalizeAsramaType(string $value): string
{
    $types = array_values(array_unique(array_filter(array_map('trim', explode(',', strtolower($value))))));
    $allowed = ['lelaki', 'perempuan'];
    $types = array_values(array_filter($types, static fn(string $type): bool => in_array($type, $allowed, true)));
    sort($types);
    return implode(',', $types);
}

function normalizeAsramaRoomCount(mixed $value, int $maxRooms): int
{
    $maxRooms = max(1, $maxRooms);
    return min($maxRooms, max(1, (int)$value));
}

function normalizeAsramaTypeFromRooms(array $data): string
{
    $types = [];
    if ((int)($data['asrama_lelaki_rooms'] ?? 0) > 0) $types[] = 'lelaki';
    if ((int)($data['asrama_perempuan_rooms'] ?? 0) > 0) $types[] = 'perempuan';
    return implode(',', $types);
}

function validateAsramaBookingMeta(array $data, int $maxRooms): void
{
    $lelakiRooms = strictIntegerInput($data['asrama_lelaki_rooms'] ?? 0);
    $perempuanRooms = strictIntegerInput($data['asrama_perempuan_rooms'] ?? 0);
    $roomCount = strictIntegerInput($data['room_count'] ?? null);
    if ($lelakiRooms === null || $perempuanRooms === null || $roomCount === null) {
        throw new BookingAvailabilityException('Bilangan bilik mesti menggunakan nombor bulat yang sah.', 400);
    }
    $type = normalizeAsramaTypeFromRooms($data) ?: normalizeAsramaType((string)($data['asrama_type'] ?? ''));
    if ($type === '') {
        throw new BookingAvailabilityException('Sila pilih Asrama Lelaki, Asrama Perempuan, atau kedua-duanya.', 400);
    }

    $maxRooms = max(1, $maxRooms);
    if ($lelakiRooms < 0 || $perempuanRooms < 0 || $roomCount < 1 || $roomCount > $maxRooms) {
        throw new BookingAvailabilityException("Bilangan bilik mesti antara 1 hingga {$maxRooms}.", 400);
    }
    if (($lelakiRooms + $perempuanRooms) !== $roomCount) {
        throw new BookingAvailabilityException('Jumlah bilik lelaki dan perempuan mesti sepadan dengan bilangan bilik.', 400);
    }
}

function uploadOwnReceipt(Database $db, string $id): void
{
    $user = requireUserAccount($db);
    $userId = (int)$user['id'];
    $userEmail = (string)$user['email'];

    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $booking = $db->fetchOne("SELECT id, facility_id, booking_date, duration, duration_unit FROM bookings WHERE {$field} = ?", [$id]);
    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    $receiptData = jsonInput();
    if ((empty($_FILES['payment_file']) || $_FILES['payment_file']['error'] !== UPLOAD_ERR_OK)
        && !array_key_exists('payment_file_base64', $receiptData)) {
        jsonResponse(['success' => false, 'error' => 'Receipt upload is required'], 400);
    }

    $paymentFile = withBookingMutationLocks(
        $db,
        (int)$booking['id'],
        (int)$booking['facility_id'],
        bookingBlockedDates(
            (string)$booking['booking_date'],
            $booking['duration'] ?? '1',
            (string)($booking['duration_unit'] ?? 'hour')
        ),
        true,
        function () use ($db, $field, $id, $userId, $userEmail, $receiptData): string {
            $current = $db->fetchOne(
                "SELECT b.id, b.user_id, b.email, b.status, b.payment_file, b.payment_required, b.facility_id,
                        b.booking_date, b.start_time, b.end_time, b.duration, b.duration_unit, b.participant_count,
                        b.asrama_lelaki_rooms, b.asrama_perempuan_rooms,
                        f.name AS facility_name, f.is_available
                 FROM bookings b
                 JOIN facilities f ON f.id = b.facility_id
                 WHERE b.{$field} = ?",
                [$id]
            );
            if (!$current) {
                throw new BookingAvailabilityException('Booking not found', 404);
            }
            $ownsBooking = (int)$current['user_id'] === $userId
                || strtolower((string)$current['email']) === strtolower($userEmail);
            if (!$ownsBooking) {
                throw new BookingAvailabilityException('You can only update your own booking', 403);
            }
            if ($current['status'] !== 'unpaid') {
                throw new BookingAvailabilityException('Receipt can only be uploaded for unpaid bookings');
            }
            if (!(bool)$current['payment_required']) {
                throw new BookingAvailabilityException('Payment is not required for this staff booking', 400);
            }
            if (!(bool)$current['is_available']) {
                throw new BookingAvailabilityException('Fasiliti ini tidak tersedia untuk tempahan.');
            }

            $scheduleErrors = validateBookingScheduleData([
                'booking_date' => $current['booking_date'],
                'start_time' => substr((string)$current['start_time'], 0, 5),
                'end_time' => $current['end_time'] ? substr((string)$current['end_time'], 0, 5) : '',
                'duration' => $current['duration'] ?? '1',
                'duration_unit' => $current['duration_unit'] ?? 'hour',
                'participant_count' => $current['participant_count'],
            ], false);
            if ($scheduleErrors) {
                throw new BookingAvailabilityException(array_values($scheduleErrors)[0], 400);
            }

            $receiptDates = bookingBlockedDates(
                (string)$current['booking_date'],
                $current['duration'] ?? '1',
                (string)($current['duration_unit'] ?? 'hour')
            );
            if (isAsramaRoomFacilityName((string)$current['facility_name'])) {
                assertAsramaCapacityAvailable(
                    $db,
                    (int)$current['facility_id'],
                    $receiptDates,
                    (int)$current['asrama_lelaki_rooms'],
                    (int)$current['asrama_perempuan_rooms'],
                    (int)$current['id']
                );
            } else {
                assertBookingDatesAvailable(
                    $db,
                    (int)$current['facility_id'],
                    $receiptDates,
                    (int)$current['id']
                );
            }

            $upload = handlePaymentEvidenceUpload($receiptData);
            if (!empty($upload['error'])) {
                throw new BookingAvailabilityException((string)$upload['error'], 400);
            }

            try {
                $db->update(
                    "UPDATE bookings SET payment_file = ?, status = 'pending', admin_note = '' WHERE id = ?",
                    [$upload['filename'], $current['id']]
                );
            } catch (Throwable $e) {
                $uploadedPath = UPLOAD_DIR . basename((string)$upload['filename']);
                if (is_file($uploadedPath)) unlink($uploadedPath);
                throw $e;
            }

            if (!empty($current['payment_file'])) {
                $oldPath = UPLOAD_DIR . basename((string)$current['payment_file']);
                if (is_file($oldPath)) unlink($oldPath);
            }

            return (string)$upload['filename'];
        }
    );

    jsonResponse(['success' => true, 'message' => 'Receipt uploaded', 'payment_file' => $paymentFile, 'status' => 'pending']);
}

function deleteBooking(Database $db, string $id): void
{
    jsonResponse([
        'success' => false,
        'error' => 'Booking records are preserved for history. Use rejected or cancelled status instead.'
    ], 405);
}

function getDashboardStats(Database $db): void
{
    $total = $db->fetchOne("SELECT COUNT(*) AS count FROM bookings WHERE status <> 'unpaid'");
    $pending = $db->fetchOne("SELECT COUNT(*) AS count FROM bookings WHERE status = 'pending'");
    $approved = $db->fetchOne("SELECT COUNT(*) AS count FROM bookings WHERE status = 'approved'");
    $today = $db->fetchOne("SELECT COUNT(*) AS count FROM bookings WHERE booking_date = CURDATE() AND status <> 'unpaid'");

    jsonResponse([
        'success' => true,
        'data' => [
            'total' => (int)$total['count'],
            'pending' => (int)$pending['count'],
            'approved' => (int)$approved['count'],
            'today' => (int)$today['count'],
        ],
    ]);
}

function getPublicStats(Database $db): void
{
    $today = $db->fetchOne("SELECT COUNT(*) AS count FROM bookings WHERE booking_date = CURDATE() AND status IN ('pending', 'approved')");
    jsonResponse(['success' => true, 'data' => ['today' => (int)$today['count']]]);
}

function getPublicCalendarBookings(Database $db): void
{
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('n');
    $facilityId = $_GET['facility_id'] ?? null;

    if ($year < 2000 || $year > 2100 || $month < 1 || $month > 12) {
        jsonResponse(['success' => false, 'error' => 'Invalid calendar month'], 400);
    }
    if ($facilityId !== null && (!ctype_digit((string)$facilityId) || (int)$facilityId < 1)) {
        jsonResponse(['success' => false, 'error' => 'Invalid facility'], 400);
    }

    $start = sprintf('%04d-%02d-01', $year, $month);
    $end = date('Y-m-t', strtotime($start));
    $lookback = (new DateTimeImmutable($start))->modify('-30 days')->format('Y-m-d');
    $params = [$lookback, $end];
    $facilityFilter = '';
    if ($facilityId !== null) {
        $facilityFilter = ' AND b.facility_id = ?';
        $params[] = (int)$facilityId;
    }

    $rows = $db->fetchAll(
        "SELECT b.booking_ref, b.facility_id, b.booking_date, b.start_time, b.end_time, b.duration, b.duration_unit, b.status,
                f.name AS facility_name, f.icon
         FROM bookings b
         LEFT JOIN facilities f ON b.facility_id = f.id
         WHERE b.booking_date BETWEEN ? AND ?
           AND b.status IN ('pending', 'approved')
           {$facilityFilter}
         ORDER BY b.booking_date ASC, b.start_time ASC",
        $params
    );

    $bookings = [];
    foreach ($rows as $booking) {
        foreach (bookingBlockedDates(
            (string)$booking['booking_date'],
            $booking['duration'] ?? '1',
            (string)($booking['duration_unit'] ?? 'hour')
        ) as $blockedDate) {
            if ($blockedDate < $start || $blockedDate > $end) {
                continue;
            }
            $bookings[] = [
                'id' => $booking['booking_ref'],
                'facilityId' => (string)$booking['facility_id'],
                'date' => $blockedDate,
                'start' => substr((string)$booking['start_time'], 0, 5),
                'end' => $booking['end_time'] ? substr((string)$booking['end_time'], 0, 5) : '',
                'duration' => $booking['duration'] ?? '1',
                'durationUnit' => $booking['duration_unit'] ?? 'hour',
                'duration_unit' => $booking['duration_unit'] ?? 'hour',
                'status' => $booking['status'],
                'facilityName' => $booking['facility_name'] ?? 'Fasiliti',
                'facilityIcon' => '<i class="bi ' . htmlspecialchars($booking['icon'] ?? 'bi-building', ENT_QUOTES, 'UTF-8') . '"></i>',
                'capacityManaged' => isAsramaRoomFacilityName((string)($booking['facility_name'] ?? '')),
            ];
        }
    }

    jsonResponse(['success' => true, 'data' => $bookings]);
}

?>
