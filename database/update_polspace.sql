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
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_ref VARCHAR(20) UNIQUE NOT NULL,
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
    is_read BOOLEAN DEFAULT FALSE,
    replied_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_is_read (is_read)
);

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

ALTER TABLE bookings
    MODIFY status ENUM('unpaid', 'pending', 'approved', 'rejected', 'cancelled') DEFAULT 'unpaid';

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

INSERT INTO users (email, password, full_name, role)
VALUES ('admin@polspace.com', '$2y$12$ei8egtiIZ/FXZmq7dd5b0OV3J5khMN1yX77twoOHLb7rm40SpJI56', 'Administrator', 'admin')
ON DUPLICATE KEY UPDATE
    password = VALUES(password),
    full_name = VALUES(full_name),
    role = VALUES(role);

INSERT INTO facilities (id, name, icon, capacity, price_per_hour, description, is_available) VALUES
(1, 'Dewan Utama', 'bi-bank', 800, 450.00, 'Kemudahan: Econ, PA system, projector.', TRUE),
(2, 'Dewan Syarahan', 'bi-mortarboard', 120, 400.00, 'Kemudahan: Econ, PA system, projector.', TRUE),
(3, 'Bilik Persidangan', 'bi-people', 60, 350.00, 'Kemudahan: LCD, projector, econ.', TRUE),
(4, 'Bilik Seminar', 'bi-easel', 45, 250.00, 'Kemudahan: TV besar, econ.', TRUE),
(5, 'Makmal Komputer - ILL 1', 'bi-pc-display', 50, 100.00, 'Makmal komputer ILL 1 untuk penggunaan akademik dan latihan.', TRUE),
(6, 'Asrama - Bilik', 'bi-door-open', 2, 10.00, 'Bilik asrama untuk penginapan. Harga untuk satu bilik.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    icon = VALUES(icon),
    capacity = VALUES(capacity),
    price_per_hour = VALUES(price_per_hour),
    description = VALUES(description),
    is_available = VALUES(is_available);
