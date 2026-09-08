// ==================== ASRAMA ROOM MANAGEMENT ====================
let asramaRoomsCache = [];

async function loadAsramaRoomManagement() {
  const container = document.getElementById('asramaBuildings');
  if (!container) return;
  container.classList.add('is-loading');
  try {
    const result = await tryApi('asrama_rooms.php');
    asramaRoomsCache = (result.data?.rooms || []).map((room) => ({ ...room, is_available: Boolean(Number(room.is_available)) }));
    renderAsramaRoomManagement();
  } catch (error) {
    if (handleAdminAuthorizationError(error)) return;
    container.innerHTML = `<div class="asrama-error"><i class="bi bi-exclamation-triangle"></i><strong>Data bilik tidak dapat dimuatkan</strong><span>${escapeHtml(error.message || 'Sila cuba lagi.')}</span></div>`;
  } finally {
    container.classList.remove('is-loading');
  }
}

function asramaFloorLabel(level) {
  return Number(level) === 0 ? 'Aras Bawah' : `Aras ${level}`;
}

function renderAsramaRoomManagement() {
  const container = document.getElementById('asramaBuildings');
  if (!container) return;
  container.innerHTML = [
    { gender: 'male', title: 'Blok Lelaki', icon: 'bi-gender-male' },
    { gender: 'female', title: 'Blok Perempuan', icon: 'bi-gender-female' },
  ].map((building) => renderAsramaBuilding(building)).join('');
}

function renderAsramaBuilding(building) {
  const rooms = asramaRoomsCache.filter((room) => room.gender === building.gender);
  const activeLevels = [0, 1, 2, 3, 4].filter((floor) => {
    const floorRooms = rooms.filter((room) => Number(room.floor_level) === floor);
    return floorRooms.length && floorRooms.every((room) => room.is_available);
  }).length;
  return `<article class="asrama-building ${building.gender}">
    <div class="asrama-building-header"><div><i class="bi ${building.icon}"></i><span><small>Asrama</small><strong>${building.title}</strong></span></div><div class="asrama-building-count"><strong>${activeLevels}/5</strong><span>aras<br>tersedia</span></div></div>
    <div class="asrama-floors">${[4, 3, 2, 1, 0].map((floor) => renderAsramaFloor(building.gender, floor, rooms.filter((room) => Number(room.floor_level) === floor))).join('')}</div>
    <div class="asrama-building-base"><span></span><span></span><span></span></div>
  </article>`;
}

function renderAsramaFloor(gender, floor, rooms) {
  const allAvailable = rooms.length > 0 && rooms.every((room) => room.is_available);
  const someAvailable = rooms.some((room) => room.is_available);
  const status = allAvailable ? 'Tersedia' : someAvailable ? 'Sebahagian tersedia' : 'Tidak tersedia';
  return `<section class="asrama-floor">
    <div class="asrama-floor-icon" aria-hidden="true">${floor === 0 ? 'G' : floor}</div>
    <div class="asrama-floor-copy"><strong>${asramaFloorLabel(floor)}</strong><span class="${allAvailable ? 'available' : 'unavailable'}"><i></i>${status}</span></div>
    <button class="asrama-level-toggle ${allAvailable ? 'on' : ''}" type="button" onclick="toggleAsramaFloor('${gender}', ${floor}, ${!allAvailable})" aria-label="Tukar ketersediaan ${asramaFloorLabel(floor)}"><span></span></button>
  </section>`;
}

async function toggleAsramaFloor(gender, floor, isAvailable) {
  const affected = asramaRoomsCache.filter((room) => room.gender === gender && Number(room.floor_level) === Number(floor));
  const previous = affected.map((room) => room.is_available);
  affected.forEach((room) => { room.is_available = isAvailable; });
  renderAsramaRoomManagement();
  try {
    await tryApi('asrama_rooms.php?action=level', 'PUT', { gender, floor_level: floor, is_available: isAvailable });
    showToast(`${asramaFloorLabel(floor)} kini ${isAvailable ? 'tersedia' : 'tidak tersedia'}.`, 'success');
  } catch (error) {
    affected.forEach((room, index) => { room.is_available = previous[index]; });
    renderAsramaRoomManagement();
    if (handleAdminAuthorizationError(error)) return;
    showToast(error.message || 'Status aras gagal dikemas kini.', 'error');
  }
}
