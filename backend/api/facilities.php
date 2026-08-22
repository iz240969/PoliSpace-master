<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/booking_availability.php';

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

function ensureFacilityPicColumns(Database $db): void
{
    $nameColumn = $db->fetchOne("SHOW COLUMNS FROM facilities LIKE 'pic_full_name'");
    if (!$nameColumn) {
        $db->query('ALTER TABLE facilities ADD COLUMN pic_full_name VARCHAR(100) NULL AFTER description');
    }

    $phoneColumn = $db->fetchOne("SHOW COLUMNS FROM facilities LIKE 'pic_phone'");
    if (!$phoneColumn) {
        $db->query('ALTER TABLE facilities ADD COLUMN pic_phone VARCHAR(20) NULL AFTER pic_full_name');
    }

    $emailColumn = $db->fetchOne("SHOW COLUMNS FROM facilities LIKE 'pic_email'");
    if (!$emailColumn) {
        $db->query('ALTER TABLE facilities ADD COLUMN pic_email VARCHAR(100) NULL AFTER pic_phone');
    }

    $db->update("UPDATE facilities SET pic_full_name = CONCAT('Person ', id) WHERE pic_full_name IS NULL OR TRIM(pic_full_name) = ''");
    $db->update("UPDATE facilities SET pic_phone = CONCAT('012-000-', LPAD(id, 4, '0')) WHERE pic_phone IS NULL OR TRIM(pic_phone) = ''");
    $db->update("UPDATE facilities SET pic_email = CONCAT('person', id, '@polspace.local') WHERE pic_email IS NULL OR TRIM(pic_email) = ''");
}

function facilitySelectSql(bool $includePicEmail = false): string
{
    $picEmail = $includePicEmail ? ', pic_email' : '';
    return 'SELECT id, name, icon, capacity, price_per_hour, max_rooms, description, pic_full_name, pic_phone' . $picEmail . ', equipment_options, is_available, created_at, updated_at FROM facilities';
}

function validateFacilityPic(string $picFullName, string $picPhone, string $picEmail = '', bool $emailRequired = false): array
{
    $errors = [];
    if ($picFullName === '' || strlen($picFullName) > 100) {
        $errors['pic_full_name'] = 'Nama penuh PIC mesti diisi dan tidak melebihi 100 aksara.';
    }
    if (!preg_match('/^[0-9+()\-\s]{7,20}$/', $picPhone)) {
        $errors['pic_phone'] = 'Nombor telefon PIC tidak sah.';
    }
    if (($emailRequired || $picEmail !== '') && !filter_var($picEmail, FILTER_VALIDATE_EMAIL)) {
        $errors['pic_email'] = 'Alamat e-mel PIC tidak sah.';
    }

    return $errors;
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
    ensureFacilityPicColumns($db);
    backfillDefaultFacilityEquipment($db);
    $action = $_GET['action'] ?? '';

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $includePicEmail = !empty($_SESSION['admin_id']) && empty($_SESSION['user_id']);
        $facilities = $db->fetchAll(
            facilitySelectSql($includePicEmail) . ' ORDER BY id'
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
                'SELECT id, name, pic_full_name, pic_phone, pic_email FROM facilities WHERE id = ?',
                [$id]
            );
            if (!$facility) {
                jsonResponse(['success' => false, 'error' => 'Facility not found'], 404);
            }

            $picEmail = trim((string)($facility['pic_email'] ?? ''));
            if (!filter_var($picEmail, FILTER_VALIDATE_EMAIL)) {
                jsonResponse(['success' => false, 'error' => 'Sila tetapkan e-mel PIC yang sah sebelum hantar e-mel percubaan.'], 422);
            }

            $subject = 'PoliSpace - Percubaan E-mel PIC';
            $body = implode("\n", [
                'Assalamualaikum / Salam sejahtera,',
                '',
                'Ini ialah e-mel percubaan daripada sistem PoliSpace.',
                '',
                'Maklumat PIC:',
                'Nama: ' . ($facility['pic_full_name'] ?: '-'),
                'Telefon: ' . ($facility['pic_phone'] ?: '-'),
                'Fasiliti: ' . ($facility['name'] ?: '-'),
                '',
                'Nota: Fungsi ini disediakan untuk ujian sebelum automasi e-mel tempahan diaktifkan.',
                '',
                'Terima kasih.',
            ]);

            if (!sendPlainEmail($picEmail, $subject, $body)) {
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
        $picFullName = trim((string)($input['pic_full_name'] ?? ''));
        $picPhone = trim((string)($input['pic_phone'] ?? ''));
        $picEmail = trim((string)($input['pic_email'] ?? ''));
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
        $errors = array_merge($errors, validateFacilityPic($picFullName, $picPhone, $picEmail));

        if ($errors) {
            jsonResponse(['success' => false, 'error' => 'Maklumat fasiliti tidak lengkap.', 'errors' => $errors], 422);
        }

        $id = $db->insert(
            'INSERT INTO facilities (name, icon, capacity, price_per_hour, max_rooms, description, pic_full_name, pic_phone, pic_email, equipment_options, is_available)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$name, $icon, $capacity, $pricePerHour, $maxRooms, $description, $picFullName, $picPhone, $picEmail, $equipmentOptions, $isAvailable]
        );
        $facility = $db->fetchOne(
            facilitySelectSql(true) . ' WHERE id = ?',
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

        $facility = $db->fetchOne('SELECT id, name, icon, capacity, price_per_hour, max_rooms, description, pic_full_name, pic_phone, pic_email, equipment_options, is_available FROM facilities WHERE id = ?', [$id]);
        if (!$facility) {
            jsonResponse(['success' => false, 'error' => 'Facility not found'], 404);
        }

        if ($action === 'pic') {
            $picFullName = trim((string)($input['pic_full_name'] ?? ''));
            $picPhone = trim((string)($input['pic_phone'] ?? ''));
            $picEmail = trim((string)($input['pic_email'] ?? ''));
            $errors = validateFacilityPic($picFullName, $picPhone, $picEmail, true);
            if ($errors) {
                jsonResponse(['success' => false, 'error' => 'Maklumat PIC tidak lengkap.', 'errors' => $errors], 422);
            }

            $db->update(
                'UPDATE facilities SET pic_full_name = ?, pic_phone = ?, pic_email = ? WHERE id = ?',
                [$picFullName, $picPhone, $picEmail, $id]
            );
            $updated = $db->fetchOne(facilitySelectSql(true) . ' WHERE id = ?', [$id]);
            jsonResponse(['success' => true, 'message' => 'Maklumat PIC berjaya dikemas kini.', 'data' => $updated]);
        }

        $name = array_key_exists('name', $input) ? trim((string)$input['name']) : (string)$facility['name'];
        $icon = array_key_exists('icon', $input) ? trim((string)$input['icon']) : (string)$facility['icon'];
        $capacity = array_key_exists('capacity', $input) ? (int)$input['capacity'] : (int)$facility['capacity'];
        $pricePerHour = array_key_exists('price_per_hour', $input) ? (float)$input['price_per_hour'] : (float)$facility['price_per_hour'];
        $maxRooms = array_key_exists('max_rooms', $input)
            ? (($input['max_rooms'] === null || $input['max_rooms'] === '') ? null : (int)$input['max_rooms'])
            : ($facility['max_rooms'] === null ? null : (int)$facility['max_rooms']);
        $description = array_key_exists('description', $input) ? trim((string)$input['description']) : (string)($facility['description'] ?? '');
        $picFullName = array_key_exists('pic_full_name', $input) ? trim((string)$input['pic_full_name']) : (string)($facility['pic_full_name'] ?? '');
        $picPhone = array_key_exists('pic_phone', $input) ? trim((string)$input['pic_phone']) : (string)($facility['pic_phone'] ?? '');
        $picEmail = array_key_exists('pic_email', $input) ? trim((string)$input['pic_email']) : (string)($facility['pic_email'] ?? '');
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
        $errors = array_merge($errors, validateFacilityPic($picFullName, $picPhone, $picEmail));
        if ($errors) {
            jsonResponse(['success' => false, 'error' => 'Maklumat fasiliti tidak lengkap.', 'errors' => $errors], 422);
        }

        withFacilityAvailabilityLock($db, $id, function () use ($db, $id, $name, $icon, $capacity, $pricePerHour, $maxRooms, $description, $picFullName, $picPhone, $picEmail, $equipmentOptions, $isAvailable): void {
            $db->update(
                'UPDATE facilities
                 SET name = ?, icon = ?, capacity = ?, price_per_hour = ?, max_rooms = ?, description = ?, pic_full_name = ?, pic_phone = ?, pic_email = ?, equipment_options = ?, is_available = ?
                 WHERE id = ?',
                [$name, $icon, $capacity, $pricePerHour, $maxRooms, $description, $picFullName, $picPhone, $picEmail, $equipmentOptions, $isAvailable, $id]
            );
        });
        $updated = $db->fetchOne(
            facilitySelectSql(true) . ' WHERE id = ?',
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
