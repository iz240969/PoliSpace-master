param([string]$BaseUrl = 'http://polispace-master.test')

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
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

$publicChecks = @(
    '/',
    '/resources/views/welcome.html',
    '/resources/views/admin/dashboard.html',
    '/resources/views/admin/create-booking.html',
    '/resources/views/admin/asrama.html',
    '/backend/api/facilities.php',
    '/backend/api/bookings.php?action=public-stats'
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

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output 'PoliSpace smoke checks passed.'
