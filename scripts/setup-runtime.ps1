# Reacher runtime setup.
#
# Installs the four things Reacher needs but cannot ship: the Ollama daemon and
# its model, a WSL distro with Sherlock, and the Python packages ScrapeGraph
# needs. These all require administrator rights or a several-GB download, which
# is why this is a script you run rather than something the app does on your
# behalf.
#
#   Right-click PowerShell -> Run as administrator, then:
#     cd <this repo>
#     powershell -ExecutionPolicy Bypass -File scripts\setup-runtime.ps1
#
# Every step checks before it acts, because `wsl --install` reboots the machine
# partway through -- you will run this at least twice, and the second run must
# skip everything that already succeeded rather than start over.
#
# API keys are deliberately NOT handled here. Enter those in Reacher under
# Settings -> API keys so they land in the encrypted vault; a key pasted into a
# shell ends up in your PowerShell history.

$ErrorActionPreference = "Stop"

# Kept in step with provider-adapters.ts and check-runtime.mjs. llama3.1:8b is
# roughly 5GB and fits in an 8GB card; llama3.3 is a 70B model and will not load
# on a 32GB machine, which is why it is not the default.
$Model = "llama3.1:8b"
$Distro = "Ubuntu"

function Write-Step($message) { Write-Host "`n==> $message" -ForegroundColor Cyan }
function Write-Skip($message) { Write-Host "    already done: $message" -ForegroundColor DarkGray }
function Write-Done($message) { Write-Host "    $message" -ForegroundColor Green }
function Write-Warn($message) { Write-Host "    $message" -ForegroundColor Yellow }

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Warn "Not running as administrator. `wsl --install` will fail; re-run from an elevated PowerShell."
}

$repoRoot = Split-Path -Parent $PSScriptRoot

# --- Ollama ------------------------------------------------------------------
Write-Step "Ollama daemon"
if (Get-Command ollama -ErrorAction SilentlyContinue) {
  Write-Skip "ollama is on PATH"
} else {
  winget install --id Ollama.Ollama --accept-source-agreements --accept-package-agreements
  Write-Done "installed -- you may need a new shell before `ollama` resolves"
  # winget does not update the current session's PATH.
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

Write-Step "Ollama model $Model"
if (Get-Command ollama -ErrorAction SilentlyContinue) {
  $pulled = (& ollama list 2>$null) -join "`n"
  if ($pulled -match [regex]::Escape($Model.Split(":")[0])) {
    Write-Skip "$Model is present"
  } else {
    Write-Host "    pulling $Model (about 5GB, one time)"
    & ollama pull $Model
    Write-Done "pulled"
  }
} else {
  Write-Warn "skipped -- open a new shell and re-run this script to pull the model"
}

# --- WSL + Sherlock ----------------------------------------------------------
Write-Step "WSL distro"
# wsl.exe answers in UTF-16LE; decode it or the distro list reads as empty.
$prevEncoding = [Console]::OutputEncoding
[Console]::OutputEncoding = [System.Text.Encoding]::Unicode
$distros = @(& wsl.exe -l -q 2>$null | ForEach-Object { $_.Trim() } | Where-Object { $_ })
[Console]::OutputEncoding = $prevEncoding

if ($distros.Count -gt 0) {
  Write-Skip "found: $($distros -join ', ')"
} else {
  Write-Host "    installing $Distro -- THIS REBOOTS THE MACHINE."
  Write-Host "    After the reboot, finish the Ubuntu first-run setup, then run this script again."
  & wsl.exe --install -d $Distro
  Write-Warn "reboot now, then re-run this script"
  exit 0
}

Write-Step "Sherlock (in WSL)"
$target = if ($distros -contains $Distro) { $Distro } else { $distros[0] }
& wsl.exe -d $target -- which sherlock *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Skip "sherlock is on PATH in $target"
} else {
  # pipx keeps sherlock in its own venv, which is what the project's integration
  # note specifies and what keeps it off the distro's system Python.
  & wsl.exe -d $target -- bash -lc "sudo apt-get update && sudo apt-get install -y pipx && pipx ensurepath && pipx install sherlock-project"
  Write-Done "installed via pipx in $target"
}

# --- Python + ScrapeGraph ----------------------------------------------------
Write-Step "Python packages for ScrapeGraph"
$requirements = Join-Path $repoRoot "requirements-scrapegraph.txt"
if (-not (Test-Path $requirements)) {
  Write-Warn "requirements-scrapegraph.txt not found at $requirements -- skipped"
} else {
  & py -3 -c "import scrapegraphai" *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Skip "scrapegraphai imports"
  } else {
    & py -3 -m pip install -r $requirements
    # ScrapeGraph drives a headless browser; without this the first real run
    # fails deep inside playwright rather than at install time.
    & py -3 -m playwright install chromium
    Write-Done "installed"
  }
}

Write-Step "Done"
Write-Host "    Verify with:  npm run doctor"
Write-Host "    Then add API keys in Reacher: Settings -> API keys"
Write-Host "      openai    -> enables the ScrapeGraph source on domain/business searches"
Write-Host "      anthropic -> enables ripper-agent, which is set to Anthropic"
