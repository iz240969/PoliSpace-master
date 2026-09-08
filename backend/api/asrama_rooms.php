<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

requireAdmin();
$db = Database::getInstance();

function ensureAsramaRoomsTable(Database $db): void
{
    $db->query(
        "CREATE TABLE IF NOT EXISTS asrama_rooms (
            id INT AUTO_INCREMENT PRIMARY KEY,
            facility_id INT NOT NULL,
            gender ENUM('male', 'female') NOT NULL,
            floor_level TINYINT UNSIGNED NOT NULL,
            room_number VARCHAR(20) NOT NULL,
            is_available BOOLEAN NOT NULL DEFAULT TRUE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_asrama_room (facility_id, gender, room_number),
            INDEX idx_asrama_floor (facility_id, gender, floor_level),
            FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function getAsramaFacility(Database $db): array
{
    $facility = $db->fetchOne("SELECT id, name, max_rooms, is_available FROM facilities WHERE LOWER(name) = 'asrama - bilik' LIMIT 1");
    if (!$facility) {
        jsonResponse(['success' => false, 'error' => 'Fasiliti Asrama - Bilik tidak dijumpai.'], 404);
    }
    return $facility;
}

function seedAsramaRooms(Database $db, int $facilityId): void
{
    $roomsPerFloor = [2, 2, 2, 2, 2];
    foreach (['male' => 'L', 'female' => 'P'] as $gender => $prefix) {
        foreach ($roomsPerFloor as $floor => $roomCount) {
            for ($room = 1; $room <= $roomCount; $room += 1) {
                $floorCode = $floor === 0 ? 'G' : (string)$floor;
                $roomNumber = sprintf('%s-%s%02d', $prefix, $floorCode, $room);
                $db->query(
                    'INSERT IGNORE INTO asrama_rooms (facility_id, gender, floor_level, room_number) VALUES (?, ?, ?, ?)',
                    [$facilityId, $gender, $floor, $roomNumber]
                );
            }
        }
    }
}

try {
    ensureAsramaRoomsTable($db);
    $facility = getAsramaFacility($db);
    $facilityId = (int)$facility['id'];
    seedAsramaRooms($db, $facilityId);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $rooms = $db->fetchAll(
            'SELECT id, gender, floor_level, room_number, is_available, updated_at FROM asrama_rooms WHERE facility_id = ? ORDER BY gender DESC, floor_level ASC, room_number ASC',
            [$facilityId]
        );
        jsonResponse(['success' => true, 'data' => ['facility' => $facility, 'rooms' => $rooms]]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $input = jsonInput();
        $action = (string)($_GET['action'] ?? 'room');
        $isAvailable = (int)(bool)($input['is_available'] ?? false);

        if ($action === 'level') {
            $gender = (string)($input['gender'] ?? '');
            $floor = filter_var($input['floor_level'] ?? null, FILTER_VALIDATE_INT);
            if (!in_array($gender, ['male', 'female'], true) || $floor === false || $floor < 0 || $floor > 4) {
                jsonResponse(['success' => false, 'error' => 'Maklumat aras tidak sah.'], 422);
            }
            $db->update(
                'UPDATE asrama_rooms SET is_available = ? WHERE facility_id = ? AND gender = ? AND floor_level = ?',
                [$isAvailable, $facilityId, $gender, $floor]
            );
            jsonResponse(['success' => true, 'message' => 'Ketersediaan aras berjaya dikemas kini.']);
        }

        $roomId = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        if ($roomId === false || $roomId <= 0) {
            jsonResponse(['success' => false, 'error' => 'Bilik tidak sah.'], 422);
        }
        $updated = $db->update(
            'UPDATE asrama_rooms SET is_available = ? WHERE id = ? AND facility_id = ?',
            [$isAvailable, $roomId, $facilityId]
        );
        if ($updated < 1) {
            jsonResponse(['success' => false, 'error' => 'Bilik tidak dijumpai atau tiada perubahan.'], 404);
        }
        jsonResponse(['success' => true, 'message' => 'Ketersediaan bilik berjaya dikemas kini.']);
    }

    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    $message = defined('APP_DEBUG') && APP_DEBUG ? $e->getMessage() : 'Pengurusan bilik asrama gagal.';
    jsonResponse(['success' => false, 'error' => $message], 500);
}
?>
