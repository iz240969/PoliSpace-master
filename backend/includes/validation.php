<?php
declare(strict_types=1);

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

    if (!empty($data['booking_date']) && $data['booking_date'] < date('Y-m-d')) {
        $errors['booking_date'] = 'Booking date cannot be in the past';
    }

    if (!empty($data['start_time']) && !preg_match('/^\d{2}:\d{2}$/', (string)$data['start_time'])) {
        $errors['start_time'] = 'Invalid start time format';
    }

    if (!empty($data['end_time']) && !preg_match('/^\d{2}:\d{2}$/', (string)$data['end_time'])) {
        $errors['end_time'] = 'Invalid end time format';
    }

    if (!empty($data['purpose']) && strlen((string)$data['purpose']) > 1000) {
        $errors['purpose'] = 'Purpose must be 1000 characters or fewer';
    }

    if (!isset($data['participant_count']) || (int)$data['participant_count'] < 1) {
        $errors['participant_count'] = 'Participant count must be at least 1';
    }

    if (isset($data['participant_count']) && (int)$data['participant_count'] > 5000) {
        $errors['participant_count'] = 'Participant count is too large';
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
