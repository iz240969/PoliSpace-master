USE polspace;

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

UPDATE facilities
SET equipment_options = CASE id
  WHEN 1 THEN '[{"name":"Mikrofon","max":null},{"name":"Projektor","max":null},{"name":"PA System","max":null},{"name":"Kerusi Tambahan","max":null},{"name":"Meja Tambahan","max":null}]'
  WHEN 2 THEN '[{"name":"Mikrofon","max":null},{"name":"Projektor","max":null},{"name":"PA System","max":null}]'
  WHEN 3 THEN '[{"name":"Projektor","max":null},{"name":"TV LCD","max":null},{"name":"Meja Mesyuarat","max":null}]'
  WHEN 4 THEN '[{"name":"TV Besar","max":null},{"name":"Papan Putih","max":null},{"name":"Mikrofon","max":null}]'
  WHEN 5 THEN '[{"name":"Komputer Tambahan","max":null},{"name":"Projektor","max":null}]'
  WHEN 6 THEN '[]'
  ELSE COALESCE(equipment_options, '[{"name":"Mikrofon","max":null},{"name":"Projektor","max":null},{"name":"PA System","max":null}]')
END
WHERE id IN (1, 2, 3, 4, 5, 6)
   OR equipment_options IS NULL
   OR equipment_options = '';
