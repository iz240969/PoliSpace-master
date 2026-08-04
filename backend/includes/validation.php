<?php
declare(strict_types=1);

function minimumBookingDate(): string
{
    return (new DateTimeImmutable('today'))->modify('+3 days')->format('Y-m-d');
}

function bookingTimeValueToMinutes(string $time): ?int
{
    if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time)) {
        return null;
    }

    [$hours, $minutes] = array_map('intval', explode(':', $time));
    return ($hours * 60) + $minutes;
}

function validateBookingScheduleData(array $data): array
{
    $errors = [];
    $bookingDate = trim((string)($data['booking_date'] ?? ''));
    if ($bookingDate !== '') {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $bookingDate);
        if (!$date || $date->format('Y-m-d') !== $bookingDate) {
            $errors['booking_date'] = 'Tarikh tempahan tidak sah.';
        } elseif ($bookingDate < minimumBookingDate()) {
            $errors['booking_date'] = 'Tempahan mesti dibuat sekurang-kurangnya 3 hari lebih awal.';
        }
    }

    $startTime = trim((string)($data['start_time'] ?? ''));
    $startMinutes = $startTime === '' ? null : bookingTimeValueToMinutes($startTime);
    if ($startTime !== '' && $startMinutes === null) {
        $errors['start_time'] = 'Masa mula tidak sah.';
    }

    $duration = trim((string)($data['duration'] ?? '1'));
    if (!ctype_digit($duration) || (int)$duration < 1 || (int)$duration > 24) {
        $errors['duration'] = 'Tempoh penggunaan mesti antara 1 hingga 24 jam penuh.';
    }

    $endTime = trim((string)($data['end_time'] ?? ''));
    $endMinutes = $endTime === '' ? null : bookingTimeValueToMinutes($endTime);
    if ($endTime !== '' && $endMinutes === null) {
        $errors['end_time'] = 'Masa tamat tidak sah.';
    }

    if ($startMinutes !== null && ctype_digit($duration)) {
        $expectedEnd = $startMinutes + ((int)$duration * 60);
        if ($expectedEnd >= 24 * 60) {
            $errors['end_time'] = 'Tempahan mesti tamat pada hari yang sama.';
        } elseif ($endMinutes !== null && $endMinutes !== $expectedEnd) {
            $errors['end_time'] = 'Masa tamat tidak sepadan dengan tempoh penggunaan.';
        }
    }

    if (!isset($data['participant_count']) || (int)$data['participant_count'] < 1) {
        $errors['participant_count'] = 'Jumlah pengguna mesti sekurang-kurangnya 1.';
    } elseif ((int)$data['participant_count'] > 5000) {
        $errors['participant_count'] = 'Jumlah pengguna terlalu besar.';
    }

    return $errors;
}

function validateBookingData(array $data): array
{
    $errors = [];
    $required = ['full_name', 'email', 'phone', 'facility_id', 'booking_date', 'start_time', 'purpose'];

    foreach ($required as $field) {
        if (empty($data[$field])) {
            $errors[$field] = ucfirst(str_replace('_', ' ', $field)) . ' is required';
        }
    }

    if (!empty($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Invalid email format';
    }

    if (!empty($data['full_name']) && strlen((string)$data['full_name']) > 100) {
        $errors['full_name'] = 'Full name must be 100 characters or fewer';
    }

    if (!empty($data['phone']) && (!preg_match('/^[0-9+\-\s()]+$/', (string)$data['phone']) || strlen((string)$data['phone']) > 20)) {
        $errors['phone'] = 'Invalid phone number format';
    }

    if (!empty($data['facility_id']) && (!ctype_digit((string)$data['facility_id']) || (int)$data['facility_id'] < 1)) {
        $errors['facility_id'] = 'Valid facility is required';
    }

    $errors = array_merge($errors, validateBookingScheduleData($data));

    if (!empty($data['purpose']) && strlen((string)$data['purpose']) > 1000) {
        $errors['purpose'] = 'Purpose must be 1000 characters or fewer';
    }

    if (isset($data['equipment_required']) && !isAllowedBookingEquipment((string)$data['equipment_required'])) {
        $errors['equipment_required'] = 'Invalid equipment option';
    }

    return $errors;
}

function isAllowedBookingEquipment(string $equipment): bool
{
    $equipment = trim($equipment);
    if ($equipment === '') {
        return true;
    }

    if (strlen($equipment) > 500) {
        return false;
    }

    $allowed = ['Mikrofon', 'Projektor', 'PA System', 'Kerusi Tambahan', 'Meja Tambahan'];
    $seen = [];
    foreach (explode(',', $equipment) as $part) {
        $item = trim($part);
        if ($item === '') {
            return false;
        }

        if (in_array($item, $allowed, true)) {
            $name = $item;
        } elseif (preg_match('/^(.+?)\s+x\s+([1-9]\d{0,2})$/u', $item, $matches)) {
            $name = trim($matches[1]);
            if (!in_array($name, $allowed, true)) {
                return false;
            }
        } else {
            return false;
        }

        if (isset($seen[$name])) {
            return false;
        }
        $seen[$name] = true;
    }

    return true;
}

function validateContactMessage(array $data): array
{
    $errors = [];

    if (empty($data['email']) || !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Valid email is required';
    }

    $subjectLength = strlen((string)($data['subject'] ?? ''));
    if (empty($data['subject']) || $subjectLength < 3 || $subjectLength > 200) {
        $errors['subject'] = 'Subject must be between 3 and 200 characters';
    }

    $messageLength = strlen((string)($data['message'] ?? ''));
    if (empty($data['message']) || $messageLength < 10 || $messageLength > 5000) {
        $errors['message'] = 'Message must be between 10 and 5000 characters';
    }

    return $errors;
}
?>
