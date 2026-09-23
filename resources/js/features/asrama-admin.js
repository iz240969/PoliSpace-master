// ==================== ASRAMA CAPACITY MANAGEMENT ====================
let asramaCapacityCache = null;

async function loadAsramaRoomManagement() {
  const container = document.getElementById('asramaBuildings');
  if (!container) return;
  container.classList.add('is-loading');
  try {
    const result = await tryApi('asrama_rooms.php');
    asramaCapacityCache = result.data || null;
    renderAsramaCapacityManagement();
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    container.innerHTML = `<div class="asrama-error"><i class="bi bi-exclamation-triangle"></i><strong>Tetapan kapasiti tidak dapat dimuatkan</strong><span>${escapeHtml(error.message || 'Sila cuba lagi.')}</span></div>`;
  } finally {
    container.classList.remove('is-loading');
  }
}

function asramaLimitControl(field, value, maximum, label) {
  return `<div class="asrama-limit-control">
    <button type="button" onclick="adjustAsramaCapacityLimit('${field}', -1)" aria-label="Kurangkan ${escapeAttr(label)}"><i class="bi bi-dash-lg"></i></button>
    <input id="${field}" name="${field}" type="number" min="0" max="${maximum}" step="1" value="${Number(value || 0)}" aria-label="${escapeAttr(label)}" oninput="normalizeAsramaCapacityInput(this, ${maximum})">
    <button type="button" onclick="adjustAsramaCapacityLimit('${field}', 1)" aria-label="Tambah ${escapeAttr(label)}"><i class="bi bi-plus-lg"></i></button>
  </div>`;
}

function renderAsramaBlockCard(type, title, icon) {
  const settings = asramaCapacityCache.settings;
  const today = asramaCapacityCache.today;
  const isMale = type === 'male';
  const field = isMale ? 'normal_male_limit' : 'normal_female_limit';
  const normalLimit = Number(settings[field] || 0);
  const activeLimit = Number(today?.limits?.[type] || 0);
  const used = Number(today?.used?.[type] || 0);
  const remaining = Number(today?.remaining?.[type] || 0);
  return `<article class="asrama-capacity-card ${type}">
    <div class="asrama-capacity-card-head">
      <span class="asrama-block-icon"><i class="bi ${icon}"></i></span>
      <div><small>ASRAMA</small><h2>${title}</h2></div>
    </div>
    <div class="asrama-capacity-control-label"><span>Had Biasa Tersedia</span><small>0 – 30 bilik</small></div>
    ${asramaLimitControl(field, normalLimit, 30, `had biasa ${title}`)}
    <p class="asrama-limit-caption"><strong>${normalLimit}</strong> bilik boleh ditempah di bawah operasi biasa.</p>
    <div class="asrama-capacity-stats">
      <div><span>Had aktif hari ini</span><strong>${activeLimit}</strong></div>
      <div><span>Tempahan aktif</span><strong>${used}</strong></div>
      <div class="remaining"><span>Baki hari ini</span><strong>${remaining}</strong></div>
    </div>
  </article>`;
}

function renderAsramaCapacityManagement() {
  const container = document.getElementById('asramaBuildings');
  if (!container || !asramaCapacityCache?.settings) return;
  const settings = asramaCapacityCache.settings;
  const holidayEnabled = Boolean(settings.holiday_enabled);
  container.innerHTML = `<form class="asrama-capacity-form" onsubmit="saveAsramaCapacitySettings(event)">
    <div class="asrama-capacity-grid">
      ${renderAsramaBlockCard('male', 'Blok Lelaki', 'bi-gender-male')}
      ${renderAsramaBlockCard('female', 'Blok Perempuan', 'bi-gender-female')}
    </div>

    <section class="asrama-holiday-card">
      <div class="asrama-holiday-head">
        <div class="asrama-holiday-heading"><span><i class="bi bi-calendar2-week"></i></span><div><small>TETAPAN TAMBAHAN</small><h2>Mod Cuti Panjang</h2><p>Benarkan kapasiti sehingga 100 bilik bagi setiap blok dalam tempoh yang ditetapkan.</p></div></div>
        <label class="asrama-mode-switch"><input id="holiday_enabled" type="checkbox" ${holidayEnabled ? 'checked' : ''} onchange="syncAsramaHolidayMode()"><span aria-hidden="true"></span><strong id="asramaHolidayModeLabel">${holidayEnabled ? 'Aktif' : 'Tidak Aktif'}</strong></label>
      </div>
      <div class="asrama-holiday-fields" id="asramaHolidayFields" ${holidayEnabled ? '' : 'hidden'}>
        <label><span>Tarikh Mula</span><input class="form-control" id="holiday_start_date" type="date" value="${escapeAttr(settings.holiday_start_date || '')}"></label>
        <label><span>Tarikh Tamat</span><input class="form-control" id="holiday_end_date" type="date" value="${escapeAttr(settings.holiday_end_date || '')}"></label>
        <div class="asrama-holiday-limit"><div><span>Blok Lelaki</span><small>Maksimum 100 bilik</small></div>${asramaLimitControl('holiday_male_limit', settings.holiday_male_limit, 100, 'had Cuti Panjang Blok Lelaki')}</div>
        <div class="asrama-holiday-limit"><div><span>Blok Perempuan</span><small>Maksimum 100 bilik</small></div>${asramaLimitControl('holiday_female_limit', settings.holiday_female_limit, 100, 'had Cuti Panjang Blok Perempuan')}</div>
      </div>
      <div class="asrama-holiday-status"><i class="bi bi-info-circle"></i><span>${holidayEnabled && asramaCapacityCache.today?.holiday_active ? 'Mod Cuti Panjang sedang digunakan hari ini.' : 'Had biasa digunakan di luar tarikh Cuti Panjang.'}</span></div>
    </section>

    <div class="asrama-form-footer">
      <p><i class="bi bi-person-check"></i><span>PoliSpace mengawal kuota sahaja. Nombor bilik dan aras sebenar ditentukan oleh PIC Asrama.</span></p>
      <button class="btn btn-primary" id="saveAsramaCapacityButton" type="submit"><i class="bi bi-check2-circle"></i> Simpan Tetapan</button>
    </div>
  </form>`;
}

function normalizeAsramaCapacityInput(input, maximum) {
  const value = Math.floor(Number(input.value || 0));
  input.value = String(Math.max(0, Math.min(maximum, Number.isFinite(value) ? value : 0)));
}

function adjustAsramaCapacityLimit(field, delta) {
  const input = document.getElementById(field);
  if (!input) return;
  const maximum = Number(input.max || 30);
  input.value = String(Number(input.value || 0) + delta);
  normalizeAsramaCapacityInput(input, maximum);
}

function syncAsramaHolidayMode() {
  const enabled = Boolean(document.getElementById('holiday_enabled')?.checked);
  const fields = document.getElementById('asramaHolidayFields');
  const label = document.getElementById('asramaHolidayModeLabel');
  if (fields) fields.hidden = !enabled;
  if (label) label.textContent = enabled ? 'Aktif' : 'Tidak Aktif';
}

async function saveAsramaCapacitySettings(event) {
  event?.preventDefault();
  const saveButton = document.getElementById('saveAsramaCapacityButton');
  const payload = {
    normal_male_limit: Number(document.getElementById('normal_male_limit')?.value || 0),
    normal_female_limit: Number(document.getElementById('normal_female_limit')?.value || 0),
    holiday_enabled: Boolean(document.getElementById('holiday_enabled')?.checked),
    holiday_start_date: document.getElementById('holiday_start_date')?.value || '',
    holiday_end_date: document.getElementById('holiday_end_date')?.value || '',
    holiday_male_limit: Number(document.getElementById('holiday_male_limit')?.value || 0),
    holiday_female_limit: Number(document.getElementById('holiday_female_limit')?.value || 0),
  };
  if (payload.holiday_enabled && (!payload.holiday_start_date || !payload.holiday_end_date)) {
    showToast('Sila pilih tarikh mula dan tarikh tamat Cuti Panjang.', 'error');
    return;
  }
  if (payload.holiday_enabled && payload.holiday_end_date < payload.holiday_start_date) {
    showToast('Tarikh tamat mesti pada atau selepas tarikh mula.', 'error');
    return;
  }

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="bi bi-arrow-repeat"></i> Menyimpan';
  }
  try {
    const result = await tryApi('asrama_rooms.php', 'PUT', payload);
    asramaCapacityCache = result.data || asramaCapacityCache;
    renderAsramaCapacityManagement();
    showToast(result.message || 'Tetapan kapasiti berjaya disimpan.', 'success');
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Tetapan kapasiti gagal disimpan.', 'error');
  } finally {
    if (saveButton?.isConnected) {
      saveButton.disabled = false;
      saveButton.innerHTML = '<i class="bi bi-check2-circle"></i> Simpan Tetapan';
    }
  }
}
