
# fix-imports.ps1
# Replaces deep relative imports (../../.. and deeper) with absolute path aliases
# Run from: frontend/

param(
    [string]$SearchPath = "src/modules",
    [switch]$DryRun = $false
)

# ─── Alias map (with trailing slash) ──────────────────────────────────────────
$aliasMap = @(
    @{ Pattern = "utils/";      Alias = "@utils/" },
    @{ Pattern = "hooks/";      Alias = "@hooks/" },
    @{ Pattern = "components/"; Alias = "@components/" },
    @{ Pattern = "services/";   Alias = "@services/" },
    @{ Pattern = "contexts/";   Alias = "@contexts/" },
    @{ Pattern = "store/";      Alias = "@/store/" },
    @{ Pattern = "constants/";  Alias = "@/constants/" },
    @{ Pattern = "types/";      Alias = "@/types/" },
    @{ Pattern = "layouts/";    Alias = "@/layouts/" },
    @{ Pattern = "pages/";      Alias = "@pages/" },
    @{ Pattern = "api/";        Alias = "@/api/" },
    @{ Pattern = "core/";       Alias = "@core/" },
    @{ Pattern = "data/";       Alias = "@/data/" },
    @{ Pattern = "adapters/";   Alias = "@/adapters/" },
    @{ Pattern = "domain/";     Alias = "@/domain/" },
    @{ Pattern = "config/";     Alias = "@/config/" },
    @{ Pattern = "workers/";    Alias = "@/workers/" },
    @{ Pattern = "geo/";        Alias = "@/geo/" },
    @{ Pattern = "styles/";     Alias = "@/styles/" }
)

# ─── Barrel alias map (no trailing slash — exact barrel imports) ───────────────
# e.g. from '../../../components'  →  from '@components'
$barrelMap = @(
    @{ Pattern = "components"; Alias = "@components" },
    @{ Pattern = "utils";      Alias = "@utils" },
    @{ Pattern = "hooks";      Alias = "@hooks" },
    @{ Pattern = "services";   Alias = "@services" },
    @{ Pattern = "contexts";   Alias = "@contexts" },
    @{ Pattern = "layouts";    Alias = "@/layouts" },
    @{ Pattern = "pages";      Alias = "@pages" }
)

$files = Get-ChildItem -Recurse -Path $SearchPath -Include "*.tsx","*.ts"
$totalFixed = 0

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }

    $changed = $false

    # 1. Replace path imports: ../../../utils/foo → @utils/foo
    foreach ($entry in $aliasMap) {
        $seg   = [regex]::Escape($entry.Pattern)
        $alias = $entry.Alias
        $regex = "(?<='|`")(\.\./){2,6}$seg"
        $newContent = [regex]::Replace($content, $regex, $alias)
        if ($newContent -ne $content) { $content = $newContent; $changed = $true }
    }

    # 2. Replace barrel imports: '../../../components' → '@components'
    #    Must end with a quote (not a slash) to avoid double-matching
    foreach ($entry in $barrelMap) {
        $seg   = [regex]::Escape($entry.Pattern)
        $alias = $entry.Alias
        # Lookahead: the barrel name is followed directly by a closing quote
        $regex = "(?<='|`")(\.\./){2,6}$seg(?='|`")"
        $newContent = [regex]::Replace($content, $regex, $alias)
        if ($newContent -ne $content) { $content = $newContent; $changed = $true }
    }

    if ($changed) {
        $totalFixed++
        if (-not $DryRun) {
            Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        }
        Write-Host "  [FIXED] $($file.FullName -replace [regex]::Escape((Get-Location).Path + '\'), '')" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Done. $totalFixed file(s) updated." -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "(Dry-run mode — no files were written)" -ForegroundColor Yellow
}
