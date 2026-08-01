<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/validation.php';

const BLOCKING_BOOKING_STATUSES = ['pending', 'approved'];

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
ensureBookingEquipmentColumn($db);

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

    if ($method === 'POST') {
        createBooking($db);
    }

    if ($method === 'DELETE' && isset($_GET['id'])) {
        requireAdmin();
        deleteBooking($db, (string)$_GET['id']);
    }

    jsonResponse(['success' => false, 'error' => 'Invalid booking request'], 400);
} catch (Throwable $e) {
    $message = defined('APP_DEBUG') && APP_DEBUG ? $e->getMessage() : 'Booking request failed';
    jsonResponse(['success' => false, 'error' => $message], 500);
}

function getAllBookings(Database $db, mixed $status = null): void
{
    $sql = "SELECT b.*, f.name AS facility_name, f.icon
            FROM bookings b
            LEFT JOIN facilities f ON b.facility_id = f.id";
    $params = [];

    if ($status && in_array($status, ['unpaid', 'pending', 'approved', 'rejected', 'cancelled'], true)) {
        $sql .= ' WHERE b.status = ?';
        $params[] = $status;
    }

    $sql .= ' ORDER BY b.created_at DESC';
    $bookings = array_map('formatBookingForFrontend', $db->fetchAll($sql, $params));
    jsonResponse(['success' => true, 'data' => $bookings]);
}

function getUserBookings(Database $db, string $email = ''): void
{
    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    $sessionEmail = trim((string)($_SESSION['user_email'] ?? ''));
    if ($userId <= 0 || !filter_var($sessionEmail, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'error' => 'User login required'], 401);
    }

    if ($email !== '' && strtolower($sessionEmail) !== strtolower($email)) {
        jsonResponse(['success' => false, 'error' => 'You can only view your own bookings'], 403);
    }

    $bookings = $db->fetchAll(
        "SELECT b.*, f.name AS facility_name, f.icon
         FROM bookings b
         LEFT JOIN facilities f ON b.facility_id = f.id
         WHERE b.user_id = ? OR LOWER(b.email) = LOWER(?)
         ORDER BY b.created_at DESC",
        [$userId, $sessionEmail]
    );

    jsonResponse(['success' => true, 'data' => array_map('formatBookingForFrontend', $bookings)]);
}

function getBookingByRef(Database $db, string $ref): void
{
    if (empty($_SESSION['admin_id']) && empty($_SESSION['user_email'])) {
        jsonResponse(['success' => false, 'error' => 'Login required'], 401);
    }

    $booking = $db->fetchOne(
        "SELECT b.*, f.name AS facility_name, f.icon
         FROM bookings b
         LEFT JOIN facilities f ON b.facility_id = f.id
         WHERE b.booking_ref = ?",
        [$ref]
    );

    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    if (empty($_SESSION['admin_id'])
        && strtolower((string)$booking['email']) !== strtolower((string)$_SESSION['user_email'])) {
        jsonResponse(['success' => false, 'error' => 'You can only view your own booking'], 403);
    }

    jsonResponse(['success' => true, 'data' => formatBookingForFrontend($booking)]);
}

function createBooking(Database $db): void
{
    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    $userEmail = trim((string)($_SESSION['user_email'] ?? ''));
    if ($userId <= 0 || !filter_var($userEmail, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'error' => 'User login required'], 401);
    }

    $data = $_POST ?: jsonInput();
    $user = $db->fetchOne("SELECT id, email, full_name, phone FROM users WHERE id = ? AND email = ? AND role = 'user'", [$userId, $userEmail]);
    if (!$user) {
        jsonResponse(['success' => false, 'error' => 'Valid user account required'], 401);
    }

    $data['email'] = $user['email'];
    $data['full_name'] = trim((string)($data['full_name'] ?? '')) ?: (string)($user['full_name'] ?? '');
    $data['phone'] = trim((string)($data['phone'] ?? '')) ?: (string)($user['phone'] ?? '');
    $errors = validateBookingData($data);

    if ($errors) {
        jsonResponse(['success' => false, 'error' => 'Validation failed', 'details' => $errors], 400);
    }

    $ref = generateBookingRef();
    $facility = $db->fetchOne('SELECT name FROM facilities WHERE id = ?', [$data['facility_id']]);
    if (!$facility) {
        jsonResponse(['success' => false, 'error' => 'Facility not found'], 404);
    }
    $packageOnlyFacilities = ['dewan utama', 'dewan syarahan', 'bilik persidangan', 'bilik seminar'];
    if ($facility && in_array(strtolower((string)$facility['name']), $packageOnlyFacilities, true)) {
        $data['setup_required'] = 'full';
    }

    $paymentFile = null;
    $bookingStatus = 'unpaid';
    $hasPaymentFile = !empty($_FILES['payment_file']) && $_FILES['payment_file']['error'] !== UPLOAD_ERR_NO_FILE;
    if ($hasPaymentFile && hasBlockingBookingConflict($db, (int)$data['facility_id'], $data['booking_date'], $data['start_time'], $data['end_time'] ?? null, $data['duration'] ?? '1')) {
        jsonResponse(['success' => false, 'error' => 'Slot ini telah ditempah oleh pelanggan yang telah membuat bayaran. Sila pilih masa lain.'], 409);
    }

    if ($hasPaymentFile) {
        if ($_FILES['payment_file']['error'] !== UPLOAD_ERR_OK) {
            jsonResponse(['success' => false, 'error' => 'Receipt upload failed'], 400);
        }

        $upload = handlePaymentUpload($_FILES['payment_file']);
        if (!empty($upload['error'])) {
            jsonResponse(['success' => false, 'error' => $upload['error']], 400);
        }
        $paymentFile = $upload['filename'];
        $bookingStatus = 'pending';
    }

    $db->update(
        "UPDATE users SET full_name = ?, phone = ? WHERE id = ? AND role = 'user'",
        [$data['full_name'], $data['phone'], $userId]
    );

    $db->insert(
        "INSERT INTO bookings (
            booking_ref, user_id, facility_id, full_name, organization, email, phone,
            booking_date, start_time, end_time, duration, purpose, participant_count,
            setup_required, equipment_required, payment_file, status, estimated_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            $ref,
            $userId,
            $data['facility_id'],
            $data['full_name'],
            $data['organization'] ?? '',
            $data['email'],
            $data['phone'],
            $data['booking_date'],
            $data['start_time'],
            $data['end_time'] ?? null,
            $data['duration'] ?? '1',
            $data['purpose'],
            $data['participant_count'] ?? 0,
            $data['setup_required'] ?? 'none',
            $data['equipment_required'] ?? '',
            $paymentFile,
            $bookingStatus,
            $data['estimated_cost'] ?? 0,
        ]
    );

    jsonResponse(['success' => true, 'message' => 'Booking created successfully', 'booking_ref' => $ref]);
}

function updateBookingStatus(Database $db, string $id, array $data): void
{
    $status = $data['status'] ?? '';
    $adminNote = trim((string)($data['admin_note'] ?? ''));

    if (!in_array($status, ['unpaid', 'pending', 'approved', 'rejected', 'cancelled'], true)) {
        jsonResponse(['success' => false, 'error' => 'Invalid status'], 400);
    }

    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $booking = $db->fetchOne("SELECT id, facility_id, booking_date, start_time, end_time, duration FROM bookings WHERE {$field} = ?", [$id]);
    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    if ($status === 'rejected' && $adminNote === '') {
        jsonResponse(['success' => false, 'error' => 'Rejection reason required'], 400);
    }

    if (in_array($status, BLOCKING_BOOKING_STATUSES, true)
        && hasBlockingBookingConflict(
            $db,
            (int)$booking['facility_id'],
            (string)$booking['booking_date'],
            (string)$booking['start_time'],
            $booking['end_time'] ? (string)$booking['end_time'] : null,
            (string)($booking['duration'] ?? '1'),
            (int)$booking['id']
        )) {
        jsonResponse(['success' => false, 'error' => 'Slot ini sudah ditempah oleh tempahan berbayar/lulus yang lain.'], 409);
    }

    $db->update("UPDATE bookings SET status = ?, admin_note = ? WHERE {$field} = ?", [$status, $adminNote, $id]);
    jsonResponse(['success' => true, 'message' => 'Booking status updated']);
}

function cancelOwnBooking(Database $db, string $id, array $data): void
{
    $status = $data['status'] ?? '';
    if ($status !== 'cancelled') {
        jsonResponse(['success' => false, 'error' => 'Admin login required'], 401);
    }

    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    $userEmail = trim((string)($_SESSION['user_email'] ?? ''));
    if ($userId <= 0 || !filter_var($userEmail, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'error' => 'User login required'], 401);
    }

    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $booking = $db->fetchOne("SELECT id, user_id, email, status, facility_id FROM bookings WHERE {$field} = ?", [$id]);
    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    $ownsBooking = (int)$booking['user_id'] === $userId || strtolower((string)$booking['email']) === strtolower($userEmail);
    if (!$ownsBooking) {
        jsonResponse(['success' => false, 'error' => 'You can only cancel your own booking'], 403);
    }

    if (!in_array($booking['status'], ['unpaid', 'pending'], true)) {
        jsonResponse(['success' => false, 'error' => 'Only unpaid or pending bookings can be cancelled'], 409);
    }

    $db->update(
        "UPDATE bookings SET status = 'cancelled', admin_note = ? WHERE id = ?",
        ['Dibatalkan oleh pengguna.', $booking['id']]
    );
    jsonResponse(['success' => true, 'message' => 'Booking cancelled']);
}

function updateOwnPendingBooking(Database $db, string $id, array $data): void
{
    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    $userEmail = trim((string)($_SESSION['user_email'] ?? ''));
    if ($userId <= 0 || !filter_var($userEmail, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'error' => 'User login required'], 401);
    }

    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $booking = $db->fetchOne("SELECT id, user_id, email, status, facility_id FROM bookings WHERE {$field} = ?", [$id]);
    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    $ownsBooking = (int)$booking['user_id'] === $userId || strtolower((string)$booking['email']) === strtolower($userEmail);
    if (!$ownsBooking) {
        jsonResponse(['success' => false, 'error' => 'You can only edit your own booking'], 403);
    }

    if (!in_array($booking['status'], ['unpaid', 'pending'], true)) {
        jsonResponse(['success' => false, 'error' => 'Only unpaid or pending bookings can be edited'], 409);
    }

    $bookingDate = trim((string)($data['booking_date'] ?? ''));
    $startTime = trim((string)($data['start_time'] ?? ''));
    $endTime = trim((string)($data['end_time'] ?? ''));
    $duration = trim((string)($data['duration'] ?? '1'));
    $purpose = trim((string)($data['purpose'] ?? ''));
    $equipment = trim((string)($data['equipment_required'] ?? ''));
    $participantCount = (int)($data['participant_count'] ?? 0);

    if ($bookingDate === '' || $bookingDate < date('Y-m-d')) {
        jsonResponse(['success' => false, 'error' => 'Valid future booking date required'], 400);
    }

    if (!preg_match('/^\d{2}:\d{2}$/', $startTime)) {
        jsonResponse(['success' => false, 'error' => 'Valid start time required'], 400);
    }

    if ($purpose === '') {
        jsonResponse(['success' => false, 'error' => 'Purpose is required'], 400);
    }

    if ($participantCount < 1) {
        jsonResponse(['success' => false, 'error' => 'Participant count must be at least 1'], 400);
    }

    if (!isAllowedBookingEquipment($equipment)) {
        jsonResponse(['success' => false, 'error' => 'Invalid equipment option'], 400);
    }

    if (in_array($booking['status'], BLOCKING_BOOKING_STATUSES, true)
        && hasBlockingBookingConflict($db, (int)$booking['facility_id'], $bookingDate, $startTime, $endTime ?: null, $duration, (int)$booking['id'])) {
        jsonResponse(['success' => false, 'error' => 'Slot ini telah ditempah oleh pelanggan yang telah membuat bayaran. Sila pilih masa lain.'], 409);
    }

    $db->update(
        'UPDATE bookings SET booking_date = ?, start_time = ?, end_time = ?, duration = ?, purpose = ?, equipment_required = ?, participant_count = ? WHERE id = ?',
        [$bookingDate, $startTime, $endTime ?: null, $duration, $purpose, $equipment, $participantCount, $booking['id']]
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
    if ($statusColumn && isset($statusColumn['Type']) && strpos((string)$statusColumn['Type'], "'unpaid'") === false) {
        $db->query("ALTER TABLE bookings MODIFY status ENUM('unpaid', 'pending', 'approved', 'rejected', 'cancelled') DEFAULT 'unpaid'");
    }
}

function uploadOwnReceipt(Database $db, string $id): void
{
    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    $userEmail = trim((string)($_SESSION['user_email'] ?? ''));
    if ($userId <= 0 || !filter_var($userEmail, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'error' => 'User login required'], 401);
    }

    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $booking = $db->fetchOne("SELECT id, user_id, email, status, payment_file, facility_id, booking_date, start_time, end_time, duration FROM bookings WHERE {$field} = ?", [$id]);
    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    $ownsBooking = (int)$booking['user_id'] === $userId || strtolower((string)$booking['email']) === strtolower($userEmail);
    if (!$ownsBooking) {
        jsonResponse(['success' => false, 'error' => 'You can only update your own booking'], 403);
    }

    if ($booking['status'] !== 'unpaid') {
        jsonResponse(['success' => false, 'error' => 'Receipt can only be uploaded for unpaid bookings'], 409);
    }

    if (hasBlockingBookingConflict(
        $db,
        (int)$booking['facility_id'],
        (string)$booking['booking_date'],
        (string)$booking['start_time'],
        $booking['end_time'] ? (string)$booking['end_time'] : null,
        (string)($booking['duration'] ?? '1'),
        (int)$booking['id']
    )) {
        jsonResponse(['success' => false, 'error' => 'Slot ini telah ditempah oleh pelanggan yang telah membuat bayaran. Sila pilih masa lain.'], 409);
    }

    if (empty($_FILES['payment_file']) || $_FILES['payment_file']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['success' => false, 'error' => 'Receipt upload is required'], 400);
    }

    $upload = handlePaymentUpload($_FILES['payment_file']);
    if (!empty($upload['error'])) {
        jsonResponse(['success' => false, 'error' => $upload['error']], 400);
    }

    if (!empty($booking['payment_file'])) {
        $oldPath = UPLOAD_DIR . basename((string)$booking['payment_file']);
        if (is_file($oldPath)) {
            unlink($oldPath);
        }
    }

    $db->update(
        "UPDATE bookings SET payment_file = ?, status = 'pending', admin_note = '' WHERE id = ?",
        [$upload['filename'], $booking['id']]
    );

    jsonResponse(['success' => true, 'message' => 'Receipt uploaded', 'payment_file' => $upload['filename'], 'status' => 'pending']);
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
    $total = $db->fetchOne('SELECT COUNT(*) AS count FROM bookings');
    $unpaid = $db->fetchOne("SELECT COUNT(*) AS count FROM bookings WHERE status = 'unpaid'");
    $pending = $db->fetchOne("SELECT COUNT(*) AS count FROM bookings WHERE status = 'pending'");
    $approved = $db->fetchOne("SELECT COUNT(*) AS count FROM bookings WHERE status = 'approved'");
    $today = $db->fetchOne('SELECT COUNT(*) AS count FROM bookings WHERE booking_date = CURDATE()');

    jsonResponse([
        'success' => true,
        'data' => [
            'total' => (int)$total['count'],
            'unpaid' => (int)$unpaid['count'],
            'pending' => (int)$pending['count'],
            'approved' => (int)$approved['count'],
            'today' => (int)$today['count'],
        ],
    ]);
}

function getPublicStats(Database $db): void
{
    $today = $db->fetchOne('SELECT COUNT(*) AS count FROM bookings WHERE booking_date = CURDATE()');
    jsonResponse(['success' => true, 'data' => ['today' => (int)$today['count']]]);
}

function getPublicCalendarBookings(Database $db): void
{
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('n');

    if ($year < 2000 || $year > 2100 || $month < 1 || $month > 12) {
        jsonResponse(['success' => false, 'error' => 'Invalid calendar month'], 400);
    }

    $start = sprintf('%04d-%02d-01', $year, $month);
    $end = date('Y-m-t', strtotime($start));
    $rows = $db->fetchAll(
        "SELECT b.booking_ref, b.facility_id, b.booking_date, b.start_time, b.end_time, b.status,
                f.name AS facility_name, f.icon
         FROM bookings b
         LEFT JOIN facilities f ON b.facility_id = f.id
         WHERE b.booking_date BETWEEN ? AND ?
           AND b.status IN ('pending', 'approved')
         ORDER BY b.booking_date ASC, b.start_time ASC",
        [$start, $end]
    );

    $bookings = array_map(static function (array $booking): array {
        return [
            'id' => $booking['booking_ref'],
            'facilityId' => (string)$booking['facility_id'],
            'date' => $booking['booking_date'],
            'start' => substr((string)$booking['start_time'], 0, 5),
            'end' => $booking['end_time'] ? substr((string)$booking['end_time'], 0, 5) : '',
            'status' => $booking['status'],
            'facilityName' => $booking['facility_name'] ?? 'Fasiliti',
            'facilityIcon' => '<i class="bi ' . htmlspecialchars($booking['icon'] ?? 'bi-building', ENT_QUOTES, 'UTF-8') . '"></i>',
        ];
    }, $rows);

    jsonResponse(['success' => true, 'data' => $bookings]);
}

function hasBlockingBookingConflict(
    Database $db,
    int $facilityId,
    string $bookingDate,
    string $startTime,
    ?string $endTime,
    string $duration = '1',
    ?int $excludeBookingId = null
): bool {
    $sql = "SELECT id, start_time, end_time, duration
            FROM bookings
            WHERE facility_id = ?
              AND booking_date = ?
              AND status IN ('pending', 'approved')";
    $params = [$facilityId, $bookingDate];

    if ($excludeBookingId !== null) {
        $sql .= ' AND id <> ?';
        $params[] = $excludeBookingId;
    }

    $requestedStart = bookingTimeToMinutes($startTime);
    $requestedEnd = bookingEndToMinutes($startTime, $endTime, $duration);
    if ($requestedStart === null || $requestedEnd === null || $requestedEnd <= $requestedStart) {
        return false;
    }

    foreach ($db->fetchAll($sql, $params) as $booking) {
        $existingStart = bookingTimeToMinutes((string)$booking['start_time']);
        $existingEnd = bookingEndToMinutes(
            (string)$booking['start_time'],
            $booking['end_time'] ? (string)$booking['end_time'] : null,
            (string)($booking['duration'] ?? '1')
        );

        if ($existingStart === null || $existingEnd === null || $existingEnd <= $existingStart) {
            continue;
        }

        if ($requestedStart < $existingEnd && $requestedEnd > $existingStart) {
            return true;
        }
    }

    return false;
}

function bookingTimeToMinutes(string $time): ?int
{
    if (!preg_match('/^(\d{2}):(\d{2})/', $time, $matches)) {
        return null;
    }
    return ((int)$matches[1] * 60) + (int)$matches[2];
}

function bookingEndToMinutes(string $startTime, ?string $endTime, string $duration): ?int
{
    $end = $endTime ? bookingTimeToMinutes($endTime) : null;
    if ($end !== null) {
        return $end;
    }

    $start = bookingTimeToMinutes($startTime);
    if ($start === null) {
        return null;
    }

    $durationMap = ['1' => 60, '2' => 120, '3' => 180, '4' => 240, 'halfday' => 240, 'fullday' => 480];
    return $start + ($durationMap[$duration] ?? 60);
}
?>
