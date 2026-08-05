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

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        requireAdmin();
        $input = jsonInput();

        $name = trim((string)($input['name'] ?? ''));
        $icon = trim((string)($input['icon'] ?? 'bi-building'));
        $capacity = (int)($input['capacity'] ?? 0);
        $pricePerHour = (float)($input['price_per_hour'] ?? 0);
        $description = trim((string)($input['description'] ?? ''));
        $isAvailable = (int)(bool)($input['is_available'] ?? true);
        $errors = [];

        if ($name === '' || strlen($name) > 100) {
            $errors['name'] = 'Nama fasiliti mesti diisi dan tidak melebihi 100 aksara.';
        }

        if ($icon === '') {
            $icon = 'bi-building';
        } elseif (!preg_match('/^bi-[a-z0-9-]+$/', $icon) || strlen($icon) > 50) {
            $errors['icon'] = 'Ikon Bootstrap tidak sah.';
        }

        if ($capacity < 1 || $capacity > 5000) {
            $errors['capacity'] = 'Kapasiti mesti antara 1 hingga 5000.';
        }

        if ($pricePerHour < 0 || $pricePerHour > 999999.99) {
            $errors['price_per_hour'] = 'Harga tidak sah.';
        }

        if (strlen($description) > 2000) {
            $errors['description'] = 'Keterangan terlalu panjang.';
        }

        if ($errors) {
            jsonResponse(['success' => false, 'error' => 'Maklumat fasiliti tidak lengkap.', 'errors' => $errors], 422);
        }

        $id = $db->insert(
            'INSERT INTO facilities (name, icon, capacity, price_per_hour, description, is_available)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$name, $icon, $capacity, $pricePerHour, $description, $isAvailable]
        );
        $facility = $db->fetchOne(
            'SELECT id, name, icon, capacity, price_per_hour, description, is_available, created_at, updated_at
             FROM facilities
             WHERE id = ?',
            [$id]
        );

        jsonResponse(['success' => true, 'message' => 'Fasiliti berjaya ditambah.', 'data' => $facility], 201);
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
