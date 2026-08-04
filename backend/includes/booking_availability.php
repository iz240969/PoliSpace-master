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
    $sql = "SELECT id
            FROM bookings
            WHERE facility_id = ?
              AND booking_date = ?
              AND status IN ('pending', 'approved')";
    $params = [$facilityId, $bookingDate];

    if ($excludeBookingId !== null) {
        $sql .= ' AND id <> ?';
        $params[] = $excludeBookingId;
    }

    $sql .= ' LIMIT 1';
    return (bool)$db->fetchOne($sql, $params);
}

function assertBookingDateAvailable(
    Database $db,
    int $facilityId,
    string $bookingDate,
    ?int $excludeBookingId = null
): void {
    if (hasBlockingBookingConflict($db, $facilityId, $bookingDate, $excludeBookingId)) {
        throw new BookingAvailabilityException(
            'Tarikh ini telah dikunci oleh tempahan berbayar. Sila pilih tarikh lain.'
        );
    }
}
?>
