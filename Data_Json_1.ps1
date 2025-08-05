$serversList = "E:\acer\astro\2025\Poject\Monitor\ServerList.txt"

$servers = get-content $serversList

$allPoints = @()

foreach ($server in $servers) {
    try {
        $newPoint = Invoke-Command -ComputerName $server -ScriptBlock {
            $cpu = Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 2
            $cpuAvg = ($cpu.CounterSamples | Select-Object -ExpandProperty CookedValue | Measure-Object -Average).Average

            $ram = Get-WmiObject Win32_OperatingSystem
            $disk = Get-WmiObject Win32_LogicalDisk -Filter "DriveType=3"
            $boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime

            return @{
                Hostname = $env:COMPUTERNAME
                Time = (Get-Date).ToString("o")
                CPU = [math]::Round($cpuAvg, 2)
                RAMFreeGB = [math]::Round(($ram.FreePhysicalMemory / 1MB), 2)
                TotalRAMGB = [math]::Round(($ram.TotalVisibleMemorySize / 1MB), 2)
                Disk = $disk | Select-Object DeviceID,
                    @{Name = "FreeGB"; Expression = { [math]::Round($_.FreeSpace / 1GB, 2) } },
                    @{Name = "SizeGB"; Expression = { [math]::Round($_.Size / 1GB, 2) } }
                LastBoot = $boot.ToString("o")
            }
        }

        $allPoints += $newPoint
    }
    catch {
        Write-Warning ("Failed to fetch data from {0}: {1}" -f $server, $_.Exception.Message)
    }
}

# Load old history if exists
$jsonPath = "E:\acer\astro\2025\Poject\Monitor\data_1.json"
if (Test-Path $jsonPath) {
    $history = Get-Content $jsonPath | ConvertFrom-Json
    if ($history -isnot [System.Collections.IEnumerable] -or $history -is [System.Management.Automation.PSObject]) {
        $history = @($history)
    }
} else {
    $history = @()
}

# Append new entries per server
$history += $allPoints

# Keep last 100 entries max
if ($history.Count -gt 100) {
    $history = $history[-100 .. -1]
}

$history | ConvertTo-Json -Depth 4 | Out-File $jsonPath -Encoding UTF8
