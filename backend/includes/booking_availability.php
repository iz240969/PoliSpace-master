<?php
declare(strict_types=1);

const BLOCKING_BOOKING_STATUSES = ['pending', 'approved'];
const BOOKING_DATE_LOCK_TIMEOUT_SECONDS = 10;
const ASRAMA_NORMAL_ROOM_LIMIT_MAX = 30;
const ASRAMA_HOLIDAY_ROOM_LIMIT_MAX = 100;
const ASRAMA_TOTAL_ROOM_LIMIT_MAX = 200;

final class BookingAvailabilityException extends RuntimeException
{
    public function __construct(string $message, private readonly int $httpStatus = 409)
    {
        parent::__construct($message);
    }

    public function httpStatus(): int
    {
        return $this->httpStatus;
    }
}

function withBookingDateLock(Database $db, int $facilityId, string $bookingDate, callable $callback): mixed
{
    return withBookingDateLocks($db, [[$facilityId, $bookingDate]], $callback);
}

function withBookingDateLocks(Database $db, array $facilityDates, callable $callback): mixed
{
    $lockNames = array_map(
        static fn(array $item): string => sprintf('polspace:facility:%d:%s', (int)$item[0], (string)$item[1]),
        $facilityDates
    );
    return withNamedBookingLocks($db, $lockNames, $callback);
}

function withFacilityBookingDateLocks(
    Database $db,
    int $facilityId,
    array $bookingDates,
    callable $callback
): mixed {
    $lockNames = [sprintf('polspace:facility:%d:availability', $facilityId)];
    foreach ($bookingDates as $bookingDate) {
        $lockNames[] = sprintf('polspace:facility:%d:%s', $facilityId, (string)$bookingDate);
    }
    return withNamedBookingLocks($db, $lockNames, $callback);
}

function withFacilityAvailabilityLock(Database $db, int $facilityId, callable $callback): mixed
{
    return withNamedBookingLocks(
        $db,
        [sprintf('polspace:facility:%d:availability', $facilityId)],
        $callback
    );
}

function withBookingMutationLocks(
    Database $db,
    int $bookingId,
    int $facilityId,
    array $bookingDates,
    bool $lockFacilityAvailability,
    callable $callback
): mixed {
    $lockNames = [sprintf('polspace:booking:%d', $bookingId)];
    if ($lockFacilityAvailability) {
        $lockNames[] = sprintf('polspace:facility:%d:availability', $facilityId);
    }
    foreach ($bookingDates as $bookingDate) {
        $lockNames[] = sprintf('polspace:facility:%d:%s', $facilityId, (string)$bookingDate);
    }
    return withNamedBookingLocks($db, $lockNames, $callback);
}

function withNamedBookingLocks(Database $db, array $lockNames, callable $callback): mixed
{
    $lockNames = array_values(array_unique($lockNames));
    sort($lockNames, SORT_STRING);
    $acquiredLocks = [];

    try {
        foreach ($lockNames as $lockName) {
            $lock = $db->fetchOne('SELECT GET_LOCK(?, ?) AS acquired', [$lockName, BOOKING_DATE_LOCK_TIMEOUT_SECONDS]);
            if ((int)($lock['acquired'] ?? 0) !== 1) {
                throw new BookingAvailabilityException(
                    'Semakan ketersediaan sedang sibuk. Sila cuba lagi.',
                    503
                );
            }
            $acquiredLocks[] = $lockName;
        }

        return $callback();
    } finally {
        foreach (array_reverse($acquiredLocks) as $lockName) {
            $db->fetchOne('SELECT RELEASE_LOCK(?) AS released', [$lockName]);
        }
    }
}

function hasBlockingBookingConflict(
    Database $db,
    int $facilityId,
    string $bookingDate,
    ?int $excludeBookingId = null
): bool {
    return hasBlockingBookingDateRangeConflict($db, $facilityId, [$bookingDate], $excludeBookingId);
}

function bookingBlockedDates(string $bookingDate, string|int|null $duration = '1', string $durationUnit = 'hour'): array
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $bookingDate);
    if (!$date || $date->format('Y-m-d') !== $bookingDate) {
        return [];
    }

    $days = $durationUnit === 'day' ? max(1, min(30, (int)$duration)) : 1;
    $dates = [];
    for ($i = 0; $i < $days; $i += 1) {
        $dates[] = $date->modify("+{$i} days")->format('Y-m-d');
    }
    return $dates;
}

function cancelSupersededUnpaidBookings(Database $db, array $confirmedBooking): int
{
    $confirmedDates = bookingBlockedDates(
        (string)$confirmedBooking['booking_date'],
        $confirmedBooking['duration'] ?? '1',
        (string)($confirmedBooking['duration_unit'] ?? 'hour')
    );
    if (!$confirmedDates) return 0;

    $facilityId = (int)$confirmedBooking['facility_id'];
    $lookback = (new DateTimeImmutable(min($confirmedDates)))->modify('-30 days')->format('Y-m-d');
    $candidates = $db->fetchAll(
        "SELECT id, booking_date, duration, duration_unit, asrama_type,
                asrama_lelaki_rooms, asrama_perempuan_rooms, room_count
         FROM bookings
         WHERE facility_id = ? AND id <> ? AND status = 'unpaid'
           AND (payment_file IS NULL OR payment_file = '')
           AND booking_date BETWEEN ? AND ?",
        [$facilityId, (int)$confirmedBooking['id'], $lookback, max($confirmedDates)]
    );
    $asrama = isAsramaRoomFacilityName((string)$confirmedBooking['facility_name']);
    $cancelled = 0;
    foreach ($candidates as $candidate) {
        $overlap = array_values(array_intersect($confirmedDates, bookingBlockedDates(
            (string)$candidate['booking_date'],
            $candidate['duration'] ?? '1',
            (string)($candidate['duration_unit'] ?? 'hour')
        )));
        if (!$overlap) continue;

        if ($asrama) {
            $rooms = asramaBookingRoomSplit($candidate);
            $snapshot = getAsramaCapacitySnapshot($db, $facilityId, $overlap);
            $stillAvailable = true;
            foreach ($snapshot['dates'] as $availability) {
                if ($rooms['male'] > $availability['remaining']['male']
                    || $rooms['female'] > $availability['remaining']['female']) {
                    $stillAvailable = false;
                    break;
                }
            }
            if ($stillAvailable) continue;
        }

        $reason = $asrama
            ? 'Dibatalkan secara automatik kerana baki bilik pada tarikh ini tidak mencukupi selepas tempahan lain diluluskan.'
            : 'Dibatalkan secara automatik kerana fasiliti pada tarikh ini telah diluluskan untuk tempahan lain.';
        $cancelled += $db->update(
            "UPDATE bookings SET status = 'cancelled', cancellation_reason = ?
             WHERE id = ? AND status = 'unpaid' AND (payment_file IS NULL OR payment_file = '')",
            [$reason, (int)$candidate['id']]
        );
    }
    return $cancelled;
}

function hasBlockingBookingDateRangeConflict(
    Database $db,
    int $facilityId,
    array $bookingDates,
    ?int $excludeBookingId = null
): bool {
    $bookingDates = array_values(array_unique(array_filter($bookingDates)));
    if (!$bookingDates) {
        return false;
    }

    $minDate = min($bookingDates);
    $maxDate = max($bookingDates);
    $lookback = (new DateTimeImmutable($minDate))->modify('-30 days')->format('Y-m-d');

    $sql = "SELECT id, booking_date, duration, duration_unit
            FROM bookings
            WHERE facility_id = ?
              AND booking_date BETWEEN ? AND ?
              AND status IN ('pending', 'approved')";
    $params = [$facilityId, $lookback, $maxDate];

    if ($excludeBookingId !== null) {
        $sql .= ' AND id <> ?';
        $params[] = $excludeBookingId;
    }

    $requested = array_flip($bookingDates);
    foreach ($db->fetchAll($sql, $params) as $booking) {
        $blockedDates = bookingBlockedDates(
            (string)$booking['booking_date'],
            $booking['duration'] ?? '1',
            (string)($booking['duration_unit'] ?? 'hour')
        );
        foreach ($blockedDates as $blockedDate) {
            if (isset($requested[$blockedDate])) {
                return true;
            }
        }
    }

    return false;
}

function assertBookingDateAvailable(
    Database $db,
    int $facilityId,
    string $bookingDate,
    ?int $excludeBookingId = null
): void {
    assertBookingDatesAvailable($db, $facilityId, [$bookingDate], $excludeBookingId);
}

function assertBookingDatesAvailable(
    Database $db,
    int $facilityId,
    array $bookingDates,
    ?int $excludeBookingId = null
): void {
    if (hasBlockingBookingDateRangeConflict($db, $facilityId, $bookingDates, $excludeBookingId)) {
        throw new BookingAvailabilityException(
            'Tarikh ini telah dikunci oleh tempahan berbayar. Sila pilih tarikh lain.'
        );
    }
}

function ensureAsramaCapacitySettingsTable(Database $db): void
{
    static $checked = false;
    if ($checked) return;
    $checked = true;

    $db->query(
        "CREATE TABLE IF NOT EXISTS asrama_capacity_settings (
            facility_id INT PRIMARY KEY,
            normal_male_limit TINYINT UNSIGNED NOT NULL DEFAULT 30,
            normal_female_limit TINYINT UNSIGNED NOT NULL DEFAULT 30,
            holiday_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            holiday_start_date DATE NULL,
            holiday_end_date DATE NULL,
            holiday_male_limit TINYINT UNSIGNED NOT NULL DEFAULT 30,
            holiday_female_limit TINYINT UNSIGNED NOT NULL DEFAULT 30,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT chk_asrama_normal_male_limit CHECK (normal_male_limit <= 30),
            CONSTRAINT chk_asrama_normal_female_limit CHECK (normal_female_limit <= 30),
            CONSTRAINT chk_asrama_holiday_male_limit CHECK (holiday_male_limit <= 100),
            CONSTRAINT chk_asrama_holiday_female_limit CHECK (holiday_female_limit <= 100),
            CONSTRAINT chk_asrama_holiday_dates CHECK (
                holiday_start_date IS NULL OR holiday_end_date IS NULL OR holiday_end_date >= holiday_start_date
            ),
            CONSTRAINT fk_asrama_capacity_facility
                FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function getAsramaCapacitySettings(Database $db, int $facilityId): array
{
    ensureAsramaCapacitySettingsTable($db);
    $db->query(
        'INSERT IGNORE INTO asrama_capacity_settings (
            facility_id, normal_male_limit, normal_female_limit,
            holiday_male_limit, holiday_female_limit
         ) VALUES (?, 30, 30, 30, 30)',
        [$facilityId]
    );
    $settings = $db->fetchOne(
        'SELECT facility_id, normal_male_limit, normal_female_limit, holiday_enabled,
                holiday_start_date, holiday_end_date, holiday_male_limit, holiday_female_limit,
                created_at, updated_at
         FROM asrama_capacity_settings
         WHERE facility_id = ?',
        [$facilityId]
    );
    if (!$settings) {
        throw new BookingAvailabilityException('Tetapan kapasiti asrama tidak dapat dimuatkan.', 500);
    }

    foreach (['facility_id', 'normal_male_limit', 'normal_female_limit', 'holiday_male_limit', 'holiday_female_limit'] as $field) {
        $settings[$field] = (int)$settings[$field];
    }
    $settings['holiday_enabled'] = (bool)$settings['holiday_enabled'];
    return $settings;
}

function asramaRoomLimitsForDate(array $settings, string $bookingDate): array
{
    $holidayActive = !empty($settings['holiday_enabled'])
        && !empty($settings['holiday_start_date'])
        && !empty($settings['holiday_end_date'])
        && $bookingDate >= (string)$settings['holiday_start_date']
        && $bookingDate <= (string)$settings['holiday_end_date'];

    return [
        'male' => (int)($holidayActive ? $settings['holiday_male_limit'] : $settings['normal_male_limit']),
        'female' => (int)($holidayActive ? $settings['holiday_female_limit'] : $settings['normal_female_limit']),
        'holiday_active' => $holidayActive,
    ];
}

function asramaBookingRoomSplit(array $booking): array
{
    $male = max(0, (int)($booking['asrama_lelaki_rooms'] ?? 0));
    $female = max(0, (int)($booking['asrama_perempuan_rooms'] ?? 0));
    $total = max(0, (int)($booking['room_count'] ?? 0));
    if ($male + $female > 0 || $total < 1) {
        return ['male' => $male, 'female' => $female];
    }

    $types = array_values(array_filter(array_map('trim', explode(',', strtolower((string)($booking['asrama_type'] ?? ''))))));
    if ($types === ['perempuan']) {
        return ['male' => 0, 'female' => $total];
    }
    if (in_array('lelaki', $types, true) && in_array('perempuan', $types, true)) {
        $male = (int)ceil($total / 2);
        return ['male' => $male, 'female' => $total - $male];
    }
    return ['male' => $total, 'female' => 0];
}

function getAsramaRoomUsageByDate(
    Database $db,
    int $facilityId,
    array $bookingDates,
    ?int $excludeBookingId = null
): array {
    $bookingDates = array_values(array_unique(array_filter($bookingDates)));
    $usage = [];
    foreach ($bookingDates as $bookingDate) {
        $usage[$bookingDate] = ['male' => 0, 'female' => 0];
    }
    if (!$bookingDates) return $usage;

    $minDate = min($bookingDates);
    $maxDate = max($bookingDates);
    $lookback = (new DateTimeImmutable($minDate))->modify('-30 days')->format('Y-m-d');
    $sql = "SELECT id, booking_date, duration, duration_unit, asrama_type,
                   asrama_lelaki_rooms, asrama_perempuan_rooms, room_count
            FROM bookings
            WHERE facility_id = ?
              AND booking_date BETWEEN ? AND ?
              AND status IN ('pending', 'approved')";
    $params = [$facilityId, $lookback, $maxDate];
    if ($excludeBookingId !== null) {
        $sql .= ' AND id <> ?';
        $params[] = $excludeBookingId;
    }

    foreach ($db->fetchAll($sql, $params) as $booking) {
        $split = asramaBookingRoomSplit($booking);
        foreach (bookingBlockedDates(
            (string)$booking['booking_date'],
            $booking['duration'] ?? '1',
            (string)($booking['duration_unit'] ?? 'day')
        ) as $blockedDate) {
            if (!isset($usage[$blockedDate])) continue;
            $usage[$blockedDate]['male'] += $split['male'];
            $usage[$blockedDate]['female'] += $split['female'];
        }
    }
    return $usage;
}

function getAsramaCapacitySnapshot(
    Database $db,
    int $facilityId,
    array $bookingDates,
    ?int $excludeBookingId = null
): array {
    $settings = getAsramaCapacitySettings($db, $facilityId);
    $usage = getAsramaRoomUsageByDate($db, $facilityId, $bookingDates, $excludeBookingId);
    $dates = [];
    foreach ($usage as $bookingDate => $used) {
        $limits = asramaRoomLimitsForDate($settings, $bookingDate);
        $dates[$bookingDate] = [
            'limits' => ['male' => $limits['male'], 'female' => $limits['female']],
            'used' => $used,
            'remaining' => [
                'male' => max(0, $limits['male'] - $used['male']),
                'female' => max(0, $limits['female'] - $used['female']),
            ],
            'holiday_active' => $limits['holiday_active'],
        ];
    }
    return ['settings' => $settings, 'dates' => $dates];
}

function assertAsramaCapacityAvailable(
    Database $db,
    int $facilityId,
    array $bookingDates,
    int $maleRooms,
    int $femaleRooms,
    ?int $excludeBookingId = null
): void {
    $snapshot = getAsramaCapacitySnapshot($db, $facilityId, $bookingDates, $excludeBookingId);
    foreach ($snapshot['dates'] as $bookingDate => $availability) {
        if ($maleRooms > (int)$availability['remaining']['male']) {
            throw new BookingAvailabilityException(
                sprintf('Baki bilik Blok Lelaki pada %s hanya %d bilik.', $bookingDate, $availability['remaining']['male']),
                409
            );
        }
        if ($femaleRooms > (int)$availability['remaining']['female']) {
            throw new BookingAvailabilityException(
                sprintf('Baki bilik Blok Perempuan pada %s hanya %d bilik.', $bookingDate, $availability['remaining']['female']),
                409
            );
        }
    }
}
?>
