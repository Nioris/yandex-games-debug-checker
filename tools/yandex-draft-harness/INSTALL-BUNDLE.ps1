$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$bundleBase = "yg-yandex-draft-harness-v1.2.9-test.zip"
$expectedSha256 = "ddf09e4dca58a7339b9ae65f6af28c22c9418eb99cba170b9f9a87d93ba7517a"
$bundleDir = Join-Path $PSScriptRoot "bundle"

function Get-Sha256Hex([string]$Path) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $hashBytes = $sha.ComputeHash($stream)
        return ([System.BitConverter]::ToString($hashBytes)).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $stream.Dispose()
        $sha.Dispose()
    }
}

function Expand-ZipCompat([string]$ZipPath, [string]$DestinationPath) {
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction Stop
    }
    catch {
        throw "Cannot load System.IO.Compression.FileSystem. Install .NET Framework 4.5 or newer."
    }

    [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $DestinationPath)
}

Write-Host "Yandex Draft Runtime Harness v1.2.9-test" -ForegroundColor Cyan
Write-Host "PowerShell version: $($PSVersionTable.PSVersion)" -ForegroundColor Gray
Write-Host "Verifying bundle..." -ForegroundColor Gray

if (!(Test-Path -LiteralPath $bundleDir)) {
    throw "Bundle directory was not found: $bundleDir"
}

$parts = @(Get-ChildItem -LiteralPath $bundleDir | Where-Object {
    (-not $_.PSIsContainer) -and $_.Name.StartsWith($bundleBase + ".b64.")
} | Sort-Object Name)

if ($parts.Count -eq 0) {
    throw "No bundle parts found for $bundleBase"
}

$builder = New-Object System.Text.StringBuilder
foreach ($part in $parts) {
    [void]$builder.Append(([System.IO.File]::ReadAllText($part.FullName)).Trim())
}

$zipBytes = [Convert]::FromBase64String($builder.ToString())
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("yg-runtime-harness-" + [Guid]::NewGuid().ToString("N"))
$tempZip = Join-Path $tempRoot $bundleBase
$tempExtract = Join-Path $tempRoot "extract"

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null
[System.IO.File]::WriteAllBytes($tempZip, $zipBytes)

$actualSha256 = Get-Sha256Hex $tempZip
if ($actualSha256 -ne $expectedSha256) {
    Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
    throw "Bundle SHA-256 mismatch. Expected: $expectedSha256; actual: $actualSha256"
}

Write-Host "SHA-256 OK: $actualSha256" -ForegroundColor Green
Expand-ZipCompat $tempZip $tempExtract

# Keep PowerShell launchers readable by Windows PowerShell 5.1.
$utf8Bom = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $true
$utf8NoBom = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
$allowedExtensions = @(".ps1", ".md", ".txt", ".json")

$textFiles = Get-ChildItem -LiteralPath $tempExtract -Recurse | Where-Object {
    (-not $_.PSIsContainer) -and ($allowedExtensions -contains $_.Extension)
}

foreach ($file in $textFiles) {
    $text = [System.IO.File]::ReadAllText($file.FullName)

    # Compatibility sanitizer for older development snapshots. The v1.2.9
    # bundle is already portable, but keep this guard for safe re-installation.
    if ($file.Extension -eq ".ps1") {
        $text = [regex]::Replace(
            $text,
            '\$profile\s*=\s*"[A-Za-z]:\\[^"\r\n]*\\yg-debug-profile"',
            '$profile = Join-Path $PSScriptRoot "yg-debug-profile"'
        )
        $text = [regex]::Replace(
            $text,
            '--profile\s+"[A-Za-z]:\\[^"\r\n]*\\yg-debug-profile"\s+`',
            '--profile (Join-Path $PSScriptRoot "yg-debug-profile") `'
        )
    }

    $text = [regex]::Replace(
        $text,
        '[A-Za-z]:(?:\\){1,2}[^\r\n`"]*?(?:\\){1,2}yg-yandex-draft-harness',
        '<HARNESS_DIR>'
    )
    $text = [regex]::Replace(
        $text,
        '[A-Za-z]:(?:\\){1,2}[^\r\n`"]*?(?:\\){1,2}yg-checker-v1\.2\.1-test',
        '<CHECKER_DIR>'
    )
    $text = [regex]::Replace(
        $text,
        '[A-Za-z]:(?:\\){1,2}[^\r\n`"]*?(?:\\){1,2}yg-debug-profile',
        '.\yg-debug-profile'
    )

    $text = $text.Replace('568143', '568867')
    $text = $text.Replace('run-568143-v1.2.1-test.ps1', 'run-568867-v1.2.1-test.ps1')

    if ($file.Extension -eq ".ps1") {
        [System.IO.File]::WriteAllText($file.FullName, $text, $utf8Bom)
    }
    else {
        [System.IO.File]::WriteAllText($file.FullName, $text, $utf8NoBom)
    }
}

$oldGameLauncher = Join-Path $tempExtract "run-568143-v1.2.1-test.ps1"
$newGameLauncher = Join-Path $tempExtract "run-568867-v1.2.1-test.ps1"
if (Test-Path -LiteralPath $oldGameLauncher) {
    Move-Item -LiteralPath $oldGameLauncher -Destination $newGameLauncher -Force
}

foreach ($item in Get-ChildItem -LiteralPath $tempExtract -Force) {
    if ($item.Name -eq "README.md") {
        Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $PSScriptRoot "README-BUNDLE.md") -Force
        continue
    }
    Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $PSScriptRoot $item.Name) -Recurse -Force
}

# Remove obsolete legacy launcher from an older installation if it is still present.
$obsoleteLauncher = Join-Path $PSScriptRoot "run-568143-v1.2.1-test.ps1"
if (Test-Path -LiteralPath $obsoleteLauncher) {
    Remove-Item -LiteralPath $obsoleteLauncher -Force
}

Remove-Item -Recurse -Force $tempRoot

$required = @(
    "RUN-CHECKER.bat",
    "RUN-CHECKER-QUICK.bat",
    "run-any-game.ps1",
    "run-any-game-quick.ps1",
    "build-debugcheck-v1.2-test.mjs",
    "upgrade-debugcheck-v1.2.7-to-v1.2.8.mjs",
    "upgrade-debugcheck-v1.2.8-to-v1.2.9.mjs",
    "yg-yandex-draft-harness-passive.mjs"
)

foreach ($name in $required) {
    if (!(Test-Path -LiteralPath (Join-Path $PSScriptRoot $name))) {
        throw "Required file was not installed: $name"
    }
}

Write-Host ""
Write-Host "Bundle installed successfully." -ForegroundColor Green
Write-Host "Location: $PSScriptRoot" -ForegroundColor White
Write-Host "Browser profile: .\yg-debug-profile" -ForegroundColor Gray
Write-Host "Runtime requirement: Node.js 22+" -ForegroundColor Gray
Write-Host "Python/pip/websocket-client: not used" -ForegroundColor Gray
Write-Host ""
Write-Host "Run RUN-CHECKER.bat next." -ForegroundColor Cyan
