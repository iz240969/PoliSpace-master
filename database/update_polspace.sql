CREATE DATABASE IF NOT EXISTS polspace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE polspace;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) DEFAULT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
);

CREATE TABLE IF NOT EXISTS facilities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT 'bi-building',
    capacity INT DEFAULT 0,
    price_per_hour DECIMAL(10,2) DEFAULT 0,
    description TEXT,
    pic_full_name VARCHAR(100),
    pic_phone VARCHAR(20),
    pic_email VARCHAR(100),
    equipment_options TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_ref VARCHAR(20) UNIQUE NOT NULL,
    cart_group_ref VARCHAR(32),
    user_id INT,
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

SET @blocking_date_index_exists := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND INDEX_NAME = 'uniq_blocking_facility_date'
);
SET @blocking_date_index_sql := IF(
    @blocking_date_index_exists = 0,
    'ALTER TABLE bookings ADD UNIQUE INDEX uniq_blocking_facility_date (blocking_facility_id, blocking_booking_date)',
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

SET @facility_pic_name_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'facilities'
      AND COLUMN_NAME = 'pic_full_name'
);
SET @facility_pic_name_column_sql := IF(
    @facility_pic_name_column_exists = 0,
    'ALTER TABLE facilities ADD COLUMN pic_full_name VARCHAR(100) NULL AFTER description',
    'SELECT 1'
);
PREPARE facility_pic_name_column_stmt FROM @facility_pic_name_column_sql;
EXECUTE facility_pic_name_column_stmt;
DEALLOCATE PREPARE facility_pic_name_column_stmt;

SET @facility_pic_phone_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'facilities'
      AND COLUMN_NAME = 'pic_phone'
);
SET @facility_pic_phone_column_sql := IF(
    @facility_pic_phone_column_exists = 0,
    'ALTER TABLE facilities ADD COLUMN pic_phone VARCHAR(20) NULL AFTER pic_full_name',
    'SELECT 1'
);
PREPARE facility_pic_phone_column_stmt FROM @facility_pic_phone_column_sql;
EXECUTE facility_pic_phone_column_stmt;
DEALLOCATE PREPARE facility_pic_phone_column_stmt;

SET @facility_pic_email_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'facilities'
      AND COLUMN_NAME = 'pic_email'
);
SET @facility_pic_email_column_sql := IF(
    @facility_pic_email_column_exists = 0,
    'ALTER TABLE facilities ADD COLUMN pic_email VARCHAR(100) NULL AFTER pic_phone',
    'SELECT 1'
);
PREPARE facility_pic_email_column_stmt FROM @facility_pic_email_column_sql;
EXECUTE facility_pic_email_column_stmt;
DEALLOCATE PREPARE facility_pic_email_column_stmt;

UPDATE facilities
SET pic_full_name = CONCAT('Person ', id)
WHERE pic_full_name IS NULL OR TRIM(pic_full_name) = '';

UPDATE facilities
SET pic_phone = CONCAT('012-000-', LPAD(id, 4, '0'))
WHERE pic_phone IS NULL OR TRIM(pic_phone) = '';

UPDATE facilities
SET pic_email = CONCAT('person', id, '@polspace.local')
WHERE pic_email IS NULL OR TRIM(pic_email) = '';

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

INSERT INTO users (email, password, full_name, role)
VALUES ('admin@polspace.com', '$2y$12$ei8egtiIZ/FXZmq7dd5b0OV3J5khMN1yX77twoOHLb7rm40SpJI56', 'Administrator', 'admin')
ON DUPLICATE KEY UPDATE
    email = VALUES(email);

INSERT INTO facilities (id, name, icon, capacity, price_per_hour, max_rooms, description, pic_full_name, pic_phone, pic_email, equipment_options, is_available) VALUES
(1, 'Dewan Utama', 'bi-bank', 800, 450.00, NULL, 'Kemudahan: Econ, PA system, projector.', 'Person 1', '012-000-0001', 'person1@polspace.local', '[{"name":"Mikrofon","max":null},{"name":"Projektor","max":null},{"name":"PA System","max":null},{"name":"Kerusi Tambahan","max":null},{"name":"Meja Tambahan","max":null}]', TRUE),
(2, 'Dewan Syarahan', 'bi-mortarboard', 120, 400.00, NULL, 'Kemudahan: Econ, PA system, projector.', 'Person 2', '012-000-0002', 'person2@polspace.local', '[{"name":"Mikrofon","max":null},{"name":"Projektor","max":null},{"name":"PA System","max":null}]', TRUE),
(3, 'Bilik Persidangan', 'bi-people', 60, 350.00, NULL, 'Kemudahan: LCD, projector, econ.', 'Person 3', '012-000-0003', 'person3@polspace.local', '[{"name":"Projektor","max":null},{"name":"TV LCD","max":null},{"name":"Meja Mesyuarat","max":null}]', TRUE),
(4, 'Bilik Seminar', 'bi-easel', 45, 250.00, NULL, 'Kemudahan: TV besar, econ.', 'Person 4', '012-000-0004', 'person4@polspace.local', '[{"name":"TV Besar","max":null},{"name":"Papan Putih","max":null},{"name":"Mikrofon","max":null}]', TRUE),
(5, 'Makmal Komputer - ILL 1', 'bi-pc-display', 50, 100.00, NULL, 'Makmal komputer ILL 1 untuk penggunaan akademik dan latihan.', 'Person 5', '012-000-0005', 'person5@polspace.local', '[{"name":"Komputer Tambahan","max":null},{"name":"Projektor","max":null}]', TRUE),
(6, 'Asrama - Bilik', 'bi-door-open', 2, 10.00, 10, 'Bilik asrama untuk penginapan. Harga untuk satu bilik.', 'Person 6', '012-000-0006', 'person6@polspace.local', '[]', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    icon = VALUES(icon),
    capacity = VALUES(capacity),
    price_per_hour = VALUES(price_per_hour),
    max_rooms = VALUES(max_rooms),
    description = VALUES(description),
    pic_full_name = COALESCE(NULLIF(pic_full_name, ''), VALUES(pic_full_name)),
    pic_phone = COALESCE(NULLIF(pic_phone, ''), VALUES(pic_phone)),
    pic_email = COALESCE(NULLIF(pic_email, ''), VALUES(pic_email)),
    equipment_options = VALUES(equipment_options);
