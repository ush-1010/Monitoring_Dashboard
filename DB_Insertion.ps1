# ===============================================
# CONFIGURATION
# ===============================================
$serversList = "C:\Share_Details\ServerList.txt"
$dbServer    = "castel"    # e.g., "SQLSERVER01"
$databaseName = "InfraMonitorDB"
$username = "monitor"
$password = "NewPass123"

# Connection String
$connectionString = "Data Source=$serverName;Database=$databaseName;User ID=$username;Password=$password;TrustServerCertificate=True;"

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
$diskTable.Columns.Add("ServerStatusID", [int])
$diskTable.Columns.Add("DeviceID",       [string])
$diskTable.Columns.Add("FreeGB",         [double])
$diskTable.Columns.Add("SizeGB",         [double])

# ===============================================
# BULK INSERT FUNCTION
# ===============================================
function BulkInsert {
    param(
        [System.Data.DataTable]$DataTable,
        [string]$DestinationTable
    )
    $connection = New-Object System.Data.SqlClient.SqlConnection $connString
    $bulkCopy = New-Object System.Data.SqlClient.SqlBulkCopy $connection
    $bulkCopy.DestinationTableName = $DestinationTable
    $bulkCopy.BatchSize = 1000
    $bulkCopy.BulkCopyTimeout = 60

    # Explicit mapping
    foreach ($col in $DataTable.Columns) {
        $bulkCopy.ColumnMappings.Add($col.ColumnName, $col.ColumnName) | Out-Null
    }

    $connection.Open()
    $bulkCopy.WriteToServer($DataTable)
    $connection.Close()
}


# ===============================================
# COLLECT & INSERT DATA
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
                CaptureTime= (Get-Date)
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

        # First insert into ServerStatus table to get ID
        $insertServerQuery = @"
INSERT INTO ServerStatus (Hostname, CaptureTime, CPU_Percent, RAMFreeGB, TotalRAMGB, LastBoot)
OUTPUT INSERTED.ID
VALUES (@Hostname, @CaptureTime, @CPU_Percent, @RAMFreeGB, @TotalRAMGB, @LastBoot);
"@

        $connection = New-Object System.Data.SqlClient.SqlConnection $connString
        $command = $connection.CreateCommand()
        $command.CommandText = $insertServerQuery
        $command.Parameters.AddWithValue("@Hostname",    $data.Hostname)    | Out-Null
        $command.Parameters.AddWithValue("@CaptureTime", $data.CaptureTime) | Out-Null
        $command.Parameters.AddWithValue("@CPU_Percent", $data.CPU)         | Out-Null
        $command.Parameters.AddWithValue("@RAMFreeGB",   $data.RAMFreeGB)   | Out-Null
        $command.Parameters.AddWithValue("@TotalRAMGB",  $data.TotalRAMGB)  | Out-Null
        $command.Parameters.AddWithValue("@LastBoot",    $data.LastBoot)    | Out-Null
        $connection.Open()
        $serverID = $command.ExecuteScalar()
        $connection.Close()

        # Add all disks for this server ID
        foreach ($d in $data.Disks) {
            $diskRow = $diskTable.NewRow()
            $diskRow.ServerStatusID = $serverID
            $diskRow.DeviceID       = $d.DeviceID
            $diskRow.FreeGB         = $d.FreeGB
            $diskRow.SizeGB         = $d.SizeGB
            $diskTable.Rows.Add($diskRow)
        }

    }
    catch {
        Write-Warning "Failed to collect data from $server : $_"
    }
}

# ===============================================
# BULK INSERT DISKS DIRECTLY
# ===============================================
if ($diskTable.Rows.Count -gt 0) {
    BulkInsert -DataTable $diskTable -DestinationTable "DiskStatus"
    Write-Host "insert to disk."
}

Write-Host "✅ Data collection and DB insert completed successfully."