[CmdletBinding()]
param(
  [string]$ServerHost = '',
  [string]$ServerUser = '',
  [string]$DeployPath = '',
  [string]$SshConfigHost = '',
  [string]$SshKeyPath = '',
  [string]$Branch = 'main',
  [string]$CommitMessage = '',
  [switch]$AcceptHostKey,
  [switch]$Force,
  [switch]$SkipTests,
  [switch]$SkipCommit,
  [switch]$SkipPush,
  [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-FirstNonEmpty {
  param([string[]]$Values)

  foreach ($value in $Values) {
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $value.Trim()
    }
  }

  return ''
}

function Invoke-Step {
  param(
    [string]$Title,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "--- $Title ---" -ForegroundColor Cyan
  & $Action
}

function Invoke-ExternalCommand {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  $resolvedFilePath = $FilePath

  $isWindowsPlatform = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT

  if ($isWindowsPlatform) {
    switch ($FilePath.ToLowerInvariant()) {
      'npm' { $resolvedFilePath = 'npm.cmd' }
      'npx' { $resolvedFilePath = 'npx.cmd' }
    }
  }

  & $resolvedFilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $resolvedFilePath $($Arguments -join ' ')"
  }
}

function Invoke-Ssh {
  param(
    [string]$Target,
    [string]$Command,
    [string]$IdentityFile = '',
    [switch]$AutoAcceptHostKey
  )

  $sshArgs = @(
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=15'
  )

  if ($AutoAcceptHostKey) {
    $sshArgs += @('-o', 'StrictHostKeyChecking=accept-new')
  }

  if (-not [string]::IsNullOrWhiteSpace($IdentityFile)) {
    if (-not (Test-Path $IdentityFile)) {
      throw "SSH key file not found: $IdentityFile"
    }

    $sshArgs += @('-i', $IdentityFile)
  }

  $sshArgs += @($Target, $Command)

  & ssh @sshArgs
  if ($LASTEXITCODE -ne 0) {
    throw "SSH command failed for $Target"
  }
}

function Confirm-Action {
  param(
    [string]$Prompt,
    [switch]$SkipPrompt
  )

  if ($SkipPrompt) {
    return $true
  }

  $answer = Read-Host "$Prompt [y/N]"
  return $answer -match '^(y|yes|o|oui)$'
}

$resolvedHost = Get-FirstNonEmpty @($ServerHost, $env:WANEKOO_HOST, $env:DEPLOY_HOST, 'gem.proquelec.sn')
$resolvedUser = Get-FirstNonEmpty @($ServerUser, $env:WANEKOO_USER, $env:DEPLOY_USER, 'root')
$resolvedPath = Get-FirstNonEmpty @($DeployPath, $env:WANEKOO_DEPLOY_PATH, $env:DEPLOY_PATH, '/var/www/proquelec/gem-saas')
$resolvedSshConfigHost = Get-FirstNonEmpty @($SshConfigHost, $env:WANEKOO_SSH_HOST_ALIAS, $env:DEPLOY_SSH_HOST_ALIAS)
$resolvedSshKeyPath = Get-FirstNonEmpty @($SshKeyPath, $env:WANEKOO_SSH_KEY_PATH, $env:DEPLOY_SSH_KEY_PATH)
$sshTarget = if ($resolvedSshConfigHost) { $resolvedSshConfigHost } else { "$resolvedUser@$resolvedHost" }

Write-Host "GEM SAAS deployment" -ForegroundColor Green
Write-Host "Target: $sshTarget" -ForegroundColor DarkGray
Write-Host "Path:   $resolvedPath" -ForegroundColor DarkGray
Write-Host "Branch: $Branch" -ForegroundColor DarkGray
if ($resolvedSshKeyPath) {
  Write-Host "SSH key: $resolvedSshKeyPath" -ForegroundColor DarkGray
}

Invoke-Step "1. Verification du depot" {
  Invoke-ExternalCommand -FilePath 'git' -Arguments @('rev-parse', '--show-toplevel')
  Invoke-ExternalCommand -FilePath 'git' -Arguments @('status', '--short', '--branch')
}

if (-not $SkipTests) {
  Invoke-Step "2. Verification locale avant deploiement" {
    Invoke-ExternalCommand -FilePath 'npm' -Arguments @('run', 'build', '--prefix', 'frontend')
  }
}

if (-not $SkipCommit) {
  Invoke-Step "3. Preparation Git locale" {
    $pendingFiles = (& git status --short)
    if ($LASTEXITCODE -ne 0) {
      throw 'Unable to inspect git status before staging.'
    }

    if (-not $pendingFiles) {
      Write-Host "Aucun changement local a committer." -ForegroundColor Yellow
      return
    }

    Write-Host "Fichiers detectes pour commit:" -ForegroundColor Yellow
    $pendingFiles | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }

    if (-not (Confirm-Action "Confirmer le git add -A et le commit" -SkipPrompt:$Force)) {
      throw 'Commit aborted by user before staging.'
    }

    Invoke-ExternalCommand -FilePath 'git' -Arguments @('add', '-A')

    & git diff --cached --quiet
    $hasStagedChanges = $LASTEXITCODE -ne 0

    if (-not $hasStagedChanges) {
      Write-Host "Aucun changement a committer." -ForegroundColor Yellow
      return
    }

    $message = $CommitMessage
    if ([string]::IsNullOrWhiteSpace($message)) {
      $defaultMessage = "Deploy update - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
      $message = Read-Host "Message de commit"
      if ([string]::IsNullOrWhiteSpace($message)) {
        $message = $defaultMessage
      }
    }

    Invoke-ExternalCommand -FilePath 'git' -Arguments @('commit', '-m', $message)
  }
}

if (-not $SkipPush) {
  Invoke-Step "4. Publication vers GitHub" {
    Invoke-ExternalCommand -FilePath 'git' -Arguments @('push', 'origin', "HEAD:$Branch")
  }
}

if (-not $SkipDeploy) {
  Invoke-Step "5. Deploiement VPS" {
    if (-not (Confirm-Action "Confirmer le deploiement sur $sshTarget ($resolvedPath)" -SkipPrompt:$Force)) {
      throw 'Deployment aborted by user.'
    }

    $remoteScriptTemplate = @'
set -e

install_node_dependencies() {
  OMIT_DEV=''
  if [ "${1:-}" = 'production' ]; then
    OMIT_DEV='--omit=dev'
  fi

  if [ -f package-lock.json ]; then
    npm ci --ignore-scripts --legacy-peer-deps $OMIT_DEV
  else
    npm install --ignore-scripts --legacy-peer-deps $OMIT_DEV
  fi
}

run_prisma_migrate() {
  set +e
  PRISMA_MIGRATE_OUTPUT=$(npx prisma migrate deploy --schema=prisma/schema.prisma 2>&1)
  PRISMA_MIGRATE_EXIT=$?
  set -e

  printf '%s\n' "$PRISMA_MIGRATE_OUTPUT"

  if [ $PRISMA_MIGRATE_EXIT -ne 0 ]; then
    if printf '%s' "$PRISMA_MIGRATE_OUTPUT" | grep -q 'P3005'; then
      echo '[DEPLOY] Prisma P3005 detected: existing production database will be baselined.'
      echo '[DEPLOY] Marking existing migration directories as already applied.'

      for migration_dir in prisma/migrations/[0-9]*; do
        if [ -d "$migration_dir" ]; then
          migration_name=$(basename "$migration_dir")
          echo "[DEPLOY] Baseline migration: $migration_name"
          npx prisma migrate resolve --applied "$migration_name" --schema=prisma/schema.prisma
        fi
      done

      echo '[DEPLOY] Re-running Prisma migrate deploy after baseline.'
      npx prisma migrate deploy --schema=prisma/schema.prisma
      return $?
    fi

    return $PRISMA_MIGRATE_EXIT
  fi
}

restart_backend() {
  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart gem-backend --update-env || pm2 restart all --update-env
    pm2 save || true
    return 0
  fi

  if command -v npx >/dev/null 2>&1; then
    npx pm2 restart gem-backend --update-env || npx pm2 restart all --update-env
    npx pm2 save || true
    return 0
  fi

  if [ -x /root/.nvm/versions/node/v18.20.8/bin/pm2 ]; then
    /root/.nvm/versions/node/v18.20.8/bin/pm2 restart gem-backend --update-env || /root/.nvm/versions/node/v18.20.8/bin/pm2 restart all --update-env
    /root/.nvm/versions/node/v18.20.8/bin/pm2 save || true
    return 0
  fi

  echo '[DEPLOY] Unable to locate pm2 in the remote shell environment.'
  return 1
}

cd "__DEPLOY_PATH__"
git fetch --all
git reset --hard origin/__BRANCH__

install_node_dependencies production

cd frontend
install_node_dependencies
NODE_OPTIONS='--max-old-space-size=4096' npm run build

cd ../backend
install_node_dependencies
npx prisma generate --schema=prisma/schema.prisma
run_prisma_migrate
restart_backend

sleep 10
curl -fsS http://localhost:5005/health
'@

    $remoteScript = $remoteScriptTemplate.
      Replace('__DEPLOY_PATH__', $resolvedPath).
      Replace('__BRANCH__', $Branch)

    $remoteScriptBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($remoteScript))
    $remoteCommand = "printf '%s' '$remoteScriptBase64' | base64 -d | bash"

    Invoke-Ssh -Target $sshTarget -Command $remoteCommand -IdentityFile $resolvedSshKeyPath -AutoAcceptHostKey:$AcceptHostKey
  }
}

Write-Host ""
Write-Host "Deployment sequence completed." -ForegroundColor Green
