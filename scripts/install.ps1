param(
    [switch]$InstallPrerequisites,
    [switch]$SkipSetup,
    [string]$Project
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$cliName = @($package.bin.PSObject.Properties.Name)[0]
function Refresh-TaskPath {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Ensure-Dependency([string]$CommandName, [string]$PackageId) {
    if (Get-Command $CommandName -ErrorAction SilentlyContinue) { return }
    if (-not $InstallPrerequisites) { throw "Missing $CommandName. Install it first, or rerun with -InstallPrerequisites (winget)." }
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) { throw 'winget is required to install prerequisites: https://learn.microsoft.com/windows/package-manager/winget/' }
    & winget.exe install --id $PackageId --exact --source winget --accept-package-agreements --accept-source-agreements --silent
    if ($LASTEXITCODE -ne 0) { throw "winget failed for $PackageId" }
    Refresh-TaskPath
    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) { throw "$CommandName installed but not yet on PATH. Open a new terminal and rerun." }
}
Ensure-Dependency 'node.exe' 'OpenJS.NodeJS.LTS'
$nodeMajor = [int]((& node.exe --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 22) { throw 'Node.js 22 or later is required; upgrade Node.js and rerun.' }
if ($cliName -ne 'davinci-resolve-cli') {
    Ensure-Dependency 'uv.exe' 'astral-sh.uv'
    Ensure-Dependency 'git.exe' 'Git.Git'
}
Ensure-Dependency 'npm.cmd' 'OpenJS.NodeJS.LTS'
& npm.cmd install --global $root
if ($LASTEXITCODE -ne 0) { throw 'CLI installation failed.' }
Refresh-TaskPath
$cliPath = (Get-Command "$cliName.cmd" -ErrorAction Stop).Source
if (-not $SkipSetup) {
    & $cliPath setup
    if ($LASTEXITCODE -ne 0) { throw "Setup incomplete. Run $cliName doctor for missing application/dependency instructions." }
}
if ($Project) {
    & $cliPath skills install --target $Project
    if ($LASTEXITCODE -ne 0) { throw 'Skill installation failed.' }
}
Write-Host "Installed $cliName. Run '$cliName --help' for commands."
