[CmdletBinding()]
param(
  [string]$SshTarget = 'root@proquelec.sn',
  [string]$SshKeyPath = "$env:USERPROFILE\.ssh\gem_vps",
  [int]$OllamaPort = 11434,
  [int]$OpenHandsPort = 3000,
  [string]$Model = 'openai/qwen2.5-coder:7b'
)

$ErrorActionPreference = 'Stop'

function Test-HttpOk {
  param([string]$Url)

  try {
    Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 5 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Ensure-OllamaTunnel {
  if (Test-HttpOk "http://localhost:$OllamaPort/v1/models") {
    Write-Host "Ollama tunnel already available on localhost:$OllamaPort" -ForegroundColor Green
    return
  }

  if (-not (Test-Path $SshKeyPath)) {
    throw "SSH key not found: $SshKeyPath"
  }

  Write-Host "Starting SSH tunnel localhost:$OllamaPort -> $SshTarget localhost:$OllamaPort" -ForegroundColor Cyan
  & ssh -i $SshKeyPath -N -f -L "${OllamaPort}:localhost:${OllamaPort}" $SshTarget

  Start-Sleep -Seconds 3
  if (-not (Test-HttpOk "http://localhost:$OllamaPort/v1/models")) {
    throw "Ollama tunnel did not become available on localhost:$OllamaPort"
  }
}

function Ensure-OpenHands {
  $existing = (& docker ps -a --filter "name=openhands-app" --format "{{.Names}}|{{.Status}}")
  if ($existing -match '^openhands-app\|Up ') {
    Write-Host "OpenHands is already running: http://localhost:$OpenHandsPort" -ForegroundColor Green
    return
  }

  if ($existing -match '^openhands-app\|') {
    Write-Host "Removing stopped OpenHands container" -ForegroundColor Yellow
    & docker rm openhands-app | Out-Null
  }

  $workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $persistence = Join-Path $env:USERPROFILE '.openhands'
  New-Item -ItemType Directory -Force -Path $persistence | Out-Null

  Write-Host "Starting OpenHands for GED OS on http://localhost:$OpenHandsPort" -ForegroundColor Cyan
  & docker run -d --rm --pull=always `
    -e LOG_ALL_EVENTS=true `
    -e LLM_MODEL=$Model `
    -e LLM_BASE_URL="http://host.docker.internal:$OllamaPort/v1" `
    -e LLM_API_KEY='local-llm' `
    -e LLM_MAX_INPUT_TOKENS=30000 `
    -e LLM_MAX_OUTPUT_TOKENS=2048 `
    -e LLM_TIMEOUT=180 `
    -e LLM_NUM_RETRIES=3 `
    -v /var/run/docker.sock:/var/run/docker.sock `
    -v "${persistence}:/.openhands" `
    -e "SANDBOX_VOLUMES=${workspace}:/workspace:rw" `
    -p "${OpenHandsPort}:3000" `
    --add-host host.docker.internal:host-gateway `
    --name openhands-app `
    docker.openhands.dev/openhands/openhands:latest | Out-Null

  Start-Sleep -Seconds 5
  Write-Host "OpenHands started: http://localhost:$OpenHandsPort" -ForegroundColor Green
}

Ensure-OllamaTunnel
Ensure-OpenHands

Write-Host ""
Write-Host "GED OS agent is ready." -ForegroundColor Green
Write-Host "Model: $Model"
Write-Host "LLM endpoint from Docker: http://host.docker.internal:$OllamaPort/v1"
Write-Host "Workspace mounted at: /workspace"
