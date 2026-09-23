<?php
declare(strict_types=1);

const ACCOUNT_TYPE_PUBLIC = 'public';
const ACCOUNT_TYPE_STAFF = 'staff';
const STAFF_VERIFICATION_PENDING = 'pending';
const STAFF_VERIFICATION_VERIFIED = 'verified';
const STAFF_VERIFICATION_REJECTED = 'rejected';

function ensureAccountTypeSchema(Database $db, bool $includeBookings = false): void
{
    static $usersChecked = false;
    static $bookingsChecked = false;

    if (!$usersChecked) {
        $columns = [
            'account_type' => "ALTER TABLE users ADD COLUMN account_type ENUM('public', 'staff') NOT NULL DEFAULT 'public' AFTER role",
            'staff_number' => 'ALTER TABLE users ADD COLUMN staff_number VARCHAR(50) NULL AFTER account_type',
            'staff_verification_status' => "ALTER TABLE users ADD COLUMN staff_verification_status ENUM('pending', 'verified', 'rejected') NULL DEFAULT NULL AFTER staff_number",
        ];
        foreach ($columns as $name => $sql) {
            if (!$db->fetchOne("SHOW COLUMNS FROM users LIKE '{$name}'")) {
                $db->query($sql);
            }
        }
        $usersChecked = true;
    }

    if ($includeBookings && !$bookingsChecked) {
        $columns = [
            'account_type' => "ALTER TABLE bookings ADD COLUMN account_type ENUM('public', 'staff') NOT NULL DEFAULT 'public' AFTER user_id",
            'payment_required' => 'ALTER TABLE bookings ADD COLUMN payment_required BOOLEAN NOT NULL DEFAULT TRUE AFTER account_type',
        ];
        foreach ($columns as $name => $sql) {
            if (!$db->fetchOne("SHOW COLUMNS FROM bookings LIKE '{$name}'")) {
                $db->query($sql);
            }
        }
        $bookingsChecked = true;
    }
}

function normalizedAccountType(mixed $value): string
{
    return $value === ACCOUNT_TYPE_STAFF ? ACCOUNT_TYPE_STAFF : ACCOUNT_TYPE_PUBLIC;
}

function isVerifiedStaffAccount(array $user): bool
{
    return normalizedAccountType($user['account_type'] ?? '') === ACCOUNT_TYPE_STAFF
        && ($user['staff_verification_status'] ?? null) === STAFF_VERIFICATION_VERIFIED;
}

function accountTypeLabel(mixed $value): string
{
    return normalizedAccountType($value) === ACCOUNT_TYPE_STAFF ? 'Kakitangan' : 'Orang Awam';
}
?>
