$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$expectedSha256 = "87f64a93262589f39eb0c92253e8f756d38f848dcef392fd8de436ac2d7a340a"
$bundleDir = Join-Path $PSScriptRoot "bundle"
$parts = @(
    "yg-yandex-draft-harness-v1.2.8-test.zip.b64.001",
    "yg-yandex-draft-harness-v1.2.8-test.zip.b64.002",
    "yg-yandex-draft-harness-v1.2.8-test.zip.b64.003",
    "yg-yandex-draft-harness-v1.2.8-test.zip.b64.004",
    "yg-yandex-draft-harness-v1.2.8-test.zip.b64.005",
    "yg-yandex-draft-harness-v1.2.8-test.zip.b64.006a",
    "yg-yandex-draft-harness-v1.2.8-test.zip.b64.006b",
    "yg-yandex-draft-harness-v1.2.8-test.zip.b64.007",
    "yg-yandex-draft-harness-v1.2.8-test.zip.b64.008",
    "yg-yandex-draft-harness-v1.2.8-test.zip.b64.009",
    "yg-yandex-draft-harness-v1.2.8-test.zip.b64.010",
    "yg-yandex-draft-harness-v1.2.8-test.zip.b64.011a",
    "yg-yandex-draft-harness-v1.2.8-test.zip.b64.011b"
)

Write-Host "Yandex Draft Runtime Harness v1.2.8-test" -ForegroundColor Cyan
Write-Host "Проверяю bundle..." -ForegroundColor Gray

$missing = @()
$builder = New-Object System.Text.StringBuilder
foreach ($name in $parts) {
    $file = Join-Path $bundleDir $name
    if (!(Test-Path $file)) {
        $missing += $name
        continue
    }
    [void]$builder.Append(([System.IO.File]::ReadAllText($file)).Trim())
}

if ($missing.Count -gt 0) {
    throw "Не хватает частей bundle: $($missing -join ', ')"
}

$zipBytes = [Convert]::FromBase64String($builder.ToString())
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("yg-runtime-harness-" + [Guid]::NewGuid().ToString("N"))
$tempZip = Join-Path $tempRoot "yg-yandex-draft-harness-v1.2.8-test.zip"
$tempExtract = Join-Path $tempRoot "extract"

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null
[System.IO.File]::WriteAllBytes($tempZip, $zipBytes)

$actualSha256 = (Get-FileHash -Algorithm SHA256 -Path $tempZip).Hash.ToLowerInvariant()
if ($actualSha256 -ne $expectedSha256) {
    Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
    throw "SHA-256 bundle не совпал. Expected: $expectedSha256; actual: $actualSha256"
}

Write-Host "SHA-256 OK: $actualSha256" -ForegroundColor Green
Expand-Archive -LiteralPath $tempZip -DestinationPath $tempExtract -Force

# The original development snapshot was created in one local Windows folder.
# Make the extracted copy portable before installing it into the repository checkout.
$textFiles = Get-ChildItem -LiteralPath $tempExtract -File -Recurse | Where-Object {
    $_.Extension -in @(".ps1", ".md", ".txt", ".json")
}

foreach ($file in $textFiles) {
    $text = [System.IO.File]::ReadAllText($file.FullName)

    # Runtime launchers: replace any machine-specific absolute Chrome profile
    # with a profile stored next to this Harness checkout.
    $text = [regex]::Replace(
        $text,
        '\$profile\s*=\s*"[A-Za-z]:\\[^"\r\n]*\\yg-debug-profile"',
        '$$profile = Join-Path $$PSScriptRoot "yg-debug-profile"'
    )
    $text = [regex]::Replace(
        $text,
        '--profile\s+"[A-Za-z]:\\[^"\r\n]*\\yg-debug-profile"\s+`',
        '--profile (Join-Path $$PSScriptRoot "yg-debug-profile") `'
    )

    # Documentation / validation snapshots: remove any absolute local folder.
    $text = [regex]::Replace(
        $text,
        '"permanent_working_folder"\s*:\s*"[^"]+"',
        '"permanent_working_folder": "<HARNESS_DIR>"'
    )
    $text = [regex]::Replace($text, '[A-Za-z]:\\[^\r\n`"]*\\yg-yandex-draft-harness', '<HARNESS_DIR>')
    $text = [regex]::Replace($text, '[A-Za-z]:\\[^\r\n`"]*\\yg-checker-v1\.2\.1-test', '<CHECKER_DIR>')
    $text = [regex]::Replace($text, '[A-Za-z]:\\[^\r\n`"]*\\yg-debug-profile', '.\\yg-debug-profile')

    # Keep the current README/test example aligned with the active draft app.
    $text = $text.Replace('568143', '568867')
    $text = $text.Replace('run-568143-v1.2.1-test.ps1', 'run-568867-v1.2.1-test.ps1')

    [System.IO.File]::WriteAllText($file.FullName, $text, [System.Text.UTF8Encoding]::new($false))
}

$oldGameLauncher = Join-Path $tempExtract "run-568143-v1.2.1-test.ps1"
$newGameLauncher = Join-Path $tempExtract "run-568867-v1.2.1-test.ps1"
if (Test-Path $oldGameLauncher) {
    Move-Item -LiteralPath $oldGameLauncher -Destination $newGameLauncher -Force
}

foreach ($item in Get-ChildItem -LiteralPath $tempExtract -Force) {
    if ($item.Name -eq "README.md") {
        Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $PSScriptRoot "README-BUNDLE.md") -Force
        continue
    }
    Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $PSScriptRoot $item.Name) -Recurse -Force
}

Remove-Item -Recurse -Force $tempRoot

$required = @(
    "RUN-CHECKER.bat",
    "RUN-CHECKER-QUICK.bat",
    "run-any-game.ps1",
    "run-any-game-quick.ps1",
    "build-debugcheck-v1.2-test.mjs",
    "upgrade-debugcheck-v1.2.7-to-v1.2.8.mjs",
    "yg-yandex-draft-harness-passive.mjs"
)
foreach ($name in $required) {
    if (!(Test-Path (Join-Path $PSScriptRoot $name))) {
        throw "Установка завершилась без обязательного файла: $name"
    }
}

Write-Host ""
Write-Host "Bundle установлен в:" -ForegroundColor Green
Write-Host $PSScriptRoot -ForegroundColor White
Write-Host ""
Write-Host "Профиль браузера будет храниться рядом с Harness: .\yg-debug-profile" -ForegroundColor Gray
Write-Host "Теперь запусти RUN-CHECKER.bat" -ForegroundColor Cyan
