[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path (Join-Path $scriptRoot '..\..')).Path
$sourceEnvPath = Join-Path $projectRoot '.env'
$sourceSchemaPath = Join-Path $projectRoot 'database\polspace.sql'
$nodeTestPath = Join-Path $scriptRoot 'api-integration.test.js'
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$databaseName = "codex_polispace_audit_${timestamp}_$PID"
$tempPrefix = 'codex-polispace-api-audit-'
$machineTemp = [Environment]::GetEnvironmentVariable('TEMP', 'Machine')
$osTemp = [IO.Path]::GetFullPath($(if ([string]::IsNullOrWhiteSpace($machineTemp)) { [IO.Path]::GetTempPath() } else { $machineTemp })).TrimEnd('\')
$tempRoot = Join-Path $osTemp ($tempPrefix + $timestamp + '-' + $PID + '-' + [guid]::NewGuid().ToString('N'))
$siteRoot = Join-Path $tempRoot 'site'
$sessionPath = Join-Path $tempRoot 'sessions'
$mailboxPath = Join-Path $tempRoot 'mailbox.jsonl'
$mailStubPath = Join-Path $tempRoot 'mail-stub.php'
$mysqlDefaultsPath = Join-Path $tempRoot 'mysql-client.ini'
$schemaCopyPath = Join-Path $tempRoot 'schema.sql'
$stdoutPath = Join-Path $tempRoot 'php-stdout.log'
$stderrPath = Join-Path $tempRoot 'php-stderr.log'
$testPassword = 'CodexAudit!9381'
$serverProcess = $null
$databaseCreated = $false
$testExitCode = 1

function Read-DotEnv([string]$Path) {
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#') -or !$trimmed.Contains('=')) { continue }
        $parts = $trimmed.Split('=', 2)
        $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
    }
    return $values
}

function Find-Executable([string]$Name, [string]$LaragonPattern) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source }
    $candidate = Get-ChildItem -Path $LaragonPattern -File -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if (!$candidate) { throw "$Name executable was not found in PATH or Laragon." }
    return $candidate.FullName
}

function Find-PhpWithPdoMySql {
    $candidates = @()
    $command = Get-Command 'php.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { $candidates += $command.Source }
    $candidates += Get-ChildItem -Path 'C:\laragon\bin\php\*\php.exe' -File -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | ForEach-Object FullName
    foreach ($candidate in $candidates | Select-Object -Unique) {
        $available = & $candidate -r "echo extension_loaded('pdo_mysql') ? 'yes' : 'no';"
        if ($LASTEXITCODE -eq 0 -and $available -eq 'yes') { return $candidate }
    }
    throw 'A PHP executable with pdo_mysql was not found in PATH or Laragon.'
}

function Assert-DisposableTargets {
    if ($databaseName -notmatch '^codex_polispace_audit_\d{14}_\d+$') {
        throw 'Generated database name failed the disposable database safety check.'
    }
    $resolvedTemp = [IO.Path]::GetFullPath($tempRoot)
    if (!$resolvedTemp.StartsWith($osTemp + '\', [StringComparison]::OrdinalIgnoreCase) -or
        !(Split-Path -Leaf $resolvedTemp).StartsWith($tempPrefix, [StringComparison]::Ordinal)) {
        throw 'Generated temp path failed the disposable path safety check.'
    }
}

function Invoke-MySql([string[]]$Arguments) {
    & $mysqlExe "--defaults-extra-file=$mysqlDefaultsPath" @Arguments
    if ($LASTEXITCODE -ne 0) { throw "MySQL command failed with exit code $LASTEXITCODE." }
}

Assert-DisposableTargets
if (!(Test-Path -LiteralPath $sourceEnvPath) -or !(Test-Path -LiteralPath $sourceSchemaPath)) {
    throw 'Source .env or database/polspace.sql is missing.'
}

$sourceEnv = Read-DotEnv $sourceEnvPath
$sourceDatabaseName = [string]$sourceEnv['DB_NAME']
if ([string]::IsNullOrWhiteSpace($sourceDatabaseName)) { throw 'Source DB_NAME is missing.' }
if ($sourceDatabaseName -eq $databaseName) { throw 'Disposable DB_NAME unexpectedly matches the configured app database.' }

$phpExe = Find-PhpWithPdoMySql
$mysqlExe = Find-Executable 'mysql.exe' 'C:\laragon\bin\mysql\*\bin\mysql.exe'

try {
    New-Item -ItemType Directory -Path $siteRoot, $sessionPath, (Join-Path $siteRoot 'uploads\payments') -Force | Out-Null
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $tempRoot '/inheritance:r' '/grant:r' "${currentIdentity}:(OI)(CI)F" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the disposable temp directory to the current account.' }
    Copy-Item -LiteralPath (Join-Path $projectRoot 'backend') -Destination $siteRoot -Recurse
    Copy-Item -LiteralPath (Join-Path $projectRoot 'resources') -Destination $siteRoot -Recurse
    Get-ChildItem -LiteralPath $projectRoot -Filter '*.html' -File | Copy-Item -Destination $siteRoot

    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
    $listener.Stop()
    $baseUrl = "http://127.0.0.1:$port"

    $copiedEnvLines = foreach ($line in Get-Content -LiteralPath $sourceEnvPath) {
        if ($line -match '^\s*DB_NAME\s*=') { "DB_NAME=$databaseName" }
        elseif ($line -match '^\s*APP_URL\s*=') { "APP_URL=$baseUrl" }
        elseif ($line -match '^\s*APP_DEBUG\s*=') { 'APP_DEBUG=false' }
        else { $line }
    }
    if (!($copiedEnvLines -match '^DB_NAME=')) { $copiedEnvLines += "DB_NAME=$databaseName" }
    if (!($copiedEnvLines -match '^APP_URL=')) { $copiedEnvLines += "APP_URL=$baseUrl" }
    if (!($copiedEnvLines -match '^APP_DEBUG=')) { $copiedEnvLines += 'APP_DEBUG=false' }
    [IO.File]::WriteAllLines((Join-Path $siteRoot '.env'), $copiedEnvLines, [Text.UTF8Encoding]::new($false))
    $copiedEnv = Read-DotEnv (Join-Path $siteRoot '.env')
    if ($copiedEnv['DB_NAME'] -ne $databaseName -or $copiedEnv['DB_NAME'] -eq $sourceDatabaseName) {
        throw 'Copied .env is not isolated from the configured app database.'
    }
    if ($copiedEnv['APP_URL'] -ne $baseUrl -or $baseUrl -notmatch '^http://127\.0\.0\.1:\d+$') {
        throw 'Copied APP_URL is not bound to loopback.'
    }

    $optionEscape = { param([string]$Value) $Value.Replace('\', '\\').Replace('"', '\"') }
    $mysqlDefaults = @(
        '[client]',
        ('host="{0}"' -f (& $optionEscape ([string]$sourceEnv['DB_HOST']))),
        ('user="{0}"' -f (& $optionEscape ([string]$sourceEnv['DB_USER']))),
        ('password="{0}"' -f (& $optionEscape ([string]$sourceEnv['DB_PASS'])))
    )
    [IO.File]::WriteAllLines($mysqlDefaultsPath, $mysqlDefaults, [Text.UTF8Encoding]::new($false))

    $schemaLines = Get-Content -LiteralPath $sourceSchemaPath | Where-Object {
        $_ -notmatch '^\s*CREATE\s+DATABASE\b' -and $_ -notmatch '^\s*USE\s+`?[A-Za-z0-9_]+`?\s*;'
    }
    if ($schemaLines -match '^\s*(CREATE\s+DATABASE|USE\s+)') {
        throw 'Schema isolation failed: CREATE DATABASE or USE remained after filtering.'
    }
    [IO.File]::WriteAllLines($schemaCopyPath, $schemaLines, [Text.UTF8Encoding]::new($false))

    Invoke-MySql @('--batch', '--execute', "CREATE DATABASE $databaseName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    $databaseCreated = $true
    Get-Content -LiteralPath $schemaCopyPath -Raw | & $mysqlExe "--defaults-extra-file=$mysqlDefaultsPath" "--database=$databaseName" --batch
    if ($LASTEXITCODE -ne 0) { throw "Schema import failed with exit code $LASTEXITCODE." }

    $passwordHash = & $phpExe -r 'echo password_hash($argv[1], PASSWORD_DEFAULT);' $testPassword
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($passwordHash)) { throw 'Could not generate disposable account password hash.' }
    $seedSql = @"
INSERT INTO users (email,password,full_name,phone,role,account_type,staff_number,staff_verification_status) VALUES
('admin.audit@example.test','$passwordHash','Audit Admin','0123456700','admin','public',NULL,NULL),
('public.audit@example.test','$passwordHash','Audit Public','0123456701','user','public',NULL,NULL),
('staff.audit@example.test','$passwordHash','Audit Staff','0123456702','user','staff','STAFF-AUDIT','pending')
ON DUPLICATE KEY UPDATE password=VALUES(password),full_name=VALUES(full_name),phone=VALUES(phone),role=VALUES(role),account_type=VALUES(account_type),staff_number=VALUES(staff_number),staff_verification_status=VALUES(staff_verification_status);
"@
    Invoke-MySql @("--database=$databaseName", '--batch', '--execute', $seedSql)

    $mailStub = @'
<?php
if (function_exists('mail')) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Integration safety abort: native mail is enabled']);
    exit;
}
if (!function_exists('mail')) {
    function mail(string $to, string $subject, string $message, array|string $additional_headers = [], string $additional_params = ''): bool {
        $mailbox = getenv('POLISPACE_TEST_MAILBOX');
        if (!$mailbox || !str_contains(basename(dirname($mailbox)), 'codex-polispace-api-audit-')) {
            return false;
        }
        $record = json_encode(['to' => $to, 'subject' => $subject, 'message' => $message, 'headers' => $additional_headers], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return file_put_contents($mailbox, $record . PHP_EOL, FILE_APPEND | LOCK_EX) !== false;
    }
}
'@
    [IO.File]::WriteAllText($mailStubPath, $mailStub, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($mailboxPath, '', [Text.UTF8Encoding]::new($false))
    $probePath = Join-Path $tempRoot 'mail-probe.php'
    [IO.File]::WriteAllText($probePath, '<?php echo function_exists("mail") ? "stubbed" : "missing";', [Text.UTF8Encoding]::new($false))
    $env:POLISPACE_TEST_MAILBOX = $mailboxPath
    $probe = & $phpExe -d 'disable_functions=mail' -d "auto_prepend_file=$mailStubPath" $probePath
    $probeText = (($probe | ForEach-Object { [string]$_ }) -join '').Trim()
    if ($LASTEXITCODE -ne 0 -or $probeText -ne 'stubbed') {
        throw "Mail safety probe failed (exit $LASTEXITCODE, result '$probeText'); server was not started."
    }

    $serverArgs = @(
        '-d', 'disable_functions=mail',
        '-d', "auto_prepend_file=$mailStubPath",
        '-d', "session.save_path=$sessionPath",
        '-S', "127.0.0.1:$port",
        '-t', $siteRoot
    )
    $serverProcess = Start-Process -FilePath $phpExe -ArgumentList $serverArgs -WorkingDirectory $siteRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

    $ready = $false
    $readinessError = ''
    for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
        if ($serverProcess.HasExited) { throw 'Disposable PHP server exited during startup.' }
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/backend/api/facilities.php" -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch {
            if ($_.ErrorDetails) {
                $readinessError = [string]$_.ErrorDetails.Message
            } elseif ($_.Exception.Response) {
                $reader = [IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
                $readinessError = $reader.ReadToEnd()
                $reader.Dispose()
            } else {
                $readinessError = [string]$_.Exception.Message
            }
            Start-Sleep -Milliseconds 150
        }
    }
    if (!$ready) {
        $serverError = if (Test-Path -LiteralPath $stderrPath) { (Get-Content -LiteralPath $stderrPath -Tail 8) -join ' | ' } else { 'no server log' }
        throw "Disposable PHP server did not become ready ($readinessError): $serverError"
    }

    $env:POLISPACE_TEST_BASE_URL = $baseUrl
    $env:POLISPACE_TEST_DB_NAME = $databaseName
    $env:POLISPACE_TEST_MYSQL_EXE = $mysqlExe
    $env:POLISPACE_TEST_MYSQL_DEFAULTS = $mysqlDefaultsPath
    $env:POLISPACE_TEST_PASSWORD = $testPassword
    & node --test $nodeTestPath
    $testExitCode = $LASTEXITCODE
    if ($testExitCode -ne 0) { throw "Live API tests failed with exit code $testExitCode." }
}
finally {
    if ($serverProcess -and !$serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
        $serverProcess.WaitForExit(5000) | Out-Null
    }
    if ($databaseCreated) {
        if ($databaseName -match '^codex_polispace_audit_\d{14}_\d+$') {
            try { Invoke-MySql @('--batch', '--execute', "DROP DATABASE IF EXISTS $databaseName") } catch { Write-Warning 'Disposable database cleanup failed.' }
        } else {
            Write-Warning 'Database cleanup refused because the generated name failed its safety check.'
        }
    }
    $resolvedTemp = [IO.Path]::GetFullPath($tempRoot)
    if ((Test-Path -LiteralPath $resolvedTemp) -and
        $resolvedTemp.StartsWith($osTemp + '\', [StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path -Leaf $resolvedTemp).StartsWith($tempPrefix, [StringComparison]::Ordinal)) {
        Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
    }
}

if ($testExitCode -ne 0) { exit $testExitCode }
