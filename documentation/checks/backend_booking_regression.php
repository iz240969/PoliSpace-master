<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/backend/includes/validation.php';
require_once dirname(__DIR__, 2) . '/backend/includes/booking_availability.php';
require_once dirname(__DIR__, 2) . '/backend/includes/functions.php';

$failures = [];
$checks = 0;

function check(bool $condition, string $message): void
{
    global $checks, $failures;
    $checks += 1;
    if (!$condition) {
        $failures[] = $message;
    }
}

check(bookingEstimatedCost(450, 1, 'hour') === 450.0, 'One-hour booking uses one daily rate.');
check(bookingEstimatedCost(450, 8, 'hour') === 450.0, 'More hours do not increase the daily rate.');
check(bookingEstimatedCost(450, 3, 'day') === 1350.0, 'Multi-day booking uses the number of days.');
check(bookingEstimatedCost(10, 3, 'day', 4) === 120.0, 'Asrama multiplies days by room count.');

$tomorrow = (new DateTimeImmutable('today'))->modify('+1 day')->format('Y-m-d');
$lateReceiptSchedule = [
    'booking_date' => $tomorrow,
    'start_time' => '09:00',
    'end_time' => '11:00',
    'duration' => '2',
    'duration_unit' => 'hour',
    'participant_count' => '10',
];

$creationErrors = validateBookingScheduleData($lateReceiptSchedule);
check(isset($creationErrors['booking_date']), 'New bookings must still enforce the three-day lead time.');

$receiptErrors = validateBookingScheduleData($lateReceiptSchedule, false);
check(!isset($receiptErrors['booking_date']), 'A later receipt upload must not reapply the booking creation lead time.');
check($receiptErrors === [], 'A stored valid schedule must remain valid when a receipt is uploaded later.');

$pastReceiptSchedule = $lateReceiptSchedule;
$pastReceiptSchedule['booking_date'] = (new DateTimeImmutable('today'))->modify('-1 day')->format('Y-m-d');
check(
    isset(validateBookingScheduleData($pastReceiptSchedule, false)['booking_date']),
    'A receipt must not activate a booking whose event date has already passed.'
);

$invalidStoredSchedule = $lateReceiptSchedule;
$invalidStoredSchedule['booking_date'] = '2026-02-30';
check(
    isset(validateBookingScheduleData($invalidStoredSchedule, false)['booking_date']),
    'Receipt validation must still reject malformed stored dates.'
);

$invalidParticipant = $lateReceiptSchedule;
$invalidParticipant['booking_date'] = minimumBookingDate();
$invalidParticipant['participant_count'] = '12people';
check(
    isset(validateBookingScheduleData($invalidParticipant)['participant_count']),
    'Participant counts with trailing text must be rejected instead of silently truncated.'
);

$validParticipant = $invalidParticipant;
$validParticipant['participant_count'] = 12;
check(
    !isset(validateBookingScheduleData($validParticipant)['participant_count']),
    'Integer participant counts must remain accepted.'
);

check(strictIntegerInput('12rooms') === null, 'Malformed integer API values must not be silently truncated.');
check(strictIntegerInput('12') === 12, 'Whole-number strings must remain accepted by API validation.');
check(strictDecimalInput('free') === null, 'Malformed decimal API values must not silently become zero.');
check(strictDecimalInput('125.50') === 125.5, 'Decimal price strings must remain accepted by API validation.');
check(strictBooleanInput('false') === false, 'A false string must not be coerced to true.');
check(strictBooleanInput('disabled') === null, 'Unknown boolean API values must be rejected.');

check(bookingStatusTransitionError('pending', 'approved') === null, 'Pending bookings may be approved.');
check(bookingStatusTransitionError('pending', 'rejected') === null, 'Pending bookings may be rejected.');
check(bookingStatusTransitionError('approved', 'cancelled') === null, 'Approved bookings may be cancelled.');
check(bookingStatusTransitionError('approved', 'rejected') !== null, 'Approved bookings must use cancellation, not rejection.');
check(bookingStatusTransitionError('unpaid', 'rejected') !== null, 'Unpaid bookings cannot be rejected through the admin review transition.');
check(bookingStatusTransitionError('pending', 'cancelled') !== null, 'Pending bookings cannot use the admin approved-booking cancellation transition.');

check(bookingFacilityDurationUnitError(false, 'hour') === null, 'Normal facilities accept hour durations.');
check(bookingFacilityDurationUnitError(false, 'day') === null, 'Normal facilities retain supported multi-day durations.');
check(bookingFacilityDurationUnitError(true, 'day') === null, 'Asrama accepts day durations.');
check(bookingFacilityDurationUnitError(true, 'hour') !== null, 'Asrama rejects hour durations.');

check(
    bookingBlockedDates('2026-10-30', '3', 'day') === ['2026-10-30', '2026-10-31', '2026-11-01'],
    'Day bookings must block every date across a month boundary.'
);
check(
    bookingBlockedDates('2026-10-30', '8', 'hour') === ['2026-10-30'],
    'Hour bookings must block only their selected date.'
);

$holidaySettings = [
    'normal_male_limit' => 30,
    'normal_female_limit' => 30,
    'holiday_enabled' => true,
    'holiday_start_date' => '2026-12-20',
    'holiday_end_date' => '2026-12-31',
    'holiday_male_limit' => 80,
    'holiday_female_limit' => 70,
];
check(
    asramaRoomLimitsForDate($holidaySettings, '2026-12-20') === ['male' => 80, 'female' => 70, 'holiday_active' => true],
    'Holiday capacity must include its start date.'
);
check(
    asramaRoomLimitsForDate($holidaySettings, '2027-01-01') === ['male' => 30, 'female' => 30, 'holiday_active' => false],
    'Normal capacity must resume after the holiday range.'
);
check(
    asramaBookingRoomSplit(['room_count' => 5, 'asrama_type' => 'lelaki,perempuan']) === ['male' => 3, 'female' => 2],
    'Legacy mixed Asrama bookings must retain deterministic room allocation.'
);

if ($failures) {
    fwrite(STDERR, "FAILED {$checks} checks:\n- " . implode("\n- ", $failures) . "\n");
    exit(1);
}

echo "Passed {$checks} backend booking regression checks.\n";
