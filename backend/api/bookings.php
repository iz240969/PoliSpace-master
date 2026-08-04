<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/validation.php';
require_once __DIR__ . '/../includes/booking_availability.php';

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
    if ($userId <= 0 || !filter_var($sessionEmail, FILTER_VALIDATE_EMAIL) || !empty($_SESSION['admin_id'])) {
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
    $isAdmin = !empty($_SESSION['admin_id']) && empty($_SESSION['user_id']);
    $isUser = !empty($_SESSION['user_id']) && empty($_SESSION['admin_id']) && !empty($_SESSION['user_email']);
    if (!$isAdmin && !$isUser) {
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

    if (!$isAdmin
        && strtolower((string)$booking['email']) !== strtolower((string)$_SESSION['user_email'])) {
        jsonResponse(['success' => false, 'error' => 'You can only view your own booking'], 403);
    }

    jsonResponse(['success' => true, 'data' => formatBookingForFrontend($booking)]);
}

function createBooking(Database $db): void
{
    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    $userEmail = trim((string)($_SESSION['user_email'] ?? ''));
    if ($userId <= 0 || !filter_var($userEmail, FILTER_VALIDATE_EMAIL) || !empty($_SESSION['admin_id'])) {
        jsonResponse(['success' => false, 'error' => 'User login required'], 401);
    }

    $data = $_POST ?: jsonInput();
    $user = $db->fetchOne("SELECT id, email, full_name, phone FROM users WHERE id = ? AND email = ? AND role = 'user'", [$userId, $userEmail]);
    if (!$user) {
        jsonResponse(['success' => false, 'error' => 'Valid user account required'], 401);
    }

    $data['email'] = (string)$user['email'];
    $data['full_name'] = trim((string)($user['full_name'] ?? ''));
    $data['phone'] = trim((string)($user['phone'] ?? ''));
    $errors = validateBookingData($data);

    if ($errors) {
        jsonResponse(['success' => false, 'error' => array_values($errors)[0], 'details' => $errors], 400);
    }

    $ref = generateBookingRef();
    $facility = $db->fetchOne('SELECT name, capacity, price_per_hour, is_available FROM facilities WHERE id = ?', [$data['facility_id']]);
    if (!$facility) {
        jsonResponse(['success' => false, 'error' => 'Facility not found'], 404);
    }
    if (!(bool)$facility['is_available']) {
        jsonResponse(['success' => false, 'error' => 'Fasiliti ini tidak tersedia untuk tempahan.'], 409);
    }
    if ((int)$data['participant_count'] > (int)$facility['capacity']) {
        jsonResponse(['success' => false, 'error' => 'Jumlah pengguna melebihi kapasiti fasiliti.'], 400);
    }
    $packageOnlyFacilities = ['dewan utama', 'dewan syarahan', 'bilik persidangan', 'bilik seminar'];
    if ($facility && in_array(strtolower((string)$facility['name']), $packageOnlyFacilities, true)) {
        $data['setup_required'] = 'full';
    }

    $paymentFile = null;
    $bookingStatus = 'unpaid';
    $hasPaymentFile = !empty($_FILES['payment_file']) && $_FILES['payment_file']['error'] !== UPLOAD_ERR_NO_FILE;
    if ($hasPaymentFile && $_FILES['payment_file']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['success' => false, 'error' => 'Receipt upload failed'], 400);
    }
    if ($hasPaymentFile) $bookingStatus = 'pending';

    withFacilityBookingDateLocks($db, (int)$data['facility_id'], [(string)$data['booking_date']], function () use (
        $db,
        $data,
        $userId,
        $ref,
        $hasPaymentFile,
        $bookingStatus,
        &$paymentFile
    ): void {
        $latestFacility = $db->fetchOne('SELECT capacity, price_per_hour, is_available FROM facilities WHERE id = ?', [$data['facility_id']]);
        if (!$latestFacility || !(bool)$latestFacility['is_available']) {
            throw new BookingAvailabilityException('Fasiliti ini tidak tersedia untuk tempahan.');
        }
        if ((int)$data['participant_count'] > (int)$latestFacility['capacity']) {
            throw new BookingAvailabilityException('Jumlah pengguna melebihi kapasiti fasiliti.', 400);
        }

        assertBookingDateAvailable($db, (int)$data['facility_id'], (string)$data['booking_date']);

        if ($hasPaymentFile) {
            $upload = handlePaymentUpload($_FILES['payment_file']);
            if (!empty($upload['error'])) {
                throw new BookingAvailabilityException((string)$upload['error'], 400);
            }
            $paymentFile = $upload['filename'];
        }

        try {
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
                    $latestFacility['price_per_hour'],
                ]
            );
        } catch (Throwable $e) {
            if ($paymentFile) {
                $uploadedPath = UPLOAD_DIR . basename($paymentFile);
                if (is_file($uploadedPath)) unlink($uploadedPath);
            }
            throw $e;
        }
    });

    jsonResponse(['success' => true, 'message' => 'Booking created successfully', 'booking_ref' => $ref]);
}

function updateBookingStatus(Database $db, string $id, array $data): void
{
    $status = $data['status'] ?? '';
    $adminNote = trim((string)($data['admin_note'] ?? ''));

    if (!in_array($status, ['approved', 'rejected'], true)) {
        jsonResponse(['success' => false, 'error' => 'Invalid status'], 400);
    }

    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $booking = $db->fetchOne("SELECT id, facility_id, booking_date FROM bookings WHERE {$field} = ?", [$id]);
    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    if ($status === 'rejected' && $adminNote === '') {
        jsonResponse(['success' => false, 'error' => 'Rejection reason required'], 400);
    }

    withBookingMutationLocks($db, (int)$booking['id'], (int)$booking['facility_id'], [(string)$booking['booking_date']], false, function () use (
        $db,
        $field,
        $id,
        $status,
        $adminNote
    ): void {
        $current = $db->fetchOne(
            "SELECT id, status, payment_file, facility_id, booking_date FROM bookings WHERE {$field} = ?",
            [$id]
        );
        if (!$current) {
            throw new BookingAvailabilityException('Booking not found', 404);
        }

        if ($status === 'approved' && $current['status'] !== 'pending') {
            throw new BookingAvailabilityException('Hanya tempahan menunggu dengan resit boleh diluluskan.');
        }
        if ($status === 'rejected' && !in_array($current['status'], ['unpaid', 'pending', 'approved'], true)) {
            throw new BookingAvailabilityException('Tempahan ini tidak boleh ditolak dalam status semasa.');
        }
        if (in_array($status, BLOCKING_BOOKING_STATUSES, true)) {
            if (empty($current['payment_file'])) {
                throw new BookingAvailabilityException('Resit bayaran diperlukan sebelum tarikh boleh dikunci.');
            }
            assertBookingDateAvailable(
                $db,
                (int)$current['facility_id'],
                (string)$current['booking_date'],
                (int)$current['id']
            );
        }

        $db->update('UPDATE bookings SET status = ?, admin_note = ? WHERE id = ?', [$status, $adminNote, $current['id']]);
    });
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
    if ($userId <= 0 || !filter_var($userEmail, FILTER_VALIDATE_EMAIL) || !empty($_SESSION['admin_id'])) {
        jsonResponse(['success' => false, 'error' => 'User login required'], 401);
    }

    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $booking = $db->fetchOne("SELECT id, facility_id, booking_date FROM bookings WHERE {$field} = ?", [$id]);
    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    withBookingMutationLocks($db, (int)$booking['id'], (int)$booking['facility_id'], [(string)$booking['booking_date']], false, function () use (
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
    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    $userEmail = trim((string)($_SESSION['user_email'] ?? ''));
    if ($userId <= 0 || !filter_var($userEmail, FILTER_VALIDATE_EMAIL) || !empty($_SESSION['admin_id'])) {
        jsonResponse(['success' => false, 'error' => 'User login required'], 401);
    }

    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $booking = $db->fetchOne("SELECT id, facility_id, booking_date FROM bookings WHERE {$field} = ?", [$id]);
    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    $bookingDate = trim((string)($data['booking_date'] ?? ''));
    $startTime = trim((string)($data['start_time'] ?? ''));
    $endTime = trim((string)($data['end_time'] ?? ''));
    $duration = trim((string)($data['duration'] ?? '1'));
    $purpose = trim((string)($data['purpose'] ?? ''));
    $equipment = trim((string)($data['equipment_required'] ?? ''));
    $participantCount = (int)($data['participant_count'] ?? 0);

    $scheduleErrors = validateBookingScheduleData([
        'booking_date' => $bookingDate,
        'start_time' => $startTime,
        'end_time' => $endTime,
        'duration' => $duration,
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

    withBookingMutationLocks(
        $db,
        (int)$booking['id'],
        (int)$booking['facility_id'],
        [
            (string)$booking['booking_date'],
            $bookingDate,
        ],
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
            $purpose,
            $equipment,
            $participantCount
        ): void {
            $current = $db->fetchOne(
                "SELECT b.id, b.user_id, b.email, b.status, b.facility_id, f.capacity, f.is_available
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
            if ($participantCount > (int)$current['capacity']) {
                throw new BookingAvailabilityException('Jumlah pengguna melebihi kapasiti fasiliti.', 400);
            }

            assertBookingDateAvailable(
                $db,
                (int)$current['facility_id'],
                $bookingDate,
                (int)$current['id']
            );
            $db->update(
                'UPDATE bookings SET booking_date = ?, start_time = ?, end_time = ?, duration = ?, purpose = ?, equipment_required = ?, participant_count = ? WHERE id = ?',
                [$bookingDate, $startTime, $endTime ?: null, $duration, $purpose, $equipment, $participantCount, $current['id']]
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
    if ($statusColumn && isset($statusColumn['Type']) && strpos((string)$statusColumn['Type'], "'unpaid'") === false) {
        $db->query("ALTER TABLE bookings MODIFY status ENUM('unpaid', 'pending', 'approved', 'rejected', 'cancelled') DEFAULT 'unpaid'");
    }
}

function uploadOwnReceipt(Database $db, string $id): void
{
    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    $userEmail = trim((string)($_SESSION['user_email'] ?? ''));
    if ($userId <= 0 || !filter_var($userEmail, FILTER_VALIDATE_EMAIL) || !empty($_SESSION['admin_id'])) {
        jsonResponse(['success' => false, 'error' => 'User login required'], 401);
    }

    $field = ctype_digit($id) ? 'id' : 'booking_ref';
    $booking = $db->fetchOne("SELECT id, facility_id, booking_date FROM bookings WHERE {$field} = ?", [$id]);
    if (!$booking) {
        jsonResponse(['success' => false, 'error' => 'Booking not found'], 404);
    }

    if (empty($_FILES['payment_file']) || $_FILES['payment_file']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['success' => false, 'error' => 'Receipt upload is required'], 400);
    }

    $paymentFile = withBookingMutationLocks(
        $db,
        (int)$booking['id'],
        (int)$booking['facility_id'],
        [(string)$booking['booking_date']],
        true,
        function () use ($db, $field, $id, $userId, $userEmail): string {
            $current = $db->fetchOne(
                "SELECT b.id, b.user_id, b.email, b.status, b.payment_file, b.facility_id,
                        b.booking_date, b.start_time, b.end_time, b.duration, b.participant_count,
                        f.is_available
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
            if (!(bool)$current['is_available']) {
                throw new BookingAvailabilityException('Fasiliti ini tidak tersedia untuk tempahan.');
            }

            $scheduleErrors = validateBookingScheduleData([
                'booking_date' => $current['booking_date'],
                'start_time' => substr((string)$current['start_time'], 0, 5),
                'end_time' => $current['end_time'] ? substr((string)$current['end_time'], 0, 5) : '',
                'duration' => $current['duration'] ?? '1',
                'participant_count' => $current['participant_count'],
            ]);
            if ($scheduleErrors) {
                throw new BookingAvailabilityException(array_values($scheduleErrors)[0], 400);
            }

            assertBookingDateAvailable(
                $db,
                (int)$current['facility_id'],
                (string)$current['booking_date'],
                (int)$current['id']
            );

            $upload = handlePaymentUpload($_FILES['payment_file']);
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
    $params = [$start, $end];
    $facilityFilter = '';
    if ($facilityId !== null) {
        $facilityFilter = ' AND b.facility_id = ?';
        $params[] = (int)$facilityId;
    }

    $rows = $db->fetchAll(
        "SELECT b.booking_ref, b.facility_id, b.booking_date, b.start_time, b.end_time, b.status,
                f.name AS facility_name, f.icon
         FROM bookings b
         LEFT JOIN facilities f ON b.facility_id = f.id
         WHERE b.booking_date BETWEEN ? AND ?
           AND b.status IN ('pending', 'approved')
           {$facilityFilter}
         ORDER BY b.booking_date ASC, b.start_time ASC",
        $params
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

?>
