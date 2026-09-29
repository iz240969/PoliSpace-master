<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/pic_mail.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['success' => true]);
}

requireAdmin();
$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$action = (string)($_GET['action'] ?? '');
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

function validatePicInput(array $input): array
{
    $fullName = trim((string)($input['full_name'] ?? ''));
    $phone = trim((string)($input['phone'] ?? ''));
    $email = trim((string)($input['email'] ?? ''));
    $errors = [];

    if ($fullName === '' || strlen($fullName) > 100) {
        $errors['full_name'] = 'Nama penuh PIC mesti diisi dan tidak melebihi 100 aksara.';
    }
    if (!preg_match('/^[0-9+()\-\s]{7,20}$/', $phone)) {
        $errors['phone'] = 'Nombor telefon PIC tidak sah.';
    }
    if ($email !== '' && (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 100)) {
        $errors['email'] = 'Alamat e-mel PIC tidak sah.';
    }

    return $errors;
}

function normalizeFacilityIds(Database $db, mixed $value): array
{
    if (!is_array($value)) {
        jsonResponse(['success' => false, 'error' => 'Senarai fasiliti tidak sah.'], 422);
    }

    $ids = [];
    foreach ($value as $id) {
        if (!(is_int($id) && $id > 0)
            && !(is_string($id) && ctype_digit($id) && (int)$id > 0)) {
            jsonResponse(['success' => false, 'error' => 'Satu atau lebih fasiliti tidak sah.'], 422);
        }
        $ids[] = (int)$id;
    }
    $ids = array_values(array_unique($ids));
    if (!$ids) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $rows = $db->fetchAll("SELECT id FROM facilities WHERE id IN ({$placeholders})", $ids);
    if (count($rows) !== count($ids)) {
        jsonResponse(['success' => false, 'error' => 'Satu atau lebih fasiliti tidak sah.'], 422);
    }

    return $ids;
}

function replacePicAssignments(Database $db, int $picId, array $facilityIds): void
{
    if (!$facilityIds) {
        $db->update('UPDATE facilities SET pic_id = NULL WHERE pic_id = ?', [$picId]);
        return;
    }

    $placeholders = implode(',', array_fill(0, count($facilityIds), '?'));
    $db->update(
        "UPDATE facilities
         SET pic_id = CASE WHEN id IN ({$placeholders}) THEN ? ELSE NULL END
         WHERE pic_id = ? OR id IN ({$placeholders})",
        array_merge($facilityIds, [$picId, $picId], $facilityIds)
    );
}

function fetchPic(Database $db, int $id): array|false
{
    $pic = $db->fetchOne(
        "SELECT p.id, p.full_name, p.phone, p.email, p.created_at, p.updated_at,
                GROUP_CONCAT(f.id ORDER BY f.name SEPARATOR ',') AS facility_ids,
                GROUP_CONCAT(f.name ORDER BY f.name SEPARATOR '||') AS facility_names
         FROM pics p
         LEFT JOIN facilities f ON f.pic_id = p.id
         WHERE p.id = ?
         GROUP BY p.id, p.full_name, p.phone, p.email, p.created_at, p.updated_at",
        [$id]
    );
    if (!$pic) {
        return false;
    }

    $pic['facility_ids'] = $pic['facility_ids'] === null || $pic['facility_ids'] === ''
        ? []
        : array_map('intval', explode(',', (string)$pic['facility_ids']));
    $pic['facility_names'] = $pic['facility_names'] === null || $pic['facility_names'] === ''
        ? []
        : explode('||', (string)$pic['facility_names']);
    return $pic;
}

try {
    if ($action !== '' && !($method === 'POST' && $action === 'test-email')) {
        jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
    }
    if ($method === 'GET') {
        $pics = $db->fetchAll(
            "SELECT p.id, p.full_name, p.phone, p.email, p.created_at, p.updated_at,
                    GROUP_CONCAT(f.id ORDER BY f.name SEPARATOR ',') AS facility_ids,
                    GROUP_CONCAT(f.name ORDER BY f.name SEPARATOR '||') AS facility_names
             FROM pics p
             LEFT JOIN facilities f ON f.pic_id = p.id
             GROUP BY p.id, p.full_name, p.phone, p.email, p.created_at, p.updated_at
             ORDER BY p.full_name, p.id"
        );
        foreach ($pics as &$pic) {
            $pic['facility_ids'] = $pic['facility_ids'] === null || $pic['facility_ids'] === ''
                ? []
                : array_map('intval', explode(',', (string)$pic['facility_ids']));
            $pic['facility_names'] = $pic['facility_names'] === null || $pic['facility_names'] === ''
                ? []
                : explode('||', (string)$pic['facility_names']);
        }
        unset($pic);
        jsonResponse(['success' => true, 'data' => $pics]);
    }

    if ($method === 'POST' && $action === 'test-email') {
        if ($id <= 0) {
            jsonResponse(['success' => false, 'error' => 'PIC ID required'], 400);
        }
        $pic = fetchPic($db, $id);
        if (!$pic) {
            jsonResponse(['success' => false, 'error' => 'PIC tidak dijumpai.'], 404);
        }
        if (!filter_var((string)$pic['email'], FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['success' => false, 'error' => 'Sila lengkapkan alamat e-mel PIC sebelum menghantar e-mel.'], 422);
        }
        $pic['facility_names'] = implode(', ', $pic['facility_names']);
        if (!sendPicTestEmail($pic)) {
            jsonResponse(['success' => false, 'error' => 'E-mel tidak dapat dihantar. Semak tetapan e-mel sistem.'], 500);
        }
        jsonResponse(['success' => true, 'message' => 'E-mel telah dihantar kepada PIC.']);
    }

    if ($method === 'POST') {
        $input = jsonInput();
        $errors = validatePicInput($input);
        if ($errors) {
            jsonResponse(['success' => false, 'error' => 'Maklumat PIC tidak lengkap.', 'errors' => $errors], 422);
        }
        $facilityIds = normalizeFacilityIds($db, $input['facility_ids'] ?? []);
        $picId = (int)$db->insert(
            'INSERT INTO pics (full_name, phone, email) VALUES (?, ?, ?)',
            [
                trim((string)$input['full_name']),
                trim((string)$input['phone']),
                trim((string)($input['email'] ?? '')) ?: null,
            ]
        );
        replacePicAssignments($db, $picId, $facilityIds);
        jsonResponse(['success' => true, 'message' => 'PIC berjaya ditambah.', 'data' => fetchPic($db, $picId)], 201);
    }

    if ($method === 'PUT') {
        if ($id <= 0 || !fetchPic($db, $id)) {
            jsonResponse(['success' => false, 'error' => 'PIC tidak dijumpai.'], 404);
        }
        $input = jsonInput();
        $errors = validatePicInput($input);
        if ($errors) {
            jsonResponse(['success' => false, 'error' => 'Maklumat PIC tidak lengkap.', 'errors' => $errors], 422);
        }
        $facilityIds = normalizeFacilityIds($db, $input['facility_ids'] ?? []);
        $db->update(
            'UPDATE pics SET full_name = ?, phone = ?, email = ? WHERE id = ?',
            [
                trim((string)$input['full_name']),
                trim((string)$input['phone']),
                trim((string)($input['email'] ?? '')) ?: null,
                $id,
            ]
        );
        replacePicAssignments($db, $id, $facilityIds);
        jsonResponse(['success' => true, 'message' => 'PIC berjaya dikemas kini.', 'data' => fetchPic($db, $id)]);
    }

    if ($method === 'DELETE') {
        if ($id <= 0 || !fetchPic($db, $id)) {
            jsonResponse(['success' => false, 'error' => 'PIC tidak dijumpai.'], 404);
        }
        $db->update('DELETE FROM pics WHERE id = ?', [$id]);
        jsonResponse(['success' => true, 'message' => 'Rekod PIC telah dipadam. Tugasan PIC untuk fasiliti berkaitan telah dikosongkan.']);
    }

    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
} catch (PDOException $e) {
    $message = defined('APP_DEBUG') && APP_DEBUG ? $e->getMessage() : 'Permintaan PIC gagal.';
    jsonResponse(['success' => false, 'error' => $message], 500);
} catch (Throwable $e) {
    $message = defined('APP_DEBUG') && APP_DEBUG ? $e->getMessage() : 'Permintaan PIC gagal.';
    jsonResponse(['success' => false, 'error' => $message], 500);
}
?>
