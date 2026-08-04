<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/booking_availability.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

$db = Database::getInstance();

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $facilities = $db->fetchAll(
            'SELECT id, name, icon, capacity, price_per_hour, description, is_available, created_at, updated_at
             FROM facilities
             ORDER BY id'
        );
        jsonResponse(['success' => true, 'data' => $facilities]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        requireAdmin();
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        $input = jsonInput();

        if ($id <= 0) {
            jsonResponse(['success' => false, 'error' => 'Facility ID required'], 400);
        }

        if (!array_key_exists('is_available', $input)) {
            jsonResponse(['success' => false, 'error' => 'Availability value required'], 400);
        }

        $isAvailable = (int)(bool)$input['is_available'];
        $facility = $db->fetchOne('SELECT id FROM facilities WHERE id = ?', [$id]);
        if (!$facility) {
            jsonResponse(['success' => false, 'error' => 'Facility not found'], 404);
        }

        withFacilityAvailabilityLock($db, $id, function () use ($db, $isAvailable, $id): void {
            $db->update('UPDATE facilities SET is_available = ? WHERE id = ?', [$isAvailable, $id]);
        });
        jsonResponse(['success' => true, 'message' => 'Facility updated']);
    }

    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
} catch (BookingAvailabilityException $e) {
    jsonResponse(['success' => false, 'error' => $e->getMessage()], $e->httpStatus());
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'Facility request failed'], 500);
}
?>
