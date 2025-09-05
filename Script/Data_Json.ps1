$cpu = Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 2
$cpuAvg = ($cpu.CounterSamples | Select-Object -ExpandProperty CookedValue | Measure-Object -Average).Average
$ram = Get-WmiObject Win32_OperatingSystem
$disk = Get-WmiObject Win32_LogicalDisk -Filter "DriveType=3"
$boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime

# new point

$newPoint = @{
    Time = (Get-Date).ToString("o")
    CPU = [math]::Round($cpuAvg, 2)
    RAMFreeGB = [math]::Round(($ram.FreePhysicalMemory/1MB), 2)  # Free RAM in GB
    TotalRAMGB = [math]::Round(($ram.TotalVisibleMemorySize/1MB), 2)  # Total RAM in GB
    Disk = $disk | Select-Object DeviceID,
        @{Name="FreeGB";Expression={[math]::Round($_.FreeSpace/1GB, 2)}},
        @{Name="SizeGB";Expression={[math]::Round($_.Size/1GB, 2)}}
    LastBoot = $boot.ToString("o")
}

# If the file exists, load old points

if (Test-Path "E:\acer\astro\2025\Poject\Monitor\data.json") {
    $history = Get-Content "E:\acer\astro\2025\Poject\Monitor\data.json" | ConvertFrom-Json
    # If it's not an array, make it an array
    if ($history -isnot [System.Collections.IEnumerable] -or $history -is [System.Management.Automation.PSObject]) {
        $history = @($history)
    }
} else {
    $history = @()
}

# Append new point
$history += $newPoint

# Keep only last 20 points
if ($history.Count -gt 50) {
    $history = $history[-50 ..-1]
}

$history | ConvertTo-Json -Depth 4 | Out-File "E:\acer\astro\2025\Poject\Monitor\data.json" -Encoding UTF8