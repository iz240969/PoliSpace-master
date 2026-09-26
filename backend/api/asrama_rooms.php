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
$action = (string)($_GET['action'] ?? '');

function getAsramaFacilityForCapacity(Database $db): array
{
    $facility = $db->fetchOne(
        "SELECT id, name, is_available
         FROM facilities
         WHERE LOWER(name) LIKE '%asrama%'
           AND LOWER(name) LIKE '%bilik%'
         ORDER BY id
         LIMIT 1"
    );
    if (!$facility) {
        jsonResponse(['success' => false, 'error' => 'Fasiliti Asrama - Bilik tidak dijumpai.'], 404);
    }
    return $facility;
}

function normalizeAsramaSettingsDate(mixed $value, string $label, bool $required): ?string
{
    $date = trim((string)($value ?? ''));
    if ($date === '') {
        if ($required) {
            jsonResponse(['success' => false, 'error' => "{$label} diperlukan apabila Mod Cuti Panjang diaktifkan."], 422);
        }
        return null;
    }
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$parsed || $parsed->format('Y-m-d') !== $date) {
        jsonResponse(['success' => false, 'error' => "{$label} tidak sah."], 422);
    }
    return $date;
}

function normalizeAsramaLimit(array $input, string $field, int $maximum, string $label): int
{
    if (!array_key_exists($field, $input)) {
        jsonResponse(['success' => false, 'error' => "{$label} diperlukan."], 422);
    }
    $value = filter_var($input[$field], FILTER_VALIDATE_INT);
    if ($value === false || $value < 0 || $value > $maximum) {
        jsonResponse(['success' => false, 'error' => "{$label} mesti antara 0 hingga {$maximum} bilik."], 422);
    }
    return (int)$value;
}

try {
    $facility = getAsramaFacilityForCapacity($db);
    $facilityId = (int)$facility['id'];

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'availability') {
        $bookingDate = trim((string)($_GET['date'] ?? ''));
        $duration = filter_var($_GET['duration'] ?? 1, FILTER_VALIDATE_INT);
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $bookingDate);
        if (!$parsed || $parsed->format('Y-m-d') !== $bookingDate || $duration === false || $duration < 1 || $duration > 30) {
            jsonResponse(['success' => false, 'error' => 'Tarikh atau tempoh asrama tidak sah.'], 422);
        }
        $dates = bookingBlockedDates($bookingDate, (string)$duration, 'day');
        jsonResponse(['success' => true, 'data' => getAsramaCapacitySnapshot($db, $facilityId, $dates)]);
    }

    requireAdmin();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $today = date('Y-m-d');
        $snapshot = getAsramaCapacitySnapshot($db, $facilityId, [$today]);
        jsonResponse([
            'success' => true,
            'data' => [
                'facility' => $facility,
                'settings' => $snapshot['settings'],
                'today' => $snapshot['dates'][$today],
                'today_date' => $today,
            ],
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $input = jsonInput();
        $normalMale = normalizeAsramaLimit($input, 'normal_male_limit', ASRAMA_NORMAL_ROOM_LIMIT_MAX, 'Had biasa Blok Lelaki');
        $normalFemale = normalizeAsramaLimit($input, 'normal_female_limit', ASRAMA_NORMAL_ROOM_LIMIT_MAX, 'Had biasa Blok Perempuan');
        $holidayMale = normalizeAsramaLimit($input, 'holiday_male_limit', ASRAMA_HOLIDAY_ROOM_LIMIT_MAX, 'Had Cuti Panjang Blok Lelaki');
        $holidayFemale = normalizeAsramaLimit($input, 'holiday_female_limit', ASRAMA_HOLIDAY_ROOM_LIMIT_MAX, 'Had Cuti Panjang Blok Perempuan');
        $holidayEnabled = strictBooleanInput($input['holiday_enabled'] ?? false);
        if ($holidayEnabled === null) {
            jsonResponse(['success' => false, 'error' => 'Status Mod Cuti Panjang tidak sah.'], 422);
        }
        $holidayStart = normalizeAsramaSettingsDate($input['holiday_start_date'] ?? null, 'Tarikh mula', $holidayEnabled);
        $holidayEnd = normalizeAsramaSettingsDate($input['holiday_end_date'] ?? null, 'Tarikh tamat', $holidayEnabled);
        if ($holidayStart !== null && $holidayEnd !== null && $holidayEnd < $holidayStart) {
            jsonResponse(['success' => false, 'error' => 'Tarikh tamat mesti pada atau selepas tarikh mula.'], 422);
        }

        withFacilityAvailabilityLock($db, $facilityId, function () use (
            $db,
            $facilityId,
            $normalMale,
            $normalFemale,
            $holidayEnabled,
            $holidayStart,
            $holidayEnd,
            $holidayMale,
            $holidayFemale
        ): void {
            ensureAsramaCapacitySettingsTable($db);
            $db->query(
                'INSERT INTO asrama_capacity_settings (
                    facility_id, normal_male_limit, normal_female_limit, holiday_enabled,
                    holiday_start_date, holiday_end_date, holiday_male_limit, holiday_female_limit
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    normal_male_limit = VALUES(normal_male_limit),
                    normal_female_limit = VALUES(normal_female_limit),
                    holiday_enabled = VALUES(holiday_enabled),
                    holiday_start_date = VALUES(holiday_start_date),
                    holiday_end_date = VALUES(holiday_end_date),
                    holiday_male_limit = VALUES(holiday_male_limit),
                    holiday_female_limit = VALUES(holiday_female_limit)',
                [
                    $facilityId,
                    $normalMale,
                    $normalFemale,
                    (int)$holidayEnabled,
                    $holidayStart,
                    $holidayEnd,
                    $holidayMale,
                    $holidayFemale,
                ]
            );
        });

        $today = date('Y-m-d');
        $snapshot = getAsramaCapacitySnapshot($db, $facilityId, [$today]);
        jsonResponse([
            'success' => true,
            'message' => 'Tetapan kapasiti asrama berjaya disimpan.',
            'data' => [
                'facility' => $facility,
                'settings' => $snapshot['settings'],
                'today' => $snapshot['dates'][$today],
                'today_date' => $today,
            ],
        ]);
    }

    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
} catch (BookingAvailabilityException $e) {
    jsonResponse(['success' => false, 'error' => $e->getMessage()], $e->httpStatus());
} catch (Throwable $e) {
    $message = defined('APP_DEBUG') && APP_DEBUG ? $e->getMessage() : 'Pengurusan kapasiti asrama gagal.';
    jsonResponse(['success' => false, 'error' => $message], 500);
}
?>
