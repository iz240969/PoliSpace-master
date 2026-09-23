<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/booking_availability.php';
require_once __DIR__ . '/../includes/pic_mail.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

$db = Database::getInstance();

function ensureFacilityEquipmentColumn(Database $db): void
{
    $exists = $db->fetchOne(
        "SELECT COUNT(*) AS count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'facilities'
           AND COLUMN_NAME = 'equipment_options'"
    );

    if ((int)($exists['count'] ?? 0) === 0) {
        $db->query('ALTER TABLE facilities ADD COLUMN equipment_options TEXT NULL AFTER description');
    }
}

function ensureFacilityMaxRoomsColumn(Database $db): void
{
    $exists = $db->fetchOne(
        "SELECT COUNT(*) AS count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'facilities'
           AND COLUMN_NAME = 'max_rooms'"
    );

    if ((int)($exists['count'] ?? 0) === 0) {
        $db->query('ALTER TABLE facilities ADD COLUMN max_rooms INT NULL AFTER price_per_hour');
    }

    $db->update("UPDATE facilities SET max_rooms = 10 WHERE LOWER(name) LIKE '%asrama%' AND LOWER(name) LIKE '%bilik%' AND (max_rooms IS NULL OR max_rooms < 1)");
}

function facilitySelectSql(bool $includePicEmail = false): string
{
    $picEmail = $includePicEmail ? ', p.email AS pic_email' : '';
    return 'SELECT f.id, f.name, f.icon, f.capacity, f.price_per_hour, f.max_rooms, f.description,
                   f.pic_id, p.full_name AS pic_full_name, p.phone AS pic_phone' . $picEmail . ',
                   f.equipment_options, f.is_available, f.created_at, f.updated_at
            FROM facilities f
            LEFT JOIN pics p ON p.id = f.pic_id';
}

function normalizeFacilityPicId(Database $db, mixed $value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }
    $picId = (int)$value;
    if ($picId <= 0 || !$db->fetchOne('SELECT id FROM pics WHERE id = ?', [$picId])) {
        jsonResponse(['success' => false, 'error' => 'PIC yang dipilih tidak sah.'], 422);
    }
    return $picId;
}

function normalizeFacilityEquipmentOptions(mixed $value): string
{
    if (is_array($value)) {
        $items = $value;
    } else {
        $raw = trim((string)($value ?? ''));
        if ($raw === '') {
            return '[]';
        }
        $decoded = json_decode($raw, true);
        $items = is_array($decoded) ? $decoded : preg_split('/\r\n|\r|\n|,/', $raw);
    }

    $names = [];
    foreach ($items as $item) {
        $name = is_array($item) ? (string)($item['name'] ?? '') : (string)$item;
        $name = trim($name);
        if ($name === '' || strlen($name) > 80) {
            continue;
        }
        $key = strtolower($name);
        if (!isset($names[$key])) {
            $names[$key] = $name;
        }
    }

    return json_encode(array_values(array_map(
        static fn(string $name): array => ['name' => $name, 'max' => null],
        $names
    )), JSON_UNESCAPED_UNICODE);
}

function defaultFacilityEquipmentOptions(int $facilityId): string
{
    $defaults = [
        1 => ['Mikrofon', 'Projektor', 'PA System', 'Kerusi Tambahan', 'Meja Tambahan'],
        2 => ['Mikrofon', 'Projektor', 'PA System'],
        3 => ['Projektor', 'TV LCD', 'Meja Mesyuarat'],
        4 => ['TV Besar', 'Papan Putih', 'Mikrofon'],
        5 => ['Komputer Tambahan', 'Projektor'],
        6 => [],
    ];

    return normalizeFacilityEquipmentOptions($defaults[$facilityId] ?? ['Mikrofon', 'Projektor', 'PA System']);
}

function backfillDefaultFacilityEquipment(Database $db): void
{
    foreach ([1, 2, 3, 4, 5, 6] as $facilityId) {
        $db->update(
            "UPDATE facilities
             SET equipment_options = ?
             WHERE id = ?
               AND (equipment_options IS NULL OR equipment_options = '')",
            [defaultFacilityEquipmentOptions($facilityId), $facilityId]
        );
    }
}

try {
    ensureFacilityEquipmentColumn($db);
    ensureFacilityMaxRoomsColumn($db);
    backfillDefaultFacilityEquipment($db);
    $action = $_GET['action'] ?? '';

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $includePicEmail = !empty($_SESSION['admin_id']) && empty($_SESSION['user_id']);
        $facilities = $db->fetchAll(
            facilitySelectSql($includePicEmail) . ' ORDER BY f.id'
        );
        jsonResponse(['success' => true, 'data' => $facilities]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        requireAdmin();

        if ($action === 'pic-email') {
            $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
            if ($id <= 0) {
                jsonResponse(['success' => false, 'error' => 'Facility ID required'], 400);
            }

            $facility = $db->fetchOne(
                "SELECT f.id, f.name, p.full_name, p.phone, p.email,
                        GROUP_CONCAT(assigned.name ORDER BY assigned.name SEPARATOR ', ') AS facility_names
                 FROM facilities f
                 LEFT JOIN pics p ON p.id = f.pic_id
                 LEFT JOIN facilities assigned ON assigned.pic_id = p.id
                 WHERE f.id = ?
                 GROUP BY f.id, f.name, p.id, p.full_name, p.phone, p.email",
                [$id]
            );
            if (!$facility) {
                jsonResponse(['success' => false, 'error' => 'Facility not found'], 404);
            }

            $picEmail = trim((string)($facility['email'] ?? ''));
            if (!filter_var($picEmail, FILTER_VALIDATE_EMAIL)) {
                jsonResponse(['success' => false, 'error' => 'Sila tetapkan e-mel PIC yang sah sebelum hantar e-mel percubaan.'], 422);
            }

            if (!sendPicTestEmail($facility)) {
                jsonResponse(['success' => false, 'error' => 'E-mel percubaan gagal dihantar. Semak konfigurasi mail server.'], 500);
            }

            jsonResponse(['success' => true, 'message' => 'E-mel percubaan telah dihantar kepada PIC.']);
        }

        $input = jsonInput();

        $name = trim((string)($input['name'] ?? ''));
        $icon = trim((string)($input['icon'] ?? 'bi-building'));
        $capacity = (int)($input['capacity'] ?? 0);
        $pricePerHour = (float)($input['price_per_hour'] ?? 0);
        $maxRooms = array_key_exists('max_rooms', $input) && $input['max_rooms'] !== null && $input['max_rooms'] !== ''
            ? (int)$input['max_rooms']
            : null;
        $description = trim((string)($input['description'] ?? ''));
        $picId = normalizeFacilityPicId($db, $input['pic_id'] ?? null);
        $equipmentOptions = normalizeFacilityEquipmentOptions($input['equipment_options'] ?? '');
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
        if ($maxRooms !== null && ($maxRooms < 1 || $maxRooms > 500)) {
            $errors['max_rooms'] = 'Had bilik mesti antara 1 hingga 500.';
        }

        if (strlen($description) > 2000) {
            $errors['description'] = 'Keterangan terlalu panjang.';
        }
        if ($errors) {
            jsonResponse(['success' => false, 'error' => 'Maklumat fasiliti tidak lengkap.', 'errors' => $errors], 422);
        }

        $id = $db->insert(
            'INSERT INTO facilities (name, icon, capacity, price_per_hour, max_rooms, description, pic_id, equipment_options, is_available)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$name, $icon, $capacity, $pricePerHour, $maxRooms, $description, $picId, $equipmentOptions, $isAvailable]
        );
        $facility = $db->fetchOne(
            facilitySelectSql(true) . ' WHERE f.id = ?',
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

        $facility = $db->fetchOne('SELECT id, name, icon, capacity, price_per_hour, max_rooms, description, pic_id, equipment_options, is_available FROM facilities WHERE id = ?', [$id]);
        if (!$facility) {
            jsonResponse(['success' => false, 'error' => 'Facility not found'], 404);
        }

        if ($action === 'pic') {
            $picId = normalizeFacilityPicId($db, $input['pic_id'] ?? null);
            $db->update('UPDATE facilities SET pic_id = ? WHERE id = ?', [$picId, $id]);
            $updated = $db->fetchOne(facilitySelectSql(true) . ' WHERE f.id = ?', [$id]);
            jsonResponse(['success' => true, 'message' => 'Tugasan PIC berjaya dikemas kini.', 'data' => $updated]);
        }

        $name = array_key_exists('name', $input) ? trim((string)$input['name']) : (string)$facility['name'];
        $icon = array_key_exists('icon', $input) ? trim((string)$input['icon']) : (string)$facility['icon'];
        $capacity = array_key_exists('capacity', $input) ? (int)$input['capacity'] : (int)$facility['capacity'];
        $pricePerHour = array_key_exists('price_per_hour', $input) ? (float)$input['price_per_hour'] : (float)$facility['price_per_hour'];
        $maxRooms = array_key_exists('max_rooms', $input)
            ? (($input['max_rooms'] === null || $input['max_rooms'] === '') ? null : (int)$input['max_rooms'])
            : ($facility['max_rooms'] === null ? null : (int)$facility['max_rooms']);
        $description = array_key_exists('description', $input) ? trim((string)$input['description']) : (string)($facility['description'] ?? '');
        $picId = array_key_exists('pic_id', $input)
            ? normalizeFacilityPicId($db, $input['pic_id'])
            : ($facility['pic_id'] === null ? null : (int)$facility['pic_id']);
        $equipmentOptions = array_key_exists('equipment_options', $input)
            ? normalizeFacilityEquipmentOptions($input['equipment_options'])
            : (string)($facility['equipment_options'] ?? '[]');
        $isAvailable = array_key_exists('is_available', $input) ? (int)(bool)$input['is_available'] : (int)$facility['is_available'];
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
        if ($maxRooms !== null && ($maxRooms < 1 || $maxRooms > 500)) {
            $errors['max_rooms'] = 'Had bilik mesti antara 1 hingga 500.';
        }
        if (strlen($description) > 2000) {
            $errors['description'] = 'Keterangan terlalu panjang.';
        }
        if ($errors) {
            jsonResponse(['success' => false, 'error' => 'Maklumat fasiliti tidak lengkap.', 'errors' => $errors], 422);
        }

        withFacilityAvailabilityLock($db, $id, function () use ($db, $id, $name, $icon, $capacity, $pricePerHour, $maxRooms, $description, $picId, $equipmentOptions, $isAvailable): void {
            $db->update(
                'UPDATE facilities
                 SET name = ?, icon = ?, capacity = ?, price_per_hour = ?, max_rooms = ?, description = ?, pic_id = ?, equipment_options = ?, is_available = ?
                 WHERE id = ?',
                [$name, $icon, $capacity, $pricePerHour, $maxRooms, $description, $picId, $equipmentOptions, $isAvailable, $id]
            );
        });
        $updated = $db->fetchOne(
            facilitySelectSql(true) . ' WHERE f.id = ?',
            [$id]
        );
        jsonResponse(['success' => true, 'message' => 'Facility updated', 'data' => $updated]);
    }

    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
} catch (BookingAvailabilityException $e) {
    jsonResponse(['success' => false, 'error' => $e->getMessage()], $e->httpStatus());
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'Facility request failed'], 500);
}
?>
