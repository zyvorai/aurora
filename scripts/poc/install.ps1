<#
 Aurora easy-test PoC installer and helper (Windows, PowerShell 5.1+ or 7).

   irm https://zyvorai.github.io/aurora/install.ps1 | iex                  # install and start
   & "$HOME\.aurora-poc\aurora-poc.ps1" status|logs|down|up|update|reset|feedback|uninstall

 Requires Docker Desktop (WSL2 backend). Environment (optional): AURORA_POC_DIR, AURORA_VERSION, AURORA_PORT,
 AURORA_LLM (openai|ollama|skip), OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, AURORA_BASE_URL, AURORA_COMPOSE_FILE.
 NOTE: written and linted, but not yet run on a real Windows machine - please report problems.
#>
param([string]$Command = 'install', [string]$Arg = '')
$ErrorActionPreference = 'Stop'

$Dir     = if ($env:AURORA_POC_DIR) { $env:AURORA_POC_DIR } else { Join-Path $HOME '.aurora-poc' }
$BaseUrl = if ($env:AURORA_BASE_URL) { $env:AURORA_BASE_URL } else { 'https://zyvorai.github.io/aurora' }
$Port    = if ($env:AURORA_PORT) { $env:AURORA_PORT } else { '3000' }
$ApiPort = if ($env:AURORA_API_PORT) { $env:AURORA_API_PORT } else { '8000' }
$Issues  = 'https://github.com/zyvorai/aurora/issues/new'

function Say($m)  { Write-Host "==> $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "warning: $m" -ForegroundColor Yellow }
function Die($m)  { Write-Host "error: $m" -ForegroundColor Red; throw $m }

function Invoke-Compose {
  Push-Location $Dir
  try { & docker compose -f docker-compose.poc.yml @args; if ($LASTEXITCODE -ne 0) { throw "docker compose failed ($LASTEXITCODE)" } } finally { Pop-Location }
}

function Test-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Die "Docker is not installed. Install Docker Desktop (WSL2 backend): https://www.docker.com/products/docker-desktop  (or: winget install Docker.DockerDesktop), start it, then re-run."
  }
  & docker info *> $null
  if ($LASTEXITCODE -ne 0) { Die 'Docker is installed but not running. Start Docker Desktop and retry.' }
  & docker compose version *> $null
  if ($LASTEXITCODE -ne 0) { Die "Docker Compose v2 is required ('docker compose'). Update Docker Desktop." }
}

function New-RandHex([int]$bytes = 24) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  -join ($b | ForEach-Object { $_.ToString('x2') })
}

function Test-EnvKey($key) {
  $f = Join-Path $Dir '.env'
  (Test-Path $f) -and (Select-String -Path $f -Pattern "^$([regex]::Escape($key))=" -Quiet)
}

function Set-EnvKey($key, $value) {   # idempotent; never echoes values
  $f = Join-Path $Dir '.env'
  $lines = @(); if (Test-Path $f) { $lines = @(Get-Content $f | Where-Object { $_ -notmatch "^$([regex]::Escape($key))=" }) }
  $lines += "$key=$value"
  # LF endings, no BOM: the containers read this file.
  [System.IO.File]::WriteAllText($f, (($lines -join "`n") + "`n"), (New-Object System.Text.UTF8Encoding $false))
}

function Get-Compose {
  New-Item -ItemType Directory -Force -Path $Dir | Out-Null
  $dest = Join-Path $Dir 'docker-compose.poc.yml'
  if ($env:AURORA_COMPOSE_FILE) { Copy-Item $env:AURORA_COMPOSE_FILE $dest -Force }
  else { Invoke-WebRequest -UseBasicParsing "$BaseUrl/docker-compose.poc.yml" -OutFile $dest }
}

function Select-Llm {
  if (Test-EnvKey 'LLM_PROVIDER') { return }
  $choice = $env:AURORA_LLM
  if (-not $choice) {
    Write-Host "`nAurora needs an LLM for its agents. Choose:`n  1) OpenAI-compatible API key (OpenAI, Groq, Azure, ...)`n  2) Ollama already running on this computer`n  3) Skip for now"
    $choice = switch (Read-Host '>') { '1' { 'openai' } '2' { 'ollama' } default { 'skip' } }
  }
  switch ($choice) {
    'openai' {
      $key = $env:OPENAI_API_KEY
      if (-not $key) { $sec = Read-Host 'API key (input hidden)' -AsSecureString; $key = [System.Net.NetworkCredential]::new('', $sec).Password }
      if (-not $key) { Die 'no API key given' }
      Set-EnvKey LLM_PROVIDER openai; Set-EnvKey OPENAI_API_KEY $key
      if ($env:OPENAI_BASE_URL) { Set-EnvKey OPENAI_BASE_URL $env:OPENAI_BASE_URL }
      if ($env:OPENAI_MODEL) { Set-EnvKey OPENAI_MODEL $env:OPENAI_MODEL; Set-EnvKey LLM_SINGLE_MODEL $env:OPENAI_MODEL }
    }
    'ollama' {
      $m = if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { 'llama3.1:8b' }
      Set-EnvKey LLM_PROVIDER ollama; Set-EnvKey OLLAMA_BASE_URL 'http://host.docker.internal:11434/v1'
      Set-EnvKey OLLAMA_DEFAULT_MODEL $m; Set-EnvKey LLM_SINGLE_MODEL $m
      Set-EnvKey OLLAMA_EMBEDDING_MODEL nomic-embed-text; Set-EnvKey OLLAMA_EMBEDDING_DIMENSIONS 768
      Warn 'Ollama must accept connections from Docker (set OLLAMA_HOST=0.0.0.0) and have: ollama pull llama3.1:8b ; ollama pull nomic-embed-text'
    }
    default { Set-EnvKey LLM_PROVIDER ollama; Warn "LLM skipped - edit $Dir\.env later" }
  }
}

function Wait-Healthy {
  Say 'Waiting for Aurora to become healthy (first start pulls images - a few minutes)'
  for ($i = 0; $i -lt 180; $i++) {
    try {
      Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/login" -TimeoutSec 3 | Out-Null
      Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$ApiPort/health" -TimeoutSec 3 | Out-Null
      return $true
    } catch { Start-Sleep -Seconds 3 }
  }
  Warn "Not healthy yet. Check: & '$Dir\aurora-poc.ps1' logs"; return $false
}

switch ($Command) {
  { $_ -in 'install', 'up' } {
    Test-Docker
    if ($Command -eq 'install') {
      Get-Compose
      if (-not (Test-EnvKey 'SECRET_KEY')) { Set-EnvKey SECRET_KEY (New-RandHex 32) }
      if (-not (Test-EnvKey 'POSTGRES_PASSWORD')) { Set-EnvKey POSTGRES_PASSWORD (New-RandHex 16) }
      if ($env:AURORA_VERSION) { Set-EnvKey AURORA_VERSION $env:AURORA_VERSION }
      Set-EnvKey AURORA_PORT $Port
      Select-Llm
      if ($PSCommandPath) { Copy-Item $PSCommandPath (Join-Path $Dir 'aurora-poc.ps1') -Force }
      else { try { Invoke-WebRequest -UseBasicParsing "$BaseUrl/install.ps1" -OutFile (Join-Path $Dir 'aurora-poc.ps1') } catch {} }
    }
    Say 'Starting Aurora'
    Invoke-Compose up -d --wait --wait-timeout 600
    if (Wait-Healthy) {
      Write-Host "`n  Aurora is running.`n`n    Open:    http://localhost:$Port`n    Sign in: marketing@zyvor.dev  /  Admin@321   (demo account - change it if this is more than a throwaway test)`n`n    Manage:  & '$Dir\aurora-poc.ps1' status | logs | down | up | update | reset | feedback | uninstall`n"
      if (-not $env:AURORA_NO_OPEN) { Start-Process "http://localhost:$Port" }
    }
  }
  'down'      { Test-Docker; Invoke-Compose down }
  'status'    { Test-Docker; Invoke-Compose ps; try { (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$ApiPort/health").Content } catch {} }
  'logs'      { Test-Docker; if ($Arg) { Invoke-Compose logs -f --tail=100 $Arg } else { Invoke-Compose logs -f --tail=100 } }
  'update'    { Test-Docker; Invoke-Compose pull; Invoke-Compose up -d --wait --wait-timeout 600 }
  'reset'     { Test-Docker; if ((Read-Host 'This deletes ALL Aurora PoC data. Type "reset" to continue') -eq 'reset') { Invoke-Compose down -v; Invoke-Compose up -d --wait --wait-timeout 600 } }
  'feedback'  { $h = try { (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$ApiPort/health").Content } catch { 'unavailable' }
                $u = "${Issues}?template=poc-feedback.yml&title=PoC%20feedback&os=Windows"; Say "Opening $u"; Write-Host "Health output to paste if useful:`n$h"; Start-Process $u }
  'uninstall' { Test-Docker; if ((Read-Host "Remove Aurora PoC containers, data and $Dir? Type `"uninstall`"") -eq 'uninstall') { try { Invoke-Compose down -v } catch {}; Remove-Item -Recurse -Force $Dir; Say 'Removed.' } }
  default     { Die "unknown command '$Command' (install|up|down|status|logs|update|reset|feedback|uninstall)" }
}
