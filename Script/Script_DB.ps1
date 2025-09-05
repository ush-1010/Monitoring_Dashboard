# ===============================================
# CONFIGURATION
# ===============================================
$serversList = "C:\Share_Details\ServerList.txt"
$dbServer    = "YOUR_SQL_SERVER"    # e.g., "SQLSERVER01"
$dbName      = "InfraMonitorDB"
$dbUser      = "dbuser"
$dbPass      = "dbpassword"

# Connection String
$connString = "Server=$dbServer;Database=$dbName;User Id=$dbUser;Password=$dbPass;"

Add-Type -AssemblyName "System.Data"

# ===============================================
# PREPARE DATA TABLES FOR BULK INSERT
# ===============================================
$serverTable = New-Object System.Data.DataTable
$serverTable.Columns.Add("Hostname",    [string])
$serverTable.Columns.Add("CaptureTime", [datetime])
$serverTable.Columns.Add("CPU_Percent", [double])
$serverTable.Columns.Add("RAMFreeGB",   [double])
$serverTable.Columns.Add("TotalRAMGB",  [double])
$serverTable.Columns.Add("LastBoot",    [datetime])

$diskTable = New-Object System.Data.DataTable
$diskTable.Columns.Add("Hostname", [string])
$diskTable.Columns.Add("DeviceID", [string])
$diskTable.Columns.Add("FreeGB",   [double])
$diskTable.Columns.Add("SizeGB",   [double])

# ===============================================
# COLLECT DATA
# ===============================================
$servers = Get-Content $serversList

foreach ($server in $servers) {
    try {
        $data = Invoke-Command -ComputerName $server -ScriptBlock {
            $cpu = Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 2
            $cpuAvg = ($cpu.CounterSamples | Select-Object -ExpandProperty CookedValue | Measure-Object -Average).Average

            $ram = Get-WmiObject Win32_OperatingSystem
            $disk = Get-WmiObject Win32_LogicalDisk -Filter "DriveType=3"
            $boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime

            return [PSCustomObject]@{
                Hostname   = $env:COMPUTERNAME
                CaptureTime= Get-Date
                CPU        = [math]::Round($cpuAvg, 2)
                RAMFreeGB  = [math]::Round(($ram.FreePhysicalMemory / 1MB), 2)
                TotalRAMGB = [math]::Round(($ram.TotalVisibleMemorySize / 1MB), 2)
                LastBoot   = $boot
                Disks      = $disk | ForEach-Object {
                    [PSCustomObject]@{
                        DeviceID = $_.DeviceID
                        FreeGB   = [math]::Round($_.FreeSpace / 1GB, 2)
                        SizeGB   = [math]::Round($_.Size / 1GB, 2)
                    }
                }
            }
        }

        # Add to ServerStatus table
        $serverRow = $serverTable.NewRow()
        $serverRow.Hostname    = $data.Hostname
        $serverRow.CaptureTime = $data.CaptureTime
        $serverRow.CPU_Percent = $data.CPU
        $serverRow.RAMFreeGB   = $data.RAMFreeGB
        $serverRow.TotalRAMGB  = $data.TotalRAMGB
        $serverRow.LastBoot    = $data.LastBoot
        $serverTable.Rows.Add($serverRow)

        # Add to DiskStatus table
        foreach ($d in $data.Disks) {
            $diskRow = $diskTable.NewRow(
