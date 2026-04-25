[CmdletBinding()]
param(
  [string]$ServerHost = '',
  [string]$ServerUser = '',
  [string]$DeployPath = '',
  [string]$Branch = 'main',
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

function Invoke-Git {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
  )

  & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Git command failed: git $($Args -join ' ')"
  }
}

function Invoke-Npm {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
  )

  & npm @Args
  if ($LASTEXITCODE -ne 0) {
    throw "NPM command failed: npm $($Args -join ' ')"
  }
}

$resolvedHost = Get-FirstNonEmpty @($ServerHost, $env:WANEKOO_HOST, $env:DEPLOY_HOST, 'gem.proquelec.sn')
$resolvedUser = Get-FirstNonEmpty @($ServerUser, $env:WANEKOO_USER, $env:DEPLOY_USER, 'root')
$resolvedPath = Get-FirstNonEmpty @($DeployPath, $env:WANEKOO_DEPLOY_PATH, $env:DEPLOY_PATH, '/var/www/proquelec/gem-saas')

Write-Host "GEM SAAS deployment" -ForegroundColor Green
Write-Host "Target: $resolvedUser@$resolvedHost" -ForegroundColor DarkGray
Write-Host "Path:   $resolvedPath" -ForegroundColor DarkGray
Write-Host "Branch: $Branch" -ForegroundColor DarkGray

Invoke-Step "1. Verification du depot" {
  Invoke-Git 'rev-parse' '--show-toplevel'
  Invoke-Git 'status' '--short' '--branch'
}

if (-not $SkipTests) {
  Invoke-Step "2. Verification locale avant deploiement" {
    Invoke-Npm 'run' 'build' '--prefix' 'frontend'
  }
}

if (-not $SkipCommit) {
  Invoke-Step "3. Preparation Git locale" {
    Invoke-Git 'add' '-A'

    & git diff --cached --quiet
    $hasStagedChanges = $LASTEXITCODE -ne 0

    if (-not $hasStagedChanges) {
      Write-Host "Aucun changement a committer." -ForegroundColor Yellow
      return
    }

    $defaultMessage = "Deploy update - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    $message = Read-Host "Message de commit"
    if ([string]::IsNullOrWhiteSpace($message)) {
      $message = $defaultMessage
    }

    Invoke-Git 'commit' '-m' $message
  }
}

if (-not $SkipPush) {
  Invoke-Step "4. Publication vers GitHub" {
    Invoke-Git 'push' 'origin' "HEAD:$Branch"
  }
}

if (-not $SkipDeploy) {
  Invoke-Step "5. Deploiement VPS" {
    $remoteCommands = @(
      'set -e'
      "cd $resolvedPath"
      'git fetch --all'
      "git reset --hard origin/$Branch"
      'npm install --no-scripts --legacy-peer-deps'
      'cd frontend'
      'npm install --no-scripts --legacy-peer-deps'
      "NODE_OPTIONS='--max-old-space-size=4096' npm run build"
      'cd ../backend'
      'npm install --no-scripts --legacy-peer-deps'
      'npx pm2 restart all'
      'sleep 10'
      'curl -fsS http://localhost:5005/health'
    ) -join ' && '

    & ssh "$resolvedUser@$resolvedHost" $remoteCommands
    if ($LASTEXITCODE -ne 0) {
      throw "Remote deployment failed on $resolvedHost"
    }
  }
}

Write-Host ""
Write-Host "Deployment sequence completed." -ForegroundColor Green
