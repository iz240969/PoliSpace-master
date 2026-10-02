<!DOCTYPE html>
<html lang="ms" class="auth-pending">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PoliSpace - Semak Status</title>
  <link rel="icon" href="/resources/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=optional" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="/resources/css/style.css?v=20261002-session-transition-v1">
</head>
<body class="public-page">
  <div class="session-loading" role="status" aria-label="Menyemak sesi akaun"></div>
  <nav id="main-nav">
    <div class="nav-logo" onclick="window.location.href='/resources/views/welcome.html'">
      <div><div class="nav-logo-text">PoliSpace</div><div class="nav-logo-sub">Fasiliti</div></div>
    </div>
    <div class="nav-links">
      <button class="nav-link" onclick="window.location.href='/resources/views/welcome.html'">Laman Utama</button>
      <button class="nav-link" onclick="navigateToClientPage(ROUTES.booking)">Tempahan</button>
      <button class="nav-link" onclick="navigateToClientPage(ROUTES.dashboard)">Dashboard</button>
    </div>
    <div class="nav-actions"></div>
  </nav>
  <div class="toast-container" id="toastContainer"></div>

  <div id="status" class="view active page-transition">
    <div class="status-page-content">
      <div class="status-eyebrow">STATUS TEMPAHAN</div>
      <h1 class="page-title page-main-title">Semak Status Tempahan</h1>
      <p class="status-page-subtitle">Masukkan No. Rujukan Tempahan (PS) atau No. Rujukan Troli (TR) untuk menyemak status permohonan.</p>
      <div class="status-search-bar">
        <label class="sr-only" for="statusInput">No. Rujukan Tempahan</label>
        <input type="text" id="statusInput" placeholder="Contoh: PS-0001 atau TR-0001" autocomplete="off" onkeydown="if(event.key==='Enter') checkStatus()">
        <button class="btn btn-primary" id="statusSearchButton" type="button" onclick="checkStatus()"><i class="bi bi-search"></i> Semak</button>
      </div>
      <div class="status-search-hint"><i class="bi bi-info-circle"></i><span>No. Rujukan Tempahan tertera pada pengesahan permohonan. Untuk melihat semua tempahan, buka <a href="/resources/views/dashboard/index.html">Dashboard</a>.</span></div>
      <div class="status-result-card" id="statusResultCard">
        <div class="status-result-header">
          <div><div class="status-result-label">No. Rujukan Tempahan</div><div class="status-result-reference" id="statusRef"></div></div>
          <div id="statusBadge"></div>
        </div>
        <div id="statusDetails"></div>
        <div class="status-timeline" id="statusTimeline"></div>
      </div>
    </div>
  </div>
  <script src="/resources/js/script.js?v=20261003-booking-json-v4"></script>
</body>
</html>



