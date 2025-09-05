# Requires Windows PowerShell 5.1+

# -------------------------------
# SETTINGS
# -------------------------------
$port = 8081 # You can pick any open port
$prefix = "http://+:$port/monitor/"

# -------------------------------
# Start Listener
# -------------------------------
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Monitoring API running at http://+:8081/monitor/"
Write-Output "Press Ctrl+C to stop."

# -------------------------------
# Loop forever
# -------------------------------
while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response
    $request = $context.Request

    # -------------------------------
    # Get accurate CPU usage
    # -------------------------------
    $cpu = Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 2
    $cpuAvg = ($cpu.CounterSamples | Select-Object -ExpandProperty CookedValue | Measure-Object -Average).Average

    $ram = Get-WmiObject Win32_OperatingSystem
    $disk = Get-WmiObject Win32_LogicalDisk -Filter "DriveType=3"
    $boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime

    $output = @{
        CPU = [math]::Round($cpuAvg, 2)
        RAMFreeGB = [math]::Round(($ram.FreePhysicalMemory/1MB), 2)
        TotalRAMGB = [math]::Round(($ram.TotalVisibleMemorySize/1MB), 2)
        Disk = $disk | Select-Object DeviceID,
               @{Name="FreeGB";Expression={[math]::Round($_.FreeSpace/1GB, 2)}},
               @{Name="SizeGB";Expression={[math]::Round($_.Size/1GB, 2)}}
        LastBoot = $boot.ToString("o")
    }

    $json = $output | ConvertTo-Json

    # CORS header here
    $response.AddHeader("Access-Control-Allow-Origin", "*")
    $response.ContentType = "application/json"
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.OutputStream.Close()
}