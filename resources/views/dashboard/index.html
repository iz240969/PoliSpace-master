<!DOCTYPE html>
<html lang="ms" class="auth-pending">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PoliSpace - Dashboard</title>
    <link rel="icon" href="/resources/favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=optional" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="/resources/css/style.css?v=20261002-session-transition-v1">
</head>
<body class="public-page">
  <div class="session-loading" role="status" aria-label="Menyemak sesi akaun"></div>

    <!-- ===== NAV ===== -->
    <nav id="main-nav">
        <div class="nav-logo" onclick="window.location.href='/resources/views/welcome.html'">

            <div>
                <div class="nav-logo-text">PoliSpace</div>
                <div class="nav-logo-sub">Fasiliti</div>
            </div>
        </div>
        <div class="nav-links">
            <button class="nav-link" onclick="window.location.href='/resources/views/welcome.html'">Laman Utama</button>
            <button class="nav-link" onclick="navigateToClientPage(ROUTES.booking)">Tempahan</button>
            <button class="nav-link active" onclick="navigateToClientPage(ROUTES.dashboard)">Dashboard</button>
        </div>
        <div class="nav-actions"></div>
    </nav>

    <div class="toast-container" id="toastContainer"></div>

    <!-- ===== DASHBOARD VIEW ===== -->
    <div id="dashboard" class="view active page-transition">

        <!-- HERO -->
        <div class="dash-hero">
            <div class="dash-eyebrow">RUANG KERJA TEMPAHAN</div>
            <h1 class="page-main-title">Dashboard</h1>
            <p>Urus semua tempahan fasiliti anda di satu tempat.</p>
            <p id="dashboardAccountType"></p>

        </div>

        <div class="dash-overview" aria-label="Ringkasan tempahan">
            <div class="dash-overview-card"><span class="dash-overview-icon"><i class="bi bi-calendar2-week"></i></span><span class="dash-overview-label">Jumlah Tempahan</span><strong id="userStatTotal">0</strong></div>
            <div class="dash-overview-card"><span class="dash-overview-icon"><i class="bi bi-hourglass-split"></i></span><span class="dash-overview-label">Menunggu</span><strong id="userStatPending">0</strong></div>
            <div class="dash-overview-card"><span class="dash-overview-icon"><i class="bi bi-check2-circle"></i></span><span class="dash-overview-label">Diluluskan</span><strong id="userStatApproved">0</strong></div>
        </div>

        <!-- QUICK ACTIONS -->
        <div class="dash-section is-compact">
            <div class="dash-actions">
                <button type="button" class="dash-action-card" onclick="navigateToClientPage(ROUTES.booking)">
                    <span class="action-arrow"><i class="bi bi-arrow-up-right"></i></span>
                    <span class="action-icon"><i class="bi bi-calendar-plus"></i></span>
                    <div class="action-title">Buat Tempahan</div>
                    <div class="action-desc">Tempah fasiliti baharu</div>
                </button>
                <button type="button" class="dash-action-card" onclick="document.getElementById('dashBookingsSection').scrollIntoView({behavior:'smooth'})">
                    <span class="action-arrow"><i class="bi bi-arrow-up-right"></i></span>
                    <span class="action-icon"><i class="bi bi-list-ul"></i></span>
                    <div class="action-title">Urus Tempahan</div>
                    <div class="action-desc">Lihat & batalkan tempahan anda</div>
                </button>
                <button type="button" class="dash-action-card" onclick="navigateToClientPage(ROUTES.status)">
                    <span class="action-arrow"><i class="bi bi-arrow-up-right"></i></span>
                    <span class="action-icon"><i class="bi bi-search"></i></span>
                    <div class="action-title">Semak Tempahan</div>
                    <div class="action-desc">Semak status melalui rujukan</div>
                </button>
                <button type="button" class="dash-action-card" onclick="openContactModal()">
                    <span class="action-arrow"><i class="bi bi-arrow-up-right"></i></span>
                    <span class="action-icon"><i class="bi bi-chat-dots"></i></span>
                    <div class="action-title">Hubungi Pentadbir</div>
                    <div class="action-desc">Hantar pertanyaan atau maklum balas</div>
                </button>
            </div>
        </div>

        <!-- MY BOOKINGS -->
        <div class="dash-section" id="dashBookingsSection">
            <div class="dash-section-header">
                <div class="dash-section-title">
                    Dashboard
                    <small id="bookingCountLabel">0 tempahan</small>
                </div>
                <div class="dash-booking-tools">
                    <div class="table-sort">
                        <i class="bi bi-sort-down"></i>
                        <select id="bookingSortSelect" aria-label="Susun tempahan" onchange="applyBookingFilters()">
                            <option value="recent">Terkini</option>
                            <option value="date-asc">Tarikh: Awal ke Akhir</option>
                            <option value="date-desc">Tarikh: Akhir ke Awal</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="dash-filter-toolbar">
                <label class="dash-booking-search"><i class="bi bi-search"></i><span class="sr-only">Cari tempahan</span><input id="bookingSearchInput" type="search" placeholder="Cari rujukan atau fasiliti..." oninput="applyBookingFilters()"></label>
                <div class="dash-filter-list" role="group" aria-label="Tapis status tempahan">
                    <button type="button" class="dash-filter-chip active" data-status="all" onclick="setBookingStatusFilter(this)">Semua</button>
                    <button type="button" class="dash-filter-chip" data-status="unpaid" onclick="setBookingStatusFilter(this)">Belum Bayar</button>
                    <button type="button" class="dash-filter-chip" data-status="pending" onclick="setBookingStatusFilter(this)">Menunggu</button>
                    <button type="button" class="dash-filter-chip" data-status="approved" onclick="setBookingStatusFilter(this)">Diluluskan</button>
                    <button type="button" class="dash-filter-chip" data-status="rejected" onclick="setBookingStatusFilter(this)">Ditolak</button>
                    <button type="button" class="dash-filter-chip" data-status="cancelled" onclick="setBookingStatusFilter(this)">Dibatalkan</button>
                </div>
            </div>
            <div class="dash-bookings-card">
                <div id="dashBookingsContainer">
                    <!-- Rendered by JS -->
                    <div class="dash-empty">
                        <div class="empty-icon"><i class="bi bi-inbox"></i></div>
                        <div class="empty-title">Belum ada tempahan</div>
                        <div class="empty-sub">Tempahan anda akan dipaparkan di sini selepas permohonan dihantar.</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ===== CANCEL CONFIRMATION MODAL ===== -->
    <div class="modal-overlay" id="cancelBookingModal">
        <div class="modal confirm-modal">
            <div class="modal-body">
                <div class="confirm-icon"><i class="bi bi-exclamation-triangle"></i></div>
                <h2 class="confirm-title">Batalkan Tempahan?</h2>
                <p class="confirm-text">Tempahan <strong id="cancelBookingRef">-</strong> akan dibatalkan. Tindakan ini tidak boleh dibuat asal.</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('cancelBookingModal')">Kembali</button>
                <button class="btn btn-danger" onclick="confirmCancelUserBooking()"><i class="bi bi-x-lg"></i> Batalkan Tempahan</button>
            </div>
        </div>
    </div>

    <!-- ===== BOOKING DETAIL / EDIT MODAL ===== -->
    <div class="modal-overlay" id="userBookingModal">
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title" id="userBookingModalTitle">Butiran Tempahan</div>
                <button class="modal-close" onclick="closeModal('userBookingModal')"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="modal-body" id="userBookingModalBody"></div>
            <div class="modal-footer" id="userBookingModalFooter"></div>
        </div>
    </div>

    <!-- ===== RECEIPT UPLOAD MODAL ===== -->
    <div class="modal-overlay" id="receiptUploadModal">
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title"><i class="bi bi-receipt modal-title-icon"></i> Muat Naik Bukti Bayaran</div>
                <button class="modal-close" onclick="closeModal('receiptUploadModal')"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="modal-body">
                <p class="contact-intro">Tempahan <strong id="receiptBookingRef">-</strong> akan dihantar untuk semakan selepas bukti bayaran dimuat naik.</p>
                <label class="upload-zone dashboard-receipt-upload" for="dashboardReceiptInput">
                    <input type="file" id="dashboardReceiptInput" accept="image/jpeg,image/png,image/gif,application/pdf" onchange="updateDashboardReceiptFileName()">
                    <div class="upload-icon"><i class="bi bi-receipt"></i></div>
                    <div class="upload-title">Pilih fail bukti bayaran</div>
                    <div class="upload-sub" id="dashboardReceiptFileName">Tiada fail dipilih</div>
                    <div class="upload-sub">JPG, PNG, GIF atau PDF · Maksimum 5 MB</div>
                </label>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('receiptUploadModal')">Kembali</button>
                <button class="btn btn-primary" onclick="submitDashboardReceipt()"><i class="bi bi-upload"></i> Muat Naik Bukti Bayaran</button>
            </div>
        </div>
    </div>

    <!-- ===== CONTACT MODAL ===== -->
    <div class="modal-overlay" id="contactModal">
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title"><i class="bi bi-chat-dots modal-title-icon"></i> Hubungi Pentadbir</div>
                <button class="modal-close" onclick="closeModal('contactModal')"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="modal-body contact-form">
                <p class="contact-intro">Ada pertanyaan tentang tempahan anda? Hantar mesej kepada pentadbir dan kami akan membalas secepat mungkin.</p>
                <div class="form-group">
                    <label>Alamat E-mel Anda *</label>
                    <input class="profile-readonly" type="email" id="contactEmail" placeholder="nama@email.com" readonly>
                </div>
                <div class="form-group">
                    <label>Subjek *</label>
                    <input type="text" id="contactSubject" placeholder="cth: Pertanyaan Tempahan PS-0001">
                </div>
                <div class="form-group">
                    <label>Mesej *</label>
                    <textarea id="contactMessage" placeholder="Tulis mesej anda di sini..."></textarea>
                </div>
                <button class="btn btn-primary btn-full" id="contactSubmitButton" type="button" onclick="sendContactMessage()">
                    <i class="bi bi-send"></i> Hantar Mesej
                </button>
                <div class="contact-history" id="contactHistory"></div>
            </div>
        </div>
    </div>

  <script src="/resources/js/script.js?v=20261003-booking-json-v4"></script>

</body>
</html>



