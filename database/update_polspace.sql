CREATE DATABASE IF NOT EXISTS polspace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE polspace;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) DEFAULT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    role ENUM('admin', 'user') DEFAULT 'user',
    account_type ENUM('public', 'staff') NOT NULL DEFAULT 'public',
    staff_number VARCHAR(50) NULL,
    staff_verification_status ENUM('pending', 'verified', 'rejected') NULL DEFAULT NULL,
    is_blocked TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
);

CREATE TABLE IF NOT EXISTS pics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pic_name (full_name),
    INDEX idx_pic_email (email)
);

CREATE TABLE IF NOT EXISTS facilities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT 'bi-building',
    capacity INT DEFAULT 0,
    price_per_hour DECIMAL(10,2) DEFAULT 0,
    description TEXT,
    pic_id INT NULL,
    equipment_options TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_facility_pic (pic_id),
    FOREIGN KEY (pic_id) REFERENCES pics(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_ref VARCHAR(20) UNIQUE NOT NULL,
    cart_group_ref VARCHAR(32),
    user_id INT,
    account_type ENUM('public', 'staff') NOT NULL DEFAULT 'public',
    payment_required BOOLEAN NOT NULL DEFAULT TRUE,
    facility_id INT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    organization VARCHAR(100),
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    duration VARCHAR(20),
    duration_unit ENUM('hour', 'day') NOT NULL DEFAULT 'hour',
    purpose TEXT,
    participant_count INT DEFAULT 0,
    setup_required VARCHAR(50),
    equipment_required TEXT,
    payment_file VARCHAR(255),
    status ENUM('unpaid', 'pending', 'approved', 'rejected', 'cancelled') DEFAULT 'unpaid',
    blocking_facility_id INT GENERATED ALWAYS AS (
        CASE WHEN status IN ('pending', 'approved') THEN facility_id ELSE NULL END
    ) STORED,
    blocking_booking_date DATE GENERATED ALWAYS AS (
        CASE WHEN status IN ('pending', 'approved') THEN booking_date ELSE NULL END
    ) STORED,
    admin_note TEXT,
    cancellation_reason TEXT,
    estimated_cost DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_booking_ref (booking_ref),
    INDEX idx_cart_group_ref (cart_group_ref),
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_booking_date (booking_date),
    UNIQUE INDEX uniq_blocking_facility_date (blocking_facility_id, blocking_booking_date)
);

CREATE TABLE IF NOT EXISTS contact_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    admin_reply TEXT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    replied_at TIMESTAMP NULL,
    replied_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_is_read (is_read),
    FOREIGN KEY (replied_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS asrama_rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    facility_id INT NOT NULL,
    gender ENUM('male', 'female') NOT NULL,
    floor_level TINYINT UNSIGNED NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_asrama_room (facility_id, gender, room_number),
    INDEX idx_asrama_floor (facility_id, gender, floor_level),
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

-- Keep the legacy room inventory table for rollback/history, but use block-level
-- quotas for all new availability decisions.
CREATE TABLE IF NOT EXISTS asrama_capacity_settings (
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
    CHECK (normal_male_limit <= 30),
    CHECK (normal_female_limit <= 30),
    CHECK (holiday_male_limit <= 100),
    CHECK (holiday_female_limit <= 100),
    CHECK (holiday_start_date IS NULL OR holiday_end_date IS NULL OR holiday_end_date >= holiday_start_date),
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

SET @contact_reply_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contact_messages'
      AND COLUMN_NAME = 'admin_reply'
);

SET @contact_reply_column_sql := IF(
    @contact_reply_column_exists = 0,
    'ALTER TABLE contact_messages ADD COLUMN admin_reply TEXT NULL AFTER message',
    'SELECT 1'
);
PREPARE contact_reply_column_stmt FROM @contact_reply_column_sql;
EXECUTE contact_reply_column_stmt;
DEALLOCATE PREPARE contact_reply_column_stmt;

SET @contact_replied_by_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'contact_messages'
      AND COLUMN_NAME = 'replied_by'
);

SET @contact_replied_by_column_sql := IF(
    @contact_replied_by_column_exists = 0,
    'ALTER TABLE contact_messages ADD COLUMN replied_by INT NULL AFTER replied_at',
    'SELECT 1'
);
PREPARE contact_replied_by_column_stmt FROM @contact_replied_by_column_sql;
EXECUTE contact_replied_by_column_stmt;
DEALLOCATE PREPARE contact_replied_by_column_stmt;

SET @equipment_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME = 'equipment_required'
);

SET @equipment_column_sql := IF(
    @equipment_column_exists = 0,
    'ALTER TABLE bookings ADD COLUMN equipment_required TEXT AFTER setup_required',
    'SELECT 1'
);
PREPARE equipment_column_stmt FROM @equipment_column_sql;
EXECUTE equipment_column_stmt;
DEALLOCATE PREPARE equipment_column_stmt;

SET @facility_equipment_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'facilities'
      AND COLUMN_NAME = 'equipment_options'
);

SET @facility_equipment_column_sql := IF(
    @facility_equipment_column_exists = 0,
    'ALTER TABLE facilities ADD COLUMN equipment_options TEXT AFTER description',
    'SELECT 1'
);
PREPARE facility_equipment_column_stmt FROM @facility_equipment_column_sql;
EXECUTE facility_equipment_column_stmt;
DEALLOCATE PREPARE facility_equipment_column_stmt;

SET @duration_unit_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME = 'duration_unit'
);

SET @duration_unit_column_sql := IF(
    @duration_unit_column_exists = 0,
    "ALTER TABLE bookings ADD COLUMN duration_unit ENUM('hour', 'day') NOT NULL DEFAULT 'hour' AFTER duration",
    'SELECT 1'
);
PREPARE duration_unit_column_stmt FROM @duration_unit_column_sql;
EXECUTE duration_unit_column_stmt;
DEALLOCATE PREPARE duration_unit_column_stmt;

UPDATE bookings SET status = 'approved' WHERE status = 'completed';

ALTER TABLE bookings
    MODIFY status ENUM('unpaid', 'pending', 'approved', 'rejected', 'cancelled') DEFAULT 'unpaid';

SET @booking_cancellation_reason_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME = 'cancellation_reason'
);
SET @booking_cancellation_reason_column_sql := IF(
    @booking_cancellation_reason_column_exists = 0,
    'ALTER TABLE bookings ADD COLUMN cancellation_reason TEXT NULL AFTER admin_note',
    'SELECT 1'
);
PREPARE booking_cancellation_reason_column_stmt FROM @booking_cancellation_reason_column_sql;
EXECUTE booking_cancellation_reason_column_stmt;
DEALLOCATE PREPARE booking_cancellation_reason_column_stmt;

SET @booking_completion_email_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME = 'completion_email_sent_at'
);
SET @booking_completion_email_column_sql := IF(
    @booking_completion_email_column_exists = 1,
    'ALTER TABLE bookings DROP COLUMN completion_email_sent_at',
    'SELECT 1'
);
PREPARE booking_completion_email_column_stmt FROM @booking_completion_email_column_sql;
EXECUTE booking_completion_email_column_stmt;
DEALLOCATE PREPARE booking_completion_email_column_stmt;

SET @booking_completed_at_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME = 'completed_at'
);
SET @booking_completed_at_column_sql := IF(
    @booking_completed_at_column_exists = 1,
    'ALTER TABLE bookings DROP COLUMN completed_at',
    'SELECT 1'
);
PREPARE booking_completed_at_column_stmt FROM @booking_completed_at_column_sql;
EXECUTE booking_completed_at_column_stmt;
DEALLOCATE PREPARE booking_completed_at_column_stmt;

SET @blocking_facility_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME = 'blocking_facility_id'
);
SET @blocking_facility_column_sql := IF(
    @blocking_facility_column_exists = 0,
    "ALTER TABLE bookings ADD COLUMN blocking_facility_id INT GENERATED ALWAYS AS (CASE WHEN status IN ('pending', 'approved') THEN facility_id ELSE NULL END) STORED AFTER status",
    'SELECT 1'
);
PREPARE blocking_facility_column_stmt FROM @blocking_facility_column_sql;
EXECUTE blocking_facility_column_stmt;
DEALLOCATE PREPARE blocking_facility_column_stmt;

SET @blocking_date_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME = 'blocking_booking_date'
);
SET @blocking_date_column_sql := IF(
    @blocking_date_column_exists = 0,
    "ALTER TABLE bookings ADD COLUMN blocking_booking_date DATE GENERATED ALWAYS AS (CASE WHEN status IN ('pending', 'approved') THEN booking_date ELSE NULL END) STORED AFTER blocking_facility_id",
    'SELECT 1'
);
PREPARE blocking_date_column_stmt FROM @blocking_date_column_sql;
EXECUTE blocking_date_column_stmt;
DEALLOCATE PREPARE blocking_date_column_stmt;

SET @blocking_date_unique_index_exists := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND INDEX_NAME = 'uniq_blocking_facility_date'
);
SET @drop_blocking_date_unique_index_sql := IF(
    @blocking_date_unique_index_exists > 0,
    'ALTER TABLE bookings DROP INDEX uniq_blocking_facility_date',
    'SELECT 1'
);
PREPARE drop_blocking_date_unique_index_stmt FROM @drop_blocking_date_unique_index_sql;
EXECUTE drop_blocking_date_unique_index_stmt;
DEALLOCATE PREPARE drop_blocking_date_unique_index_stmt;

SET @blocking_date_index_exists := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND INDEX_NAME = 'idx_blocking_facility_date'
);
SET @blocking_date_index_sql := IF(
    @blocking_date_index_exists = 0,
    'ALTER TABLE bookings ADD INDEX idx_blocking_facility_date (blocking_facility_id, blocking_booking_date)',
    'SELECT 1'
);
PREPARE blocking_date_index_stmt FROM @blocking_date_index_sql;
EXECUTE blocking_date_index_stmt;
DEALLOCATE PREPARE blocking_date_index_stmt;

SET @facility_max_rooms_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'facilities'
      AND COLUMN_NAME = 'max_rooms'
);
SET @facility_max_rooms_column_sql := IF(
    @facility_max_rooms_column_exists = 0,
    "ALTER TABLE facilities ADD COLUMN max_rooms INT NULL AFTER price_per_hour",
    'SELECT 1'
);
PREPARE facility_max_rooms_column_stmt FROM @facility_max_rooms_column_sql;
EXECUTE facility_max_rooms_column_stmt;
DEALLOCATE PREPARE facility_max_rooms_column_stmt;

CREATE TABLE IF NOT EXISTS pics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pic_name (full_name),
    INDEX idx_pic_email (email)
);

SET @facility_pic_id_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'facilities'
      AND COLUMN_NAME = 'pic_id'
);
SET @facility_pic_id_column_sql := IF(
    @facility_pic_id_column_exists = 0,
    'ALTER TABLE facilities ADD COLUMN pic_id INT NULL AFTER description',
    'SELECT 1'
);
PREPARE facility_pic_id_column_stmt FROM @facility_pic_id_column_sql;
EXECUTE facility_pic_id_column_stmt;
DEALLOCATE PREPARE facility_pic_id_column_stmt;

SET @legacy_pic_column_count := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'facilities'
      AND COLUMN_NAME IN ('pic_full_name', 'pic_phone', 'pic_email')
);
SET @migrate_legacy_pics_sql := IF(
    @legacy_pic_column_count = 3,
    "INSERT INTO pics (full_name, phone, email)
     SELECT DISTINCT TRIM(f.pic_full_name), TRIM(f.pic_phone), NULLIF(TRIM(f.pic_email), '')
     FROM facilities f
     WHERE TRIM(COALESCE(f.pic_full_name, '')) <> ''
       AND TRIM(COALESCE(f.pic_phone, '')) <> ''
       AND NOT EXISTS (
           SELECT 1 FROM pics p
           WHERE p.full_name = TRIM(f.pic_full_name)
             AND p.phone = TRIM(f.pic_phone)
             AND p.email <=> NULLIF(TRIM(f.pic_email), '')
       )",
    'SELECT 1'
);
PREPARE migrate_legacy_pics_stmt FROM @migrate_legacy_pics_sql;
EXECUTE migrate_legacy_pics_stmt;
DEALLOCATE PREPARE migrate_legacy_pics_stmt;

SET @assign_legacy_pics_sql := IF(
    @legacy_pic_column_count = 3,
    "UPDATE facilities f
     INNER JOIN pics p
       ON p.full_name = TRIM(f.pic_full_name)
      AND p.phone = TRIM(f.pic_phone)
      AND p.email <=> NULLIF(TRIM(f.pic_email), '')
     SET f.pic_id = p.id
     WHERE f.pic_id IS NULL",
    'SELECT 1'
);
PREPARE assign_legacy_pics_stmt FROM @assign_legacy_pics_sql;
EXECUTE assign_legacy_pics_stmt;
DEALLOCATE PREPARE assign_legacy_pics_stmt;

-- The legacy contact columns are removed only after their values have been
-- copied to pics and every matching facility has received its pic_id.
SET @drop_legacy_pic_columns_sql := IF(
    @legacy_pic_column_count = 3,
    'ALTER TABLE facilities DROP COLUMN pic_full_name, DROP COLUMN pic_phone, DROP COLUMN pic_email',
    'SELECT 1'
);
PREPARE drop_legacy_pic_columns_stmt FROM @drop_legacy_pic_columns_sql;
EXECUTE drop_legacy_pic_columns_stmt;
DEALLOCATE PREPARE drop_legacy_pic_columns_stmt;

SET @facility_pic_index_exists := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'facilities'
      AND INDEX_NAME = 'idx_facility_pic'
);
SET @facility_pic_index_sql := IF(
    @facility_pic_index_exists = 0,
    'ALTER TABLE facilities ADD INDEX idx_facility_pic (pic_id)',
    'SELECT 1'
);
PREPARE facility_pic_index_stmt FROM @facility_pic_index_sql;
EXECUTE facility_pic_index_stmt;
DEALLOCATE PREPARE facility_pic_index_stmt;

SET @facility_pic_fk_exists := (
    SELECT COUNT(*)
    FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'facilities'
      AND REFERENCED_TABLE_NAME = 'pics'
);
SET @facility_pic_fk_sql := IF(
    @facility_pic_fk_exists = 0,
    'ALTER TABLE facilities ADD CONSTRAINT fk_facilities_pic FOREIGN KEY (pic_id) REFERENCES pics(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE facility_pic_fk_stmt FROM @facility_pic_fk_sql;
EXECUTE facility_pic_fk_stmt;
DEALLOCATE PREPARE facility_pic_fk_stmt;

SET @booking_asrama_type_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME = 'asrama_type'
);
SET @booking_asrama_type_column_sql := IF(
    @booking_asrama_type_column_exists = 0,
    "ALTER TABLE bookings ADD COLUMN asrama_type VARCHAR(30) NULL AFTER equipment_required",
    'SELECT 1'
);
PREPARE booking_asrama_type_column_stmt FROM @booking_asrama_type_column_sql;
EXECUTE booking_asrama_type_column_stmt;
DEALLOCATE PREPARE booking_asrama_type_column_stmt;

SET @booking_room_count_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME = 'room_count'
);
SET @booking_room_count_column_sql := IF(
    @booking_room_count_column_exists = 0,
    "ALTER TABLE bookings ADD COLUMN room_count INT NOT NULL DEFAULT 1 AFTER asrama_type",
    'SELECT 1'
);
PREPARE booking_room_count_column_stmt FROM @booking_room_count_column_sql;
EXECUTE booking_room_count_column_stmt;
DEALLOCATE PREPARE booking_room_count_column_stmt;

SET @booking_asrama_lelaki_rooms_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME = 'asrama_lelaki_rooms'
);
SET @booking_asrama_lelaki_rooms_column_sql := IF(
    @booking_asrama_lelaki_rooms_column_exists = 0,
    "ALTER TABLE bookings ADD COLUMN asrama_lelaki_rooms INT NOT NULL DEFAULT 0 AFTER asrama_type",
    'SELECT 1'
);
PREPARE booking_asrama_lelaki_rooms_column_stmt FROM @booking_asrama_lelaki_rooms_column_sql;
EXECUTE booking_asrama_lelaki_rooms_column_stmt;
DEALLOCATE PREPARE booking_asrama_lelaki_rooms_column_stmt;

SET @booking_asrama_perempuan_rooms_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME = 'asrama_perempuan_rooms'
);
SET @booking_asrama_perempuan_rooms_column_sql := IF(
    @booking_asrama_perempuan_rooms_column_exists = 0,
    "ALTER TABLE bookings ADD COLUMN asrama_perempuan_rooms INT NOT NULL DEFAULT 0 AFTER asrama_lelaki_rooms",
    'SELECT 1'
);
PREPARE booking_asrama_perempuan_rooms_column_stmt FROM @booking_asrama_perempuan_rooms_column_sql;
EXECUTE booking_asrama_perempuan_rooms_column_stmt;
DEALLOCATE PREPARE booking_asrama_perempuan_rooms_column_stmt;

SET @user_account_type_column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'account_type'
);
SET @user_account_type_column_sql := IF(
    @user_account_type_column_exists = 0,
    "ALTER TABLE users ADD COLUMN account_type ENUM('public', 'staff') NOT NULL DEFAULT 'public' AFTER role",
    'SELECT 1'
);
PREPARE user_account_type_column_stmt FROM @user_account_type_column_sql;
EXECUTE user_account_type_column_stmt;
DEALLOCATE PREPARE user_account_type_column_stmt;

SET @user_staff_number_column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'staff_number'
);
SET @user_staff_number_column_sql := IF(
    @user_staff_number_column_exists = 0,
    'ALTER TABLE users ADD COLUMN staff_number VARCHAR(50) NULL AFTER account_type',
    'SELECT 1'
);
PREPARE user_staff_number_column_stmt FROM @user_staff_number_column_sql;
EXECUTE user_staff_number_column_stmt;
DEALLOCATE PREPARE user_staff_number_column_stmt;

SET @user_staff_verification_column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'staff_verification_status'
);
SET @user_staff_verification_column_sql := IF(
    @user_staff_verification_column_exists = 0,
    "ALTER TABLE users ADD COLUMN staff_verification_status ENUM('pending', 'verified', 'rejected') NULL DEFAULT NULL AFTER staff_number",
    'SELECT 1'
);
PREPARE user_staff_verification_column_stmt FROM @user_staff_verification_column_sql;
EXECUTE user_staff_verification_column_stmt;
DEALLOCATE PREPARE user_staff_verification_column_stmt;

SET @user_is_blocked_column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_blocked'
);
SET @user_is_blocked_column_sql := IF(
    @user_is_blocked_column_exists = 0,
    'ALTER TABLE users ADD COLUMN is_blocked TINYINT(1) NOT NULL DEFAULT 0 AFTER staff_verification_status',
    'SELECT 1'
);
PREPARE user_is_blocked_column_stmt FROM @user_is_blocked_column_sql;
EXECUTE user_is_blocked_column_stmt;
DEALLOCATE PREPARE user_is_blocked_column_stmt;

SET @booking_account_type_column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'account_type'
);
SET @booking_account_type_column_sql := IF(
    @booking_account_type_column_exists = 0,
    "ALTER TABLE bookings ADD COLUMN account_type ENUM('public', 'staff') NOT NULL DEFAULT 'public' AFTER user_id",
    'SELECT 1'
);
PREPARE booking_account_type_column_stmt FROM @booking_account_type_column_sql;
EXECUTE booking_account_type_column_stmt;
DEALLOCATE PREPARE booking_account_type_column_stmt;

SET @booking_payment_required_column_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'payment_required'
);
SET @booking_payment_required_column_sql := IF(
    @booking_payment_required_column_exists = 0,
    'ALTER TABLE bookings ADD COLUMN payment_required BOOLEAN NOT NULL DEFAULT TRUE AFTER account_type',
    'SELECT 1'
);
PREPARE booking_payment_required_column_stmt FROM @booking_payment_required_column_sql;
EXECUTE booking_payment_required_column_stmt;
DEALLOCATE PREPARE booking_payment_required_column_stmt;

UPDATE users
SET account_type = 'public', staff_number = NULL, staff_verification_status = NULL
WHERE role = 'admin';

INSERT INTO users (email, password, full_name, role)
VALUES ('admin@polspace.com', '$2y$12$ei8egtiIZ/FXZmq7dd5b0OV3J5khMN1yX77twoOHLb7rm40SpJI56', 'Administrator', 'admin')
ON DUPLICATE KEY UPDATE
    email = VALUES(email);

INSERT INTO pics (full_name, phone, email)
SELECT seed.full_name, seed.phone, seed.email
FROM (
    SELECT 'Person 1' AS full_name, '012-000-0001' AS phone, 'person1@polspace.local' AS email
    UNION ALL SELECT 'Person 2', '012-000-0002', 'person2@polspace.local'
    UNION ALL SELECT 'Person 3', '012-000-0003', 'person3@polspace.local'
    UNION ALL SELECT 'Person 4', '012-000-0004', 'person4@polspace.local'
    UNION ALL SELECT 'Person 5', '012-000-0005', 'person5@polspace.local'
    UNION ALL SELECT 'Person 6', '012-000-0006', 'person6@polspace.local'
) seed
WHERE NOT EXISTS (SELECT 1 FROM pics p WHERE p.email = seed.email);

INSERT INTO facilities (id, name, icon, capacity, price_per_hour, max_rooms, description, pic_id, equipment_options, is_available) VALUES
(1, 'Dewan Utama', 'bi-bank', 800, 450.00, NULL, 'Kemudahan: Econ, PA system, projector.', (SELECT id FROM pics WHERE email = 'person1@polspace.local' LIMIT 1), '[{"name":"Mikrofon","max":null},{"name":"Projektor","max":null},{"name":"PA System","max":null},{"name":"Kerusi Tambahan","max":null},{"name":"Meja Tambahan","max":null}]', TRUE),
(2, 'Dewan Syarahan', 'bi-mortarboard', 120, 400.00, NULL, 'Kemudahan: Econ, PA system, projector.', (SELECT id FROM pics WHERE email = 'person2@polspace.local' LIMIT 1), '[{"name":"Mikrofon","max":null},{"name":"Projektor","max":null},{"name":"PA System","max":null}]', TRUE),
(3, 'Bilik Persidangan', 'bi-people', 60, 350.00, NULL, 'Kemudahan: LCD, projector, econ.', (SELECT id FROM pics WHERE email = 'person3@polspace.local' LIMIT 1), '[{"name":"Projektor","max":null},{"name":"TV LCD","max":null},{"name":"Meja Mesyuarat","max":null}]', TRUE),
(4, 'Bilik Seminar', 'bi-easel', 45, 250.00, NULL, 'Kemudahan: TV besar, econ.', (SELECT id FROM pics WHERE email = 'person4@polspace.local' LIMIT 1), '[{"name":"TV Besar","max":null},{"name":"Papan Putih","max":null},{"name":"Mikrofon","max":null}]', TRUE),
(5, 'Makmal Komputer - ILL 1', 'bi-pc-display', 50, 100.00, NULL, 'Makmal komputer ILL 1 untuk penggunaan akademik dan latihan.', (SELECT id FROM pics WHERE email = 'person5@polspace.local' LIMIT 1), '[{"name":"Komputer Tambahan","max":null},{"name":"Projektor","max":null}]', TRUE),
(6, 'Asrama - Bilik', 'bi-door-open', 2, 10.00, 10, 'Bilik asrama untuk penginapan. Harga untuk satu bilik.', (SELECT id FROM pics WHERE email = 'person6@polspace.local' LIMIT 1), '[]', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    icon = VALUES(icon),
    capacity = VALUES(capacity),
    price_per_hour = VALUES(price_per_hour),
    max_rooms = VALUES(max_rooms),
    description = VALUES(description),
    pic_id = COALESCE(pic_id, VALUES(pic_id)),
    equipment_options = VALUES(equipment_options);

INSERT INTO asrama_capacity_settings (facility_id)
SELECT id FROM facilities
WHERE LOWER(name) LIKE '%asrama%' AND LOWER(name) LIKE '%bilik%'
ON DUPLICATE KEY UPDATE facility_id = VALUES(facility_id);
