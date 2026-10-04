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
    max_rooms INT NULL,
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
    asrama_type VARCHAR(30),
    asrama_lelaki_rooms INT NOT NULL DEFAULT 0,
    asrama_perempuan_rooms INT NOT NULL DEFAULT 0,
    room_count INT NOT NULL DEFAULT 1,
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
    INDEX idx_blocking_facility_date (blocking_facility_id, blocking_booking_date)
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

-- Room/floor inventory is retained for migration safety, but booking capacity is
-- controlled by the per-block quota settings below.
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

INSERT INTO users (email, password, full_name, role)
VALUES ('admin@polspace.com', '$2y$12$ei8egtiIZ/FXZmq7dd5b0OV3J5khMN1yX77twoOHLb7rm40SpJI56', 'Administrator', 'admin')
ON DUPLICATE KEY UPDATE
    email = VALUES(email);

INSERT INTO pics (id, full_name, phone, email) VALUES
(1, 'Person 1', '012-000-0001', 'iz240969@gmail.com'),
(2, 'Person 2', '012-000-0002', 'person2@polspace.local'),
(3, 'Person 3', '012-000-0003', 'person3@polspace.local'),
(4, 'Person 4', '012-000-0004', 'person4@polspace.local'),
(5, 'Person 5', '012-000-0005', 'person5@polspace.local'),
(6, 'Person 6', '012-000-0006', 'person6@polspace.local')
ON DUPLICATE KEY UPDATE
    id = VALUES(id);

INSERT INTO facilities (id, name, icon, capacity, price_per_hour, max_rooms, description, pic_id, equipment_options, is_available) VALUES
(1, 'Dewan Utama', 'bi-bank', 800, 450.00, NULL, 'Kemudahan: Econ, PA system, projector.', 1, '[{"name":"Mikrofon","max":null},{"name":"Projektor","max":null},{"name":"PA System","max":null},{"name":"Kerusi Tambahan","max":null},{"name":"Meja Tambahan","max":null}]', TRUE),
(2, 'Dewan Syarahan', 'bi-mortarboard', 120, 400.00, NULL, 'Kemudahan: Econ, PA system, projector.', 2, '[{"name":"Mikrofon","max":null},{"name":"Projektor","max":null},{"name":"PA System","max":null}]', TRUE),
(3, 'Bilik Persidangan', 'bi-people', 60, 350.00, NULL, 'Kemudahan: LCD, projector, econ.', 3, '[{"name":"Projektor","max":null},{"name":"TV LCD","max":null},{"name":"Meja Mesyuarat","max":null}]', TRUE),
(4, 'Bilik Seminar', 'bi-easel', 45, 250.00, NULL, 'Kemudahan: TV besar, econ.', 4, '[{"name":"TV Besar","max":null},{"name":"Papan Putih","max":null},{"name":"Mikrofon","max":null}]', TRUE),
(5, 'Makmal Komputer - ILL 1', 'bi-pc-display', 50, 100.00, NULL, 'Makmal komputer ILL 1 untuk penggunaan akademik dan latihan.', 5, '[{"name":"Komputer Tambahan","max":null},{"name":"Projektor","max":null}]', TRUE),
(6, 'Asrama - Bilik', 'bi-door-open', 2, 10.00, 10, 'Bilik asrama untuk penginapan. Harga untuk satu bilik.', 6, '[]', TRUE)
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
