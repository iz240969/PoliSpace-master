<!DOCTYPE html>
<html lang="ms" class="auth-pending">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PoliSpace - Portal Pentadbir</title>
  <link rel="icon" href="/resources/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=optional" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="/resources/css/style.css?v=20261002-session-transition-v1">
</head>
<body class="admin-workspace">
  <div class="session-loading" role="status" aria-label="Menyemak sesi akaun"></div>
  <a class="skip-link" href="#adminWorkspace">Langkau ke kandungan</a>
  <nav id="main-nav">
    <div class="admin-nav-heading">
      <button class="admin-nav-toggle btn-nav-icon" type="button" onclick="toggleAdminNavigation()" aria-label="Buka menu pentadbir" aria-controls="adminSidebar" aria-expanded="false"><i class="bi bi-list" aria-hidden="true"></i></button>
      <div class="admin-breadcrumb"><span>PoliSpace / Pentadbiran</span><strong id="adminCurrentPage">Ringkasan</strong></div>
    </div>
    <div class="nav-links"><span class="nav-mode-label"><i class="bi bi-shield-check" aria-hidden="true"></i> Pentadbir</span></div>
    <div class="nav-actions"></div>
  </nav>
  <div class="toast-container" id="toastContainer"></div>

  <div id="admin" class="active">
    <div class="admin-layout">
      <aside class="admin-sidebar" id="adminSidebar" aria-label="Navigasi pentadbir">
        <div class="admin-sidebar-brand"><div class="nav-logo nav-logo-static"><div><div class="nav-logo-text">PoliSpace</div><div class="nav-logo-sub">Portal Pentadbir</div></div></div><button class="admin-sidebar-close" type="button" onclick="closeAdminNavigation()" aria-label="Tutup menu pentadbir"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div>
        <div class="admin-menu-label">Utama</div>
        <button class="admin-menu-item active" onclick="showAdminPanel('dashboard', this)"><span class="menu-icon"><i class="bi bi-bar-chart"></i></span> Ringkasan</button>
        <button class="admin-menu-item" onclick="showAdminPanel('bookings', this)"><span class="menu-icon"><i class="bi bi-card-list"></i></span> Tempahan <span class="admin-badge" id="pendingBadge" hidden></span></button>
        <button class="admin-menu-item" onclick="showAdminPanel('messages', this)"><span class="menu-icon"><i class="bi bi-chat-dots"></i></span> Mesej</button>
        <div class="admin-menu-label">Pengurusan</div>
        <button class="admin-menu-item" onclick="showAdminPanel('clients', this)"><span class="menu-icon"><i class="bi bi-people"></i></span> Pelanggan</button>
        <button class="admin-menu-item" onclick="showAdminPanel('facilities', this)"><span class="menu-icon"><i class="bi bi-building"></i></span> Fasiliti</button>
        <button class="admin-menu-item" onclick="showAdminPanel('pic', this)"><span class="menu-icon"><i class="bi bi-person-badge"></i></span> PIC</button>
        <button class="admin-menu-item" onclick="showAdminPanel('calendar', this)"><span class="menu-icon"><i class="bi bi-calendar3"></i></span> Kalendar</button>
        <button class="admin-menu-item" onclick="showAdminPanel('reports', this)"><span class="menu-icon"><i class="bi bi-bar-chart-line"></i></span> Laporan</button>
        <div class="admin-sidebar-footer"><i class="bi bi-building" aria-hidden="true"></i><span>Politeknik Besut<small>Pengurusan fasiliti &amp; tempahan</small></span></div>
      </aside>
      <button class="admin-nav-backdrop" type="button" onclick="closeAdminNavigation()" aria-label="Tutup navigasi" tabindex="-1" hidden></button>

      <main class="admin-content" id="adminWorkspace" tabindex="-1">
        <div class="admin-panel active" id="panel-dashboard">
          <header class="admin-page-header admin-panel-toolbar">
            <div>
            <div class="admin-page-eyebrow">RINGKASAN OPERASI</div>
            <h1 class="page-main-title">Ringkasan</h1>
            <p id="dashDate"></p>
            </div>
            <button class="btn btn-primary btn-sm" type="button" onclick="window.location.href=ROUTES.adminCreateBooking"><i class="bi bi-plus-lg" aria-hidden="true"></i> Tambah Tempahan</button>
          </header>
          <div class="stats-grid" id="adminStats"></div>
          <div class="admin-card">
            <div class="admin-card-header">
              <div class="admin-card-title">Ringkasan Tempahan</div>
              <div class="admin-toolbar-actions">
                <div class="table-sort"><i class="bi bi-sort-down"></i><select id="recentBookingsSortSelect" aria-label="Susun ringkasan tempahan" onchange="renderAdminRecentBookings()"><option value="recent">Terkini</option><option value="date-asc">Tarikh: Awal ke Akhir</option><option value="date-desc">Tarikh: Akhir ke Awal</option></select></div>
                <button class="btn btn-ghost btn-sm" onclick="showAdminPanel('bookings', document.querySelectorAll('.admin-menu-item')[1])">Lihat Semua <i class="bi bi-arrow-right"></i></button>
              </div>
            </div>
            <div class="data-table-wrap"><table class="data-table admin-bookings-table admin-bookings-table-recent dashboard-booking-table"><thead><tr><th>ID</th><th>Fasiliti</th><th>Tarikh</th><th>Status</th><th>Tindakan</th></tr></thead><tbody id="recentBookingsTbody"></tbody></table></div>
          </div>
        </div>

        <div class="admin-panel" id="panel-bookings">
          <div class="admin-panel-toolbar">
            <div><div class="admin-page-eyebrow">TEMPAHAN</div><h2>Pengurusan Tempahan</h2><p class="admin-panel-subtitle">Semak permohonan, status bayaran dan tindakan kelulusan.</p></div>
            <div class="admin-toolbar-actions">
              <button class="btn btn-primary btn-sm" type="button" onclick="window.location.href=ROUTES.adminCreateBooking"><i class="bi bi-plus-lg"></i> Tambah Tempahan</button>
            </div>
          </div>
          <div class="stats-grid" id="bookingStats" aria-label="Ringkasan semua tempahan"></div>
          <div class="admin-data-toolbar">
            <label class="search-control"><i class="bi bi-search" aria-hidden="true"></i><span class="sr-only">Cari tempahan</span><input id="adminBookingSearch" type="search" placeholder="Cari ID, pemohon atau fasiliti..." oninput="renderAdminBookings()"></label>
            <div class="table-sort"><i class="bi bi-sort-down" aria-hidden="true"></i><select id="adminBookingsSortSelect" aria-label="Susun tempahan" onchange="renderAdminBookings()"><option value="recent">Terkini</option><option value="date-asc">Tarikh: Awal ke Akhir</option><option value="date-desc">Tarikh: Akhir ke Awal</option></select></div>
            <div class="filter-tabs toolbar-full" id="bookingFilterTabs" aria-label="Tapis status tempahan"><button class="filter-tab active" aria-pressed="true" onclick="filterBookings('all', this)">Semua</button><button class="filter-tab" aria-pressed="false" onclick="filterBookings('unpaid', this)">Belum Bayar</button><button class="filter-tab" aria-pressed="false" onclick="filterBookings('pending', this)">Menunggu</button><button class="filter-tab" aria-pressed="false" onclick="filterBookings('approved', this)">Diluluskan</button><button class="filter-tab" aria-pressed="false" onclick="filterBookings('rejected', this)">Ditolak</button><button class="filter-tab" aria-pressed="false" onclick="filterBookings('cancelled', this)">Dibatalkan</button></div>
            <span class="admin-result-count" id="bookingResultCount" role="status"></span>
          </div>
          <div class="admin-card"><div class="data-table-wrap"><table class="data-table admin-bookings-table admin-bookings-table-full dashboard-booking-table"><thead><tr><th>ID</th><th>Fasiliti</th><th>Tarikh</th><th>Masa</th><th>Status</th><th>Tindakan</th></tr></thead><tbody id="allBookingsTbody"></tbody></table></div></div>
        </div>

        <div class="admin-panel" id="panel-messages">
          <div class="admin-panel-toolbar">
            <div><div class="admin-page-eyebrow">KOMUNIKASI</div><h2>Mesej Pelanggan</h2><p class="admin-panel-subtitle">Baca pertanyaan dan balas melalui e-mel.</p></div>
            <div class="admin-toolbar-actions"><div class="table-sort"><i class="bi bi-sort-down"></i><select id="messagesSortSelect" aria-label="Susun mesej" onchange="renderAdminMessages()"><option value="recent">Terkini</option><option value="date-asc">Tarikh: Awal ke Akhir</option><option value="date-desc">Tarikh: Akhir ke Awal</option></select></div><button class="btn btn-secondary btn-sm" type="button" onclick="loadMessages()"><i class="bi bi-arrow-clockwise"></i> Muat Semula</button></div>
          </div>
          <div class="admin-card">
            <div class="data-table-wrap"><table class="data-table admin-messages-table">
              <thead><tr><th>Alamat E-mel</th><th>Subjek</th><th>Mesej</th><th>Tarikh</th><th>Tindakan</th></tr></thead>
              <tbody id="messagesTbody"></tbody>
            </table></div>
          </div>
        </div>

        <div class="admin-panel" id="panel-clients">
          <div class="admin-panel-toolbar">
            <div><div class="admin-page-eyebrow">PENGURUSAN</div><h2>Pelanggan</h2><p class="admin-panel-subtitle">Semak maklumat, sahkan kakitangan, serta sekat atau buka sekatan akaun.</p></div>
            <div class="admin-toolbar-actions"><div class="table-sort"><i class="bi bi-sort-down"></i><select id="clientsSortSelect" aria-label="Susun pelanggan" onchange="renderAdminClients()"><option value="recent">Terkini</option><option value="date-asc">Tarikh: Awal ke Akhir</option><option value="date-desc">Tarikh: Akhir ke Awal</option></select></div><button class="btn btn-secondary btn-sm" onclick="loadClients()"><i class="bi bi-arrow-clockwise"></i> Muat Semula</button></div>
          </div>
          <div class="admin-data-toolbar">
            <label class="search-control"><i class="bi bi-search" aria-hidden="true"></i><span class="sr-only">Cari pelanggan</span><input id="adminClientSearch" type="search" placeholder="Cari nama, e-mel atau telefon..." oninput="renderAdminClients()"></label>
            <div class="filter-tabs" id="clientFilterTabs" aria-label="Tapis jenis akaun"><button class="filter-tab active" aria-pressed="true" onclick="filterAdminClients('all', this)">Semua</button><button class="filter-tab" aria-pressed="false" onclick="filterAdminClients('public', this)">Orang Awam</button><button class="filter-tab" aria-pressed="false" onclick="filterAdminClients('staff', this)">Kakitangan</button></div>
            <span class="admin-result-count" id="clientResultCount" role="status"></span>
          </div>
          <div class="admin-card">
            <div class="data-table-wrap"><table class="data-table admin-clients-table">
              <thead><tr><th>Alamat E-mel</th><th>Jenis &amp; Status</th><th>No. Telefon</th><th>Tarikh Daftar</th><th>Tempahan</th><th>Tindakan</th></tr></thead>
              <tbody id="clientsTbody"></tbody>
            </table></div>
          </div>
        </div>

        <div class="admin-panel" id="panel-facilities">
          <div class="admin-panel-toolbar">
            <div><div class="admin-page-eyebrow">FASILITI</div><h2>Pengurusan Fasiliti</h2><p class="admin-panel-subtitle">Urus ketersediaan, peralatan dan PIC fasiliti.</p></div>
            <div class="admin-toolbar-actions"><button class="btn btn-primary btn-sm" type="button" onclick="toggleFacilityCreateForm()" id="facilityCreateToggle" aria-expanded="false" aria-controls="adminFacilityForm"><i class="bi bi-plus-lg"></i> Tambah Fasiliti</button><button class="btn btn-secondary btn-sm" type="button" onclick="loadFacilities().then(renderFacilityManagement)"><i class="bi bi-arrow-clockwise"></i> Muat Semula</button></div>
          </div>
          <form class="admin-card admin-facility-form" id="adminFacilityForm" onsubmit="addFacility(event)" hidden>
            <div class="admin-card-header">
              <div class="admin-facility-form-heading">
                <span><i class="bi bi-building-add"></i></span>
                <div><div class="admin-card-title">Tambah Fasiliti</div><p>Lengkapkan maklumat fasiliti dan pegawai yang bertanggungjawab.</p></div>
              </div>
            </div>
            <div class="admin-facility-form-body">
              <section class="admin-facility-section">
                <div class="admin-facility-section-heading"><span>01</span><div><div class="admin-facility-section-title">Maklumat Fasiliti</div><p>Butiran utama, kapasiti dan kemudahan yang disediakan.</p></div></div>
                <div class="admin-facility-section-grid">
                  <div class="form-group">
                    <label for="facilityName">Nama Fasiliti *</label>
                    <input type="text" id="facilityName" name="name" maxlength="100" required placeholder="cth: Studio Rakaman">
                  </div>
                  <div class="form-group">
                    <label for="facilityIcon">Ikon Fasiliti</label>
                    <div class="admin-icon-select">
                      <span class="admin-icon-preview" id="facilityIconPreview"><i class="bi bi-building"></i></span>
                      <select id="facilityIcon" name="icon" onchange="updateFacilityIconPreview('facilityIcon', 'facilityIconPreview')">
                        <option value="bi-building">Bangunan</option>
                        <option value="bi-bank">Dewan / Auditorium</option>
                        <option value="bi-door-open">Bilik</option>
                        <option value="bi-easel">Bilik Mesyuarat</option>
                        <option value="bi-pc-display">Makmal Komputer</option>
                        <option value="bi-mortarboard">Bilik Kuliah</option>
                        <option value="bi-people">Ruang Berkumpulan</option>
                        <option value="bi-camera-video">Studio</option>
                        <option value="bi-house-door">Asrama</option>
                        <option value="bi-book">Perpustakaan</option>
                      </select>
                    </div>
                  </div>
                  <div class="form-group">
                    <label for="facilityCapacity">Kapasiti *</label>
                    <input type="number" id="facilityCapacity" name="capacity" min="1" max="5000" required placeholder="30">
                  </div>
                  <div class="form-group">
                    <label for="facilityPrice">Harga (RM) *</label>
                    <input type="number" id="facilityPrice" name="price_per_hour" min="0" max="999999.99" step="0.01" required placeholder="100.00">
                  </div>
                  <div class="form-group">
                    <label for="facilityMaxRooms">Had Bilik</label>
                    <input type="number" id="facilityMaxRooms" name="max_rooms" min="1" max="500" placeholder="10">
                  </div>
                  <label class="admin-facility-check">
                    <input type="checkbox" id="facilityAvailable" name="is_available" checked>
                    <span>Tersedia untuk tempahan</span>
                  </label>
                  <div class="form-group admin-facility-description">
                    <label for="facilityDescription">Keterangan</label>
                    <textarea id="facilityDescription" name="description" maxlength="2000" rows="3" placeholder="Kemudahan, kegunaan, atau nota penting."></textarea>
                  </div>
                  <div class="form-group admin-facility-equipment">
                    <label for="facilityEquipment">Peralatan</label>
                    <input type="hidden" id="facilityEquipment" name="equipment_options">
                    <div class="admin-equipment-builder" data-equipment-builder="facilityEquipment">
                      <div class="admin-equipment-add-row">
                        <input type="text" id="facilityEquipmentNew" placeholder="cth: Mikrofon" onkeydown="if(event.key==='Enter'){event.preventDefault();addAdminEquipmentOption('facilityEquipment')}">
                        <button class="btn btn-secondary btn-sm" type="button" onclick="addAdminEquipmentOption('facilityEquipment')"><i class="bi bi-plus-lg"></i> Tambah</button>
                      </div>
                      <div class="admin-equipment-grid" id="facilityEquipmentGrid"></div>
                    </div>
                  </div>
                </div>
              </section>
              <section class="admin-facility-section admin-facility-pic-section">
                <div class="admin-facility-section-heading"><span>02</span><div><div class="admin-facility-section-title">PIC Fasiliti</div><p>Pilih Pegawai Bertanggungjawab (PIC) untuk fasiliti ini.</p></div></div>
                <div class="form-group">
                  <label for="facilityPicId">PIC Fasiliti</label>
                  <select id="facilityPicId" name="pic_id"><option value="">Pilih PIC</option></select>
                  <div class="admin-note-help">Jika tiada PIC dipilih, fasiliti ini tidak mempunyai PIC. Urus rekod PIC pada halaman Pengurusan PIC.</div>
                </div>
              </section>
            </div>
            <div class="admin-facility-form-actions">
              <button class="btn btn-secondary" type="button" onclick="toggleFacilityCreateForm(false)">Tutup</button>
              <button class="btn btn-primary" id="addFacilityButton" type="submit"><i class="bi bi-plus-lg"></i> Tambah Fasiliti</button>
            </div>
          </form>
          <div class="facility-manage-grid" id="facilityManageGrid"></div>
        </div>

        <div class="admin-panel" id="panel-pic">
          <div class="admin-panel-toolbar">
            <div>
              <div class="admin-page-eyebrow">PENGURUSAN</div>
              <h2>Pengurusan PIC</h2>
              <p class="admin-panel-subtitle">Urus Pegawai Bertanggungjawab (PIC) bagi setiap fasiliti dan hantar e-mel kepada PIC.</p>
            </div>
            <div class="admin-toolbar-actions">
              <button class="btn btn-primary btn-sm" type="button" onclick="openPicAddModal()"><i class="bi bi-person-plus"></i> Tambah PIC</button>
              <button class="btn btn-secondary btn-sm" type="button" onclick="refreshPicAndFacilityManagement()"><i class="bi bi-arrow-clockwise"></i> Muat Semula</button>
            </div>
          </div>
          <div class="admin-data-toolbar"><label class="search-control"><i class="bi bi-search" aria-hidden="true"></i><span class="sr-only">Cari PIC</span><input id="adminPicSearch" type="search" placeholder="Cari nama, e-mel atau fasiliti..." oninput="renderPicManagement()"></label><span class="admin-result-count" id="picResultCount" role="status"></span></div>
          <div class="pic-manage-grid" id="picManageGrid"></div>
        </div>

        <div class="admin-panel" id="panel-calendar">
          <div class="admin-panel-toolbar"><div><div class="admin-page-eyebrow">KALENDAR</div><h2>Kalendar Tempahan</h2><p class="admin-panel-subtitle">Lihat tempahan mengikut tarikh tanpa memadatkan butiran ke dalam sel.</p></div></div>
          <div class="admin-card admin-calendar-card"><div id="calendarView"></div></div>
        </div>

        <div class="admin-panel" id="panel-reports">
          <div class="admin-panel-toolbar report-toolbar">
            <div><div class="admin-page-eyebrow">ANALISIS</div><h2>Laporan Tempahan</h2><p class="admin-panel-subtitle">Pantau trend tempahan, prestasi fasiliti dan bukti bayaran.</p></div>
            <div class="admin-toolbar-actions report-toolbar-actions">
              <label class="report-filter" for="reportPeriodSelect"><span>Tempoh Permohonan</span><select id="reportPeriodSelect" onchange="loadAdminReports()"><option value="all">Semua Masa</option><option value="month">Bulan Ini</option><option value="year">Tahun Ini</option></select></label>
              <label class="report-filter" for="reportEvidenceSortSelect"><span>Susun Bukti</span><select id="reportEvidenceSortSelect" onchange="renderSortedAdminReports()"><option value="recent">Permohonan Terkini</option><option value="date-asc">Tarikh Tempahan: Awal</option><option value="date-desc">Tarikh Tempahan: Akhir</option></select></label>
              <button class="btn btn-secondary btn-sm" type="button" onclick="loadAdminReports()"><i class="bi bi-arrow-clockwise"></i> Muat Semula</button>
              <button class="btn btn-primary btn-sm" id="printAdminReportButton" type="button" onclick="printAdminReport()" disabled><i class="bi bi-printer"></i> Cetak Laporan</button>
            </div>
            <p class="report-update-status" id="reportUpdateStatus" role="status" aria-live="polite"></p>
          </div>
          <div id="adminReportContent"><div class="report-loading"><i class="bi bi-arrow-repeat"></i> Menyediakan laporan...</div></div>
        </div>
      </main>
    </div>
  </div>

  <div class="modal-overlay" id="bookingModal">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabindex="-1">
      <div class="modal-header"><div class="modal-title" id="modalTitle"></div><button class="modal-close" onclick="closeModal('bookingModal')" aria-label="Tutup dialog"><i class="bi bi-x-lg"></i></button></div>
      <div class="modal-body" id="modalBody"></div>
      <div class="modal-footer" id="modalFooter"></div>
    </div>
  </div>

  <script src="/resources/js/script.js?v=20261001-admin-booking-availability-v1"></script>
</body>
</html>



