param(
    [ValidateRange(1024, 65535)] [int] $Port = 8000,
    [string] $Db = "",
    [switch] $NoBrowser
)

$ErrorActionPreference = "Stop"
$projectDirectory = $PSScriptRoot
$bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$pythonCandidates = @()
$systemPython = Get-Command python -ErrorAction SilentlyContinue
if ($systemPython) { $pythonCandidates += $systemPython.Source }
if (Test-Path -LiteralPath $bundledPython) { $pythonCandidates += $bundledPython }
$pythonExecutable = $null
foreach ($candidate in ($pythonCandidates | Select-Object -Unique)) {
    try {
        & $candidate -c 'import reportlab' 2>$null
        if ($LASTEXITCODE -eq 0) { $pythonExecutable = $candidate; break }
    } catch { }
}
if (-not $pythonExecutable) {
    throw 'No se encuentra Python con reportlab. Instala los requisitos con python -m pip install -r requirements.txt.'
}
$runtimeDirectory = Join-Path $projectDirectory '.runtime'
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
$launchFile = Join-Path $runtimeDirectory 'inicio.json'
$serverPath = Join-Path $projectDirectory 'server.py'
if (-not $Db -and (Test-Path -LiteralPath $launchFile)) {
    try {
        $savedLaunch = Get-Content -LiteralPath $launchFile -Raw | ConvertFrom-Json
        $savedProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($savedLaunch.processId)" -ErrorAction SilentlyContinue
        if ($savedProcess -and $savedProcess.CommandLine -like "*$serverPath*" -and $savedLaunch.directory -eq $projectDirectory) {
            $savedUrl = "http://127.0.0.1:$($savedLaunch.port)/"
            $savedResponse = Invoke-WebRequest -UseBasicParsing -Uri ($savedUrl + 'api/bootstrap') -TimeoutSec 3
            if ($savedResponse.StatusCode -eq 200) {
                Write-Host "Buganvilla Tours ya esta disponible en $savedUrl"
                if (-not $NoBrowser) { Start-Process $savedUrl }
                exit 0
            }
        }
    } catch { }
}
$selectedPort = $null
foreach ($candidatePort in $Port..([Math]::Min($Port + 10, 65535))) {
    $portProbe = $null
    try {
        $portProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidatePort)
        $portProbe.Start()
        $selectedPort = $candidatePort
        break
    } catch { } finally { if ($portProbe) { $portProbe.Stop() } }
}
if (-not $selectedPort) { throw 'No hay un puerto local disponible. Prueba iniciar.ps1 -Port 8100.' }
$serverArguments = @('-u', ('"' + $serverPath + '"'), '--port', "$selectedPort")
if ($Db) { $serverArguments += @('--db', ('"' + $Db + '"')) }
$serverProcess = Start-Process -FilePath $pythonExecutable -ArgumentList $serverArguments -WorkingDirectory $projectDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDirectory "servidor-$selectedPort.log") -RedirectStandardError (Join-Path $runtimeDirectory "servidor-$selectedPort-error.log") -PassThru
$portalUrl = "http://127.0.0.1:$selectedPort/"
$isReady = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $portalResponse = Invoke-WebRequest -UseBasicParsing -Uri ($portalUrl + 'api/bootstrap') -TimeoutSec 1
        if ($portalResponse.StatusCode -eq 200) { $isReady = $true; break }
    } catch { }
    if ($serverProcess.HasExited) { break }
    Start-Sleep -Milliseconds 200
}
if (-not $isReady) { throw "No se pudo iniciar la pagina. Revisa .runtime/servidor-$selectedPort-error.log." }
if (-not $Db) { @{ processId = $serverProcess.Id; port = $selectedPort; directory = $projectDirectory } | ConvertTo-Json | Set-Content -LiteralPath $launchFile -Encoding UTF8 }
Write-Host "Buganvilla Tours: $portalUrl"
Write-Host 'La pagina funciona en segundo plano. Los pagos son simulados.'
if (-not $NoBrowser) { Start-Process $portalUrl }
exit 0
