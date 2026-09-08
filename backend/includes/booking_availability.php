<?php
declare(strict_types=1);

const BLOCKING_BOOKING_STATUSES = ['pending', 'approved'];
const BOOKING_DATE_LOCK_TIMEOUT_SECONDS = 10;

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

function assertAsramaRoomInventoryAvailable(Database $db, int $facilityId, int $maleRooms, int $femaleRooms): void
{
    $tableExists = (int)($db->fetchOne(
        "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asrama_rooms'"
    )['count'] ?? 0);
    if ($tableExists < 1) {
        return;
    }

    $inventory = $db->fetchAll(
        'SELECT gender, COUNT(*) AS available_rooms FROM asrama_rooms WHERE facility_id = ? AND is_available = 1 GROUP BY gender',
        [$facilityId]
    );
    if (!$inventory) {
        return;
    }
    $available = ['male' => 0, 'female' => 0];
    foreach ($inventory as $item) {
        $available[(string)$item['gender']] = (int)$item['available_rooms'];
    }
    if ($maleRooms > $available['male']) {
        throw new BookingAvailabilityException('Bilik asrama lelaki yang tersedia tidak mencukupi.', 409);
    }
    if ($femaleRooms > $available['female']) {
        throw new BookingAvailabilityException('Bilik asrama perempuan yang tersedia tidak mencukupi.', 409);
    }
}
?>
