<!DOCTYPE html>
<html lang="ms" class="auth-pending">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PoliSpace - Tempahan</title>
  <link rel="icon" href="/resources/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=optional" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="/resources/css/style.css?v=20261002-session-transition-v1">
</head>
<body class="booking-page public-page">
  <div class="session-loading" role="status" aria-label="Menyemak sesi akaun"></div>
  <nav id="main-nav">
    <div class="nav-logo" onclick="window.location.href='/resources/views/welcome.html'">

      <div><div class="nav-logo-text">PoliSpace</div><div class="nav-logo-sub">Fasiliti</div></div>
    </div>
    <div class="nav-links">
      <button class="nav-link" onclick="window.location.href='/resources/views/welcome.html'">Laman Utama</button>
      <button class="nav-link active" onclick="navigateToClientPage(ROUTES.booking)">Tempahan</button>
      <button class="nav-link" onclick="navigateToClientPage(ROUTES.dashboard)">Dashboard</button>
    </div>
    <div class="nav-actions"></div>
  </nav>
  <div class="toast-container" id="toastContainer"></div>

  <div id="booking" class="view active page-transition">
    <div class="booking-layout">
      <div class="booking-form-section">
        <div id="booking-form-wrap">
          <header class="booking-page-header">
            <div class="booking-heading-row">
              <div>
                <div class="booking-eyebrow"><i class="bi bi-calendar2-check"></i> Tempahan Fasiliti</div>
                <h1 class="page-title page-main-title">Borang Tempahan</h1>
                <p class="page-subtitle">Sila lengkapkan semua maklumat yang diperlukan.</p>
              </div>
              <div class="booking-section-count" aria-label="Tiga bahagian borang">
                <i class="bi bi-ui-checks"></i>
                <span>3 bahagian</span>
              </div>
            </div>
          </header>
          <div class="booking-account-notice" id="bookingAccountNotice" hidden></div>
          <div class="form-section">
            <div class="form-section-heading">
              <span class="form-section-number">01</span>
              <div>
                <h2 class="form-section-title">Maklumat Pengguna</h2>
                <p class="form-section-description">Maklumat akaun anda diisi secara automatik.</p>
              </div>
            </div>
            <div class="form-grid">
              <div class="form-group"><label for="f-name">Nama *</label><input class="booking-readonly" type="text" id="f-name" placeholder="cth: Ahmad bin Ali" readonly></div>
              <div class="form-group"><label for="f-phone">No. Telefon *</label><input class="booking-readonly" type="tel" id="f-phone" placeholder="012-345 6789" readonly></div>
              <div class="form-group"><label for="f-email">Alamat E-mel *</label><input class="booking-readonly" type="email" id="f-email" placeholder="contoh@email.com" readonly></div>
            </div>
          </div>
          <div class="form-section">
            <div class="form-section-heading">
              <span class="form-section-number">02</span>
              <div>
                <h2 class="form-section-title">Butiran Tempahan</h2>
                <p class="form-section-description">Pilih fasiliti, masa dan keperluan tempahan anda.</p>
              </div>
            </div>
            <div class="form-grid">
              <div class="form-group span-2">
                <label for="f-facility">Nama Fasiliti *</label>
                <div class="form-select-wrap">
                  <select id="f-facility"></select>
                  <i class="bi bi-chevron-down"></i>
                </div>
              </div>
              <div class="facility-pic-info span-2" id="facilityPicInfo" aria-live="polite"></div>
              <div class="form-group span-2">
                <label for="f-date">Tarikh Tempahan *</label>
                <div class="booking-date-input-wrap">
                  <input type="date" id="f-date">
                  <button type="button" class="booking-date-toggle" aria-label="Buka kalendar ketersediaan" aria-expanded="false" aria-controls="bookingDatePicker">
                    <i class="bi bi-calendar3"></i>
                  </button>
                </div>
                <div class="booking-date-picker" id="bookingDatePicker"></div>
              </div>
              <div class="form-group span-2" data-asrama-optional-field="time">
                <label for="f-start">Masa Mula *</label>
                <div class="time-input-wrap">
                  <input type="time" id="f-start">
                  <button type="button" class="time-picker-toggle" onclick="toggleStartTimePicker()" aria-label="Buka pilihan masa">
                    <i class="bi bi-clock"></i>
                  </button>
                </div>
                <input type="hidden" id="f-end">
              </div>
              <div class="form-group span-2">
                <label for="f-duration">Tempoh Penggunaan</label>
                <div class="duration-field">
                  <div class="duration-mode-toggle" role="group" aria-label="Unit tempoh penggunaan">
                    <button type="button" class="duration-mode-button is-active" id="durationUnitHour" data-duration-unit-target="f-duration" data-duration-unit="hour" onclick="setDurationUnit('hour')" aria-pressed="true">Jam</button>
                    <button type="button" class="duration-mode-button" id="durationUnitDay" data-duration-unit-target="f-duration" data-duration-unit="day" onclick="setDurationUnit('day')" aria-pressed="false">Hari</button>
                  </div>
                  <div class="duration-input-wrap" role="group" aria-label="Tempoh penggunaan">
                    <button type="button" class="duration-step-button" onclick="adjustDuration(-1)" aria-label="Kurangkan tempoh penggunaan">
                      <i class="bi bi-dash-lg"></i>
                    </button>
                    <input type="number" id="f-duration" min="1" max="24" step="1" value="1" inputmode="numeric" aria-label="Tempoh penggunaan">
                    <span class="duration-unit" id="durationUnitLabel">Jam</span>
                    <button type="button" class="duration-step-button" onclick="adjustDuration(1)" aria-label="Tambah tempoh penggunaan">
                      <i class="bi bi-plus-lg"></i>
                    </button>
                  </div>
                </div>
              </div>
              <div class="form-group span-2 is-hidden-for-asrama" data-asrama-field="rooms">
                <label>Bilangan Bilik *</label>
                <div class="asrama-room-allocator">
                  <div class="asrama-room-total">
                    <span>Jumlah</span>
                    <strong id="asramaRoomTotalLabel">1</strong>
                    <small id="asramaRoomLimitLabel">Had mengikut tarikh</small>
                    <input type="hidden" id="f-room-count" value="1">
                  </div>
                  <div class="asrama-room-side">
                    <div>
                      <span>Asrama Lelaki</span>
                      <small id="asramaLelakiHint">0 bilik</small>
                    </div>
                    <div class="quantity-control compact"><button type="button" onclick="adjustAsramaSideRoom('lelaki', -1)" aria-label="Kurangkan bilik asrama lelaki"><i class="bi bi-dash-lg"></i></button><input type="number" id="f-asrama-lelaki-rooms" min="0" max="30" step="1" value="1"><button type="button" onclick="adjustAsramaSideRoom('lelaki', 1)" aria-label="Tambah bilik asrama lelaki"><i class="bi bi-plus-lg"></i></button></div>
                  </div>
                  <div class="asrama-room-side">
                    <div>
                      <span>Asrama Perempuan</span>
                      <small id="asramaPerempuanHint">0 bilik</small>
                    </div>
                    <div class="quantity-control compact"><button type="button" onclick="adjustAsramaSideRoom('perempuan', -1)" aria-label="Kurangkan bilik asrama perempuan"><i class="bi bi-dash-lg"></i></button><input type="number" id="f-asrama-perempuan-rooms" min="0" max="30" step="1" value="0"><button type="button" onclick="adjustAsramaSideRoom('perempuan', 1)" aria-label="Tambah bilik asrama perempuan"><i class="bi bi-plus-lg"></i></button></div>
                  </div>
                </div>
              </div>
              <div class="form-group span-2"><label for="f-purpose">Tujuan Penggunaan *</label><textarea id="f-purpose" placeholder="Terangkan tujuan penggunaan fasiliti secara ringkas"></textarea></div>
              <div class="form-group span-2" data-asrama-optional-field="equipment">
                <label for="equipmentAddSelect">Peralatan Diperlukan</label>
                <div class="equipment-field">
                  <input type="hidden" id="f-equipment">
                  <div class="equipment-add-row">
                    <div class="equipment-select-wrap">
                      <select id="equipmentAddSelect" aria-label="Pilih peralatan"></select>
                      <i class="bi bi-chevron-down"></i>
                    </div>
                    <button type="button" class="equipment-add-button" onclick="addEquipmentItem()" aria-label="Tambah peralatan">
                      <i class="bi bi-plus-lg"></i> Tambah
                    </button>
                  </div>
                  <div class="equipment-list" id="equipmentList"></div>
                </div>
              </div>
              <div class="form-group span-2" data-asrama-optional-field="participants"><label for="f-participants">Jumlah Pengguna *</label><div class="quantity-control"><button type="button" onclick="adjustParticipantCount('f-participants', -1)" aria-label="Kurangkan jumlah pengguna"><i class="bi bi-dash-lg"></i></button><input type="number" id="f-participants" min="1" step="1" value="1"><button type="button" onclick="adjustParticipantCount('f-participants', 1)" aria-label="Tambah jumlah pengguna"><i class="bi bi-plus-lg"></i></button></div></div>
            </div>
          </div>
          <div class="form-section" id="bookingPaymentSection">
            <div class="form-section-heading">
              <span class="form-section-number">03</span>
              <div>
                <h2 class="form-section-title">Bukti Bayaran</h2>
                <p class="form-section-description">Lampirkan bukti bayaran sekarang atau selepas menghantar permohonan.</p>
              </div>
            </div>
            <div class="form-grid">
              <div class="form-group span-2">
                <label>Fail Bukti Bayaran</label>
                <label class="upload-zone" for="f-receipt">
                  <input type="file" id="f-receipt" accept="image/jpeg,image/png,image/gif,application/pdf">
                  <div class="upload-icon"><i class="bi bi-receipt"></i></div>
                  <div class="upload-title">Muat naik bukti bayaran sekarang atau kemudian</div>
                  <div class="upload-sub">Format JPG, PNG, GIF atau PDF. Maksimum 5 MB.</div>
                </label>
                <div class="upload-preview" id="receiptPreview">
                  <i class="bi bi-file-earmark-check"></i>
                  <div class="upload-preview-name" id="receiptFileName"></div>
                  <button type="button" class="upload-preview-remove" onclick="clearReceiptUpload()" aria-label="Buang fail bukti bayaran"><i class="bi bi-x-lg"></i></button>
                </div>
              </div>
            </div>
          </div>
          <div class="booking-submit-actions">
            <button class="btn btn-secondary booking-cart-add-button" id="addToCartButton" type="button" onclick="addBookingToCart()">
              <i class="bi bi-cart-plus"></i>
              <span>Tambah ke Troli</span>
            </button>
            <button class="btn btn-primary booking-submit-button" id="submitBookingButton" type="button" onclick="submitBooking()">
              Hantar Permohonan <i class="bi bi-arrow-right ms-2"></i>
            </button>
          </div>
        </div>
        <div class="success-screen" id="successScreen">
          <div class="success-icon success-icon-accent"><i class="bi bi-stars"></i></div>
          <h2 class="success-title">Permohonan Dihantar!</h2>
          <div class="booking-ref"><div class="booking-ref-label">Nombor Rujukan</div><div class="booking-ref-code" id="refCode"></div></div>
          <div class="success-pic-list" id="successPicInfo"></div>
          <div class="success-actions">
            <button class="btn btn-primary" onclick="navigateToClientPage(ROUTES.dashboard)"><i class="bi bi-speedometer2"></i> Dashboard</button>
            <button class="btn btn-secondary" onclick="resetBookingForm()"><i class="bi bi-calendar-plus"></i> Tempahan Baharu</button>
          </div>
        </div>
      </div>
      <div class="booking-sidebar">
        <div class="sidebar-card">
          <div class="sidebar-heading">
            <span class="sidebar-heading-icon"><i class="bi bi-building-check"></i></span>
            <div><div class="sidebar-title">Fasiliti Pilihan</div><p>Pilih ruang yang sesuai untuk aktiviti anda.</p></div>
          </div>
          <div class="facility-select-list" id="facilitySelectorList"></div>
        </div>
        <div class="sidebar-card cost-card">
          <div class="sidebar-heading">
            <span class="sidebar-heading-icon"><i class="bi bi-receipt-cutoff"></i></span>
            <div><div class="sidebar-title" id="pricingTitle">Anggaran Kos</div><p>Jumlah dikemas kini secara automatik.</p></div>
          </div>
          <div id="pricingBreakdown"></div>
        </div>
      </div>
    </div>
  </div>
  <script src="/resources/js/script.js?v=20261001-admin-booking-availability-v1"></script>
</body>
</html>



