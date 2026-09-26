param([string]$BaseUrl = 'http://polispace-master.test')

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$php = Get-ChildItem 'C:\laragon\bin\php' -Recurse -Filter php.exe -ErrorAction Stop | Select-Object -First 1 -ExpandProperty FullName
$node = Get-ChildItem 'C:\laragon\bin\nodejs' -Recurse -Filter node.exe -ErrorAction Stop | Select-Object -First 1 -ExpandProperty FullName
$failures = [System.Collections.Generic.List[string]]::new()

Get-ChildItem "$projectRoot\backend" -Recurse -Filter *.php | ForEach-Object {
    & $php -l $_.FullName *> $null
    if ($LASTEXITCODE -ne 0) { $failures.Add("PHP syntax: $($_.FullName)") }
}
Get-ChildItem "$projectRoot\resources\js" -Recurse -Filter *.js | ForEach-Object {
    & $node --check $_.FullName *> $null
    if ($LASTEXITCODE -ne 0) { $failures.Add("JavaScript syntax: $($_.FullName)") }
}

$testFiles = Get-ChildItem $PSScriptRoot -Filter *.test.js |
    Where-Object { $_.Name -ne 'api-integration.test.js' } |
    ForEach-Object { $_.FullName }
if ($testFiles.Count -gt 0) {
    & $node --test $testFiles
    if ($LASTEXITCODE -ne 0) { $failures.Add('JavaScript behaviour checks failed') }
}

& $php (Join-Path $PSScriptRoot 'backend_booking_regression.php')
if ($LASTEXITCODE -ne 0) { $failures.Add('Backend booking validation checks failed') }

$publicChecks = @(
    '/',
    '/resources/views/welcome.html',
    '/resources/views/booking/index.html',
    '/resources/views/dashboard/index.html',
    '/resources/views/status/index.html',
    '/resources/views/auth/login.html',
    '/resources/views/auth/signup.html',
    '/resources/views/admin/login.html',
    '/resources/views/admin/dashboard.html',
    '/resources/views/admin/create-booking.html',
    '/resources/views/admin/asrama.html',
    '/resources/css/style.css',
    '/resources/css/components/public-experience.css',
    '/resources/js/script.js',
    '/backend/api/facilities.php',
    '/backend/api/bookings.php?action=public-stats',
    '/backend/api/asrama_rooms.php?action=availability&date=2026-12-12&duration=2'
)
foreach ($path in $publicChecks) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri ($BaseUrl + $path) -TimeoutSec 10
        if ([int]$response.StatusCode -ne 200) { $failures.Add("HTTP $path returned $($response.StatusCode)") }
    } catch {
        $failures.Add("HTTP $path failed: $($_.Exception.Message)")
    }
}

try {
    Invoke-WebRequest -UseBasicParsing -Method POST -Uri "$BaseUrl/backend/api/auth.php?action=logout" -Headers @{ Origin = 'https://invalid.example' } -TimeoutSec 10 | Out-Null
    $failures.Add('Cross-origin mutation was not rejected')
} catch {
    if ([int]$_.Exception.Response.StatusCode -ne 403) { $failures.Add("Cross-origin check returned $([int]$_.Exception.Response.StatusCode), expected 403") }
}

try {
    Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/backend/api/auth.php?action=logout" -TimeoutSec 10 | Out-Null
    $failures.Add('GET logout was not rejected')
} catch {
    if ([int]$_.Exception.Response.StatusCode -ne 405) { $failures.Add("GET logout returned $([int]$_.Exception.Response.StatusCode), expected 405") }
}

try {
    Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/backend/api/bookings.php?action=report&period=all" -TimeoutSec 10 | Out-Null
    $failures.Add('Admin report was accessible without authentication')
} catch {
    if ([int]$_.Exception.Response.StatusCode -ne 401) { $failures.Add("Admin report returned $([int]$_.Exception.Response.StatusCode), expected 401") }
}

try {
    Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/backend/api/asrama_rooms.php" -TimeoutSec 10 | Out-Null
    $failures.Add('Asrama capacity settings were accessible without authentication')
} catch {
    if ([int]$_.Exception.Response.StatusCode -ne 401) { $failures.Add("Asrama settings returned $([int]$_.Exception.Response.StatusCode), expected 401") }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output 'PoliSpace smoke checks passed.'
