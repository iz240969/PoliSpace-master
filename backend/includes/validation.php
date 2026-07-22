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

    if (!empty($data['phone']) && !preg_match('/^[0-9+\-\s()]+$/', (string)$data['phone'])) {
        $errors['phone'] = 'Invalid phone number format';
    }

    if (!empty($data['booking_date']) && $data['booking_date'] < date('Y-m-d')) {
        $errors['booking_date'] = 'Booking date cannot be in the past';
    }

    return $errors;
}

function validateContactMessage(array $data): array
{
    $errors = [];

    if (empty($data['email']) || !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Valid email is required';
    }

    if (empty($data['subject']) || strlen((string)$data['subject']) < 3) {
        $errors['subject'] = 'Subject must be at least 3 characters';
    }

    if (empty($data['message']) || strlen((string)$data['message']) < 10) {
        $errors['message'] = 'Message must be at least 10 characters';
    }

    return $errors;
}
?>
