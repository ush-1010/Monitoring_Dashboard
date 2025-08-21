# ================================
# Remote Server Connectivity Test (WMI/DCOM)
# ================================

$serversList = "C:\Share_Details\ServerList.txt"
$servers = Get-Content $serversList

$results = foreach ($ComputerName in $servers) {
    Write-Host "`n===== Testing $ComputerName =====" -ForegroundColor Cyan

    # 1. Test Ping
    $PingOK = Test-Connection -ComputerName $ComputerName -Count 1 -Quiet

    if ($PingOK) {
        Write-Host "✅ Ping successful"
    } else {
        Write-Host "❌ Ping failed"
    }

    # 2. Test WMI
    try {
        $os = Get-WmiObject -Class Win32_OperatingSystem -ComputerName $ComputerName -ErrorAction Stop
        Write-Host "✅ WMI successful - OS: $($os.Caption) $($os.Version)"
        $WmiOK = $true
    }
    catch {
        Write-Host "❌ WMI failed: $($_.Exception.Message)"
        $WmiOK = $false
    }

    # Output object for CSV/report
    [PSCustomObject]@{
        ServerName = $ComputerName
        Ping       = if ($PingOK) {"OK"} else {"Fail"}
        WMI        = if ($WmiOK) {"OK"} else {"Fail"}
    }
}

# Export results to CSV
$results 