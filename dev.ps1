<#
    ReturnFlow local development startup.

    Run from the repository root:

        .\dev.ps1

    Starts PostgreSQL + MinIO (Docker) and the Spring Boot API (apps/api,
    local profile, via the Maven Wrapper) in its own visible PowerShell
    window so backend logs stay separate and readable, then starts the Vite
    dev server (apps/web) attached directly to THIS console — its logs
    print right here, and it keeps running here after the script finishes
    and hands control back to you (Ctrl+C in this console stops Vite only;
    it has no effect on the separately-windowed backend). Safe to re-run:
    an already-running ReturnFlow backend/frontend is detected and reused,
    never duplicated, and a required port occupied by something else stops
    the script instead of killing that process or picking another port.

    Optional: copy dev.local.ps1.example to dev.local.ps1 (repository root,
    ignored by Git) to set BOOTSTRAP_ADMIN_EMAIL/PASSWORD/NAME for the
    backend's first-admin bootstrap. See docs/DEVELOPMENT_WORKFLOW.md.
#>

$ErrorActionPreference = 'Stop'

# $PSScriptRoot is this script's own directory (the repository root),
# independent of the caller's current working directory.
$RepoRoot = $PSScriptRoot
$ApiRoot = Join-Path $RepoRoot 'apps\api'
$WebRoot = Join-Path $RepoRoot 'apps\web'
$ComposeFile = Join-Path $RepoRoot 'infra\docker-compose.yml'
$MvnwCmd = Join-Path $ApiRoot 'mvnw.cmd'
$LocalConfigFile = Join-Path $RepoRoot 'dev.local.ps1'

$BackendPort = 8080
$FrontendPort = 5173

$script:Summary = [ordered]@{
    PostgreSQL = 'not started'
    MinIO      = 'not started'
    Backend    = 'not started'
    Web        = 'not started'
}
$script:ShellHost = $null
$script:NpmCmd = $null
$script:NodeExe = $null
$script:NodeDir = $null

function Write-Section {
    param([string]$Title)
    Write-Host ''
    Write-Host "== $Title ==" -ForegroundColor Cyan
}

function Resolve-NpmCommand {
    # A Windows Node.js install places both an extensionless POSIX shell
    # script named "npm" and a real "npm.cmd" batch launcher in the same
    # directory (`where.exe npm` lists both). Windows has no execution
    # handler for the extensionless file at all — depending on the spawning
    # shell/version and its PATHEXT-driven command-resolution order, a bare
    # `npm` can resolve to that unusable file instead of npm.cmd, which is
    # exactly what produced "npm is not recognized" in the spawned
    # -NoProfile frontend window even though `npm -v` works fine in a normal
    # terminal. Resolving npm.cmd's absolute path once here, in the parent
    # process, and invoking that explicit path in the child (the same
    # pattern already used for $MvnwCmd below) sidesteps the ambiguity
    # entirely instead of depending on the child's own resolution order.
    $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    # Fallback for an unusual install that doesn't expose a plain "npm.cmd"
    # name on PATH: take the first "npm" match that is an actual executable
    # Windows can run directly, skipping any extensionless script match.
    $candidates = Get-Command npm -All -ErrorAction SilentlyContinue
    $executable = $candidates | Where-Object { $_.Source -match '\.(cmd|exe)$' } | Select-Object -First 1
    if ($executable) { return $executable.Source }

    return $null
}

function Resolve-NodeExecutable {
    # npm.cmd itself internally invokes the bare `node` command. Resolving
    # npm.cmd's own path (Resolve-NpmCommand, above) is not enough on its
    # own: a spawned -NoProfile child does not reliably inherit the Node.js
    # install directory on PATH, so npm.cmd starts correctly but then fails
    # with "node is not recognized" the moment it tries to run node. Node's
    # own executable has no extensionless-script ambiguity like npm does —
    # a plain node.exe resolution is enough, with the same "-All, first
    # real executable" fallback as Resolve-NpmCommand purely for symmetry.
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = Get-Command node -All -ErrorAction SilentlyContinue
    $executable = $candidates | Where-Object { $_.Source -match '\.exe$' } | Select-Object -First 1
    if ($executable) { return $executable.Source }

    return $null
}

function Assert-RequiredTools {
    Write-Section 'Checking required tools'

    $missing = @()

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        $missing += 'docker (Docker Desktop CLI)'
    }
    $script:NodeExe = Resolve-NodeExecutable
    if (-not $script:NodeExe) {
        $missing += 'node (Node.js)'
    } else {
        $script:NodeDir = Split-Path -Parent $script:NodeExe
    }
    $script:NpmCmd = Resolve-NpmCommand
    if (-not $script:NpmCmd) {
        $missing += 'npm (Node.js)'
    }
    if (-not (Test-Path $MvnwCmd)) {
        $missing += "Maven Wrapper at $MvnwCmd"
    }

    # The backend runs in its own spawned window; pwsh (PowerShell 7) is
    # preferred if present, Windows PowerShell is an acceptable fallback —
    # only having neither is fatal. The frontend no longer spawns a window
    # of its own (see Start-Frontend), so it needs no shell-host choice.
    if (Get-Command pwsh -ErrorAction SilentlyContinue) {
        $script:ShellHost = 'pwsh'
    } elseif (Get-Command powershell -ErrorAction SilentlyContinue) {
        $script:ShellHost = 'powershell'
    } else {
        $missing += 'pwsh or powershell (to open the backend window)'
    }

    if ($missing.Count -gt 0) {
        Write-Host 'Missing required tools:' -ForegroundColor Red
        foreach ($tool in $missing) { Write-Host "  - $tool" -ForegroundColor Red }
        exit 1
    }

    Write-Host 'All required tools are available.' -ForegroundColor Green
}

function Import-LocalConfig {
    if (Test-Path $LocalConfigFile) {
        Write-Section 'Loading dev.local.ps1'
        . $LocalConfigFile
        if ($env:BOOTSTRAP_ADMIN_EMAIL) {
            # Never print BOOTSTRAP_ADMIN_PASSWORD, only confirm it is set.
            $passwordState = if ($env:BOOTSTRAP_ADMIN_PASSWORD) { 'set' } else { 'NOT set' }
            Write-Host "Bootstrap admin configured: $($env:BOOTSTRAP_ADMIN_EMAIL) (password $passwordState)." -ForegroundColor DarkGray
        }
    }
}

function Wait-ContainerHealthy {
    param([string]$ContainerName, [int]$TimeoutSeconds = 60)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $status = (docker inspect --format '{{.State.Health.Status}}' $ContainerName 2>$null)
        if ($status -eq 'healthy') {
            return 'healthy'
        }
        Start-Sleep -Seconds 2
    }
    return "not healthy within ${TimeoutSeconds}s (see: docker logs $ContainerName)"
}

function Start-Infrastructure {
    Write-Section 'Infrastructure (PostgreSQL, MinIO)'

    docker compose -f $ComposeFile up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'docker compose failed to start infrastructure — see output above.' -ForegroundColor Red
        $script:Summary['PostgreSQL'] = 'FAILED - docker compose error'
        $script:Summary['MinIO'] = 'FAILED - docker compose error'
        Write-Summary
        exit 1
    }

    $script:Summary['PostgreSQL'] = Wait-ContainerHealthy -ContainerName 'returnflow-postgres'
    $script:Summary['MinIO'] = Wait-ContainerHealthy -ContainerName 'returnflow-minio'
    Write-Host "PostgreSQL: $($script:Summary['PostgreSQL'])"
    Write-Host "MinIO:      $($script:Summary['MinIO'])"
}

function Get-PortListener {
    param([int]$Port)
    return Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Test-HttpReady {
    param([string]$Url, [int]$TimeoutSec = 3)
    try {
        return Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
    } catch {
        return $null
    }
}

function Get-ResponseText {
    # Invoke-WebRequest -UseBasicParsing returns .Content as a raw byte[]
    # (not a decoded string) whenever the response Content-Type isn't
    # recognized as text — which includes Spring Boot Actuator's own
    # "application/vnd.spring-boot.actuator.v3+json". Decode explicitly so
    # -match works against the actual body instead of a byte-array
    # stringification.
    param($Response)
    if ($null -eq $Response) { return '' }
    if ($Response.Content -is [byte[]]) {
        return [System.Text.Encoding]::UTF8.GetString($Response.Content)
    }
    return [string]$Response.Content
}

function Wait-HttpHealthy {
    param([string]$Url, [int]$TimeoutSeconds = 90)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $response = Test-HttpReady -Url $Url
        if ($response -and $response.StatusCode -eq 200) {
            return $true
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Get-PortOwnerDescription {
    param([int]$Port)
    $listener = Get-PortListener -Port $Port
    if (-not $listener) { return $null }
    $procId = $listener.OwningProcess
    $procName = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
    return "$procName (PID $procId)"
}

function Start-Backend {
    Write-Section "Backend (Spring Boot, port $BackendPort)"

    $listener = Get-PortListener -Port $BackendPort
    if ($listener) {
        $health = Test-HttpReady -Url "http://localhost:$BackendPort/actuator/health"
        $isReturnFlow = $false
        if ($health -and $health.StatusCode -eq 200 -and (Get-ResponseText $health) -match '"status"\s*:\s*"UP"') {
            $info = Test-HttpReady -Url "http://localhost:$BackendPort/actuator/info"
            if ($info -and (Get-ResponseText $info) -match '(?i)returnflow') {
                $isReturnFlow = $true
            }
        }

        if ($isReturnFlow) {
            Write-Host "Port $BackendPort is already serving the ReturnFlow backend — reusing it." -ForegroundColor Green
            $script:Summary['Backend'] = "http://localhost:$BackendPort (already running, reused)"
            return
        }

        $owner = Get-PortOwnerDescription -Port $BackendPort
        Write-Host "Port $BackendPort is occupied by $owner, which does not look like the ReturnFlow backend." -ForegroundColor Red
        Write-Host 'Refusing to start a second backend or touch that process. Free the port and re-run .\dev.ps1.' -ForegroundColor Red
        $script:Summary['Backend'] = "FAILED - port $BackendPort occupied by $owner"
        return
    }

    Write-Host 'Starting backend in a new window...' -ForegroundColor Yellow
    # apps/api/mvnw.cmd (vendored Apache Maven Wrapper, not project code) is a
    # batch/PowerShell polyglot script that itself internally shells out to
    # the bare command name "powershell" (Windows PowerShell 5.1, never
    # "pwsh") to resolve/download the Maven distribution. That inner call
    # only succeeds if System32\WindowsPowerShell\v1.0 is on PATH for THIS
    # spawned process specifically — not guaranteed, since a freshly spawned
    # window also loads the developer's own PowerShell profile (which may
    # rebuild $env:PATH, e.g. for nvm/pyenv/prompt tooling) and can end up
    # without it even though the developer's normal interactive terminal has
    # it. -NoProfile makes this window's environment deterministic, and the
    # PATH line below defensively guarantees mvnw.cmd's inner "powershell"
    # call resolves regardless of what the profile (if any) already did.
    $command = @"
`$Host.UI.RawUI.WindowTitle = 'ReturnFlow API (local)'
`$winPowerShellDir = Join-Path `$env:SystemRoot 'System32\WindowsPowerShell\v1.0'
if ((`$env:PATH -split ';') -notcontains `$winPowerShellDir) {
    `$env:PATH = "`$winPowerShellDir;`$env:PATH"
}
Set-Location '$ApiRoot'
`$env:SPRING_PROFILES_ACTIVE = 'local'
& '$MvnwCmd' spring-boot:run
if (`$LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host "Backend process exited with code `$LASTEXITCODE — see the output above." -ForegroundColor Red
}
"@
    # Environment variables set in this process (including BOOTSTRAP_ADMIN_*
    # from dev.local.ps1) are inherited by this child process automatically.
    Start-Process -FilePath $script:ShellHost -ArgumentList '-NoProfile', '-NoExit', '-Command', $command -WorkingDirectory $ApiRoot | Out-Null

    if (Wait-HttpHealthy -Url "http://localhost:$BackendPort/actuator/health" -TimeoutSeconds 90) {
        $script:Summary['Backend'] = "http://localhost:$BackendPort"
    } else {
        $script:Summary['Backend'] = "FAILED - not healthy within 90s, check the 'ReturnFlow API (local)' window"
    }
}

function Start-Frontend {
    Write-Section "Frontend (Vite, port $FrontendPort)"

    $listener = Get-PortListener -Port $FrontendPort
    if ($listener) {
        $response = Test-HttpReady -Url "http://localhost:$FrontendPort/"
        $isReturnFlow = $response -and $response.StatusCode -eq 200 -and (Get-ResponseText $response) -match '<title>\s*ReturnFlow\s*</title>'

        if ($isReturnFlow) {
            Write-Host "Port $FrontendPort is already serving the ReturnFlow web app — reusing it." -ForegroundColor Green
            $script:Summary['Web'] = "http://localhost:$FrontendPort (already running, reused)"
            return
        }

        $owner = Get-PortOwnerDescription -Port $FrontendPort
        Write-Host "Port $FrontendPort is occupied by $owner, which does not look like the ReturnFlow web app." -ForegroundColor Red
        Write-Host 'Refusing to start a second frontend or touch that process. Free the port and re-run .\dev.ps1.' -ForegroundColor Red
        $script:Summary['Web'] = "FAILED - port $FrontendPort occupied by $owner"
        return
    }

    if (-not (Test-Path (Join-Path $WebRoot 'node_modules'))) {
        Write-Host "apps\web\node_modules not found. Run 'npm install' in apps\web first — this script does not install dependencies automatically." -ForegroundColor Red
        $script:Summary['Web'] = 'FAILED - dependencies not installed (run npm install in apps\web)'
        return
    }

    Write-Host 'Starting frontend, attached to this console...' -ForegroundColor Yellow
    # npm.cmd (resolved above) internally invokes bare `node`; defensively
    # ensure THIS process's own PATH already contains the resolved Node
    # directory before launching it, since Start-Process below inherits
    # this process's environment automatically (same defensive intent as
    # Start-Backend's PATH preparation for mvnw.cmd's inner "powershell"
    # call, applied here to npm.cmd's inner "node" call). This only ever
    # changes this script's own process-scoped $env:PATH, never the
    # persistent machine/user environment.
    if (($env:PATH -split ';') -notcontains $script:NodeDir) {
        $env:PATH = "$script:NodeDir;$env:PATH"
    }

    # -NoNewWindow keeps Vite's own stdout/stderr attached to the console
    # that invoked .\dev.ps1 — no separate window/tab — while omitting
    # -Wait lets this script continue immediately to the health check and
    # final summary below instead of blocking here until Vite exits (which,
    # for a dev server, is effectively never without Ctrl+C). The resolved
    # npm.cmd absolute path is invoked directly via -FilePath, not a bare
    # `npm` name, for the same reason as Resolve-NpmCommand's own comment.
    Start-Process -FilePath $script:NpmCmd -ArgumentList 'run', 'dev' -NoNewWindow -WorkingDirectory $WebRoot | Out-Null

    if (Wait-HttpHealthy -Url "http://localhost:$FrontendPort/" -TimeoutSeconds 60) {
        $script:Summary['Web'] = "http://localhost:$FrontendPort"
        Write-Host "Vite is now attached to this console — Ctrl+C here stops the frontend only; the backend keeps running in its own window." -ForegroundColor DarkGray
    } else {
        $script:Summary['Web'] = "FAILED - not reachable within 60s, check the console output above"
    }
}

function Write-Summary {
    Write-Section 'ReturnFlow local development'
    Write-Host ''
    foreach ($entry in $script:Summary.GetEnumerator()) {
        $line = '{0,-12}{1}' -f $entry.Key, $entry.Value
        if ($entry.Value -match '^FAILED|not healthy') {
            Write-Host $line -ForegroundColor Red
        } else {
            Write-Host $line -ForegroundColor Green
        }
    }
    Write-Host ''
}

Assert-RequiredTools
Import-LocalConfig
Start-Infrastructure
Start-Backend
Start-Frontend
Write-Summary
