# ================================
# Remote Server Connectivity Test
# ================================

$serversList = "C:\Share_Details\ServerList.txt"
$servers = Get-Content $serversList

foreach ($ComputerName in $servers) {
    Write-Host "`n===== Testing $ComputerName =====" -ForegroundColor Cyan

    # 1. Test Ping
    Write-Host "[1] Testing Ping..." -ForegroundColor Yellow
    if (Test-Connection -ComputerName $ComputerName -Count 1 -Quiet) {
        Write-Host "✅ Ping successful"
    } else {
        Write-Host "❌ Ping failed"
    }

    # 2. Test WinRM (PowerShell Remoting)
    Write-Host "`n[2] Testing WinRM (Invoke-Command)..." -ForegroundColor Yellow
    try {
        $result = Invoke-Command -ComputerName $ComputerName -ScriptBlock { hostname } -ErrorAction Stop
        Write-Host "✅ WinRM successful - Remote host: $result"
    }
    catch {
        Write-Host "❌ WinRM failed: $($_.Exception.Message)"
    }

    # 3. Test CIM/WMI
    Write-Host "`n[3] Testing CIM (Get-CimInstance)..." -ForegroundColor Yellow
    try {
        $os = Get-CimInstance -ComputerName $ComputerName -ClassName Win32_OperatingSystem -ErrorAction Stop
        Write-Host "✅ CIM successful - OS: $($os.Caption) $($os.Version)"
    }
    catch {
        Write-Host "❌ CIM failed: $($_.Exception.Message)"
    }

    Write-Host "===== Test Completed for $ComputerName =====" -ForegroundColor Cyan
}
