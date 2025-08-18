# ===============================================
# CONFIGURATION
# ===============================================
$serversList  = "C:\Share_Details\ServerList.txt"
$dbServer     = "castel"
$databaseName = "InfraMonitorDB"
$username     = "monitor"
$password     = "NewPass123"
$servers = Get-Content $serversList

$connectionString = "Data Source=$dbServer;Database=$databaseName;User ID=$username;Password=$password;TrustServerCertificate=True;"

Add-Type -AssemblyName "System.Data"

# ===============================================
# COLLECTIONS
# ===============================================
$ServerStageRows = New-Object System.Collections.Generic.List[Object]
$DiskStageRows   = New-Object System.Collections.Generic.List[Object]

# ===============================================
# 1. COLLECT DATA FROM ALL SERVERS
# ===============================================
foreach ($server in $servers) {
    try {
        $newPoint = Invoke-Command -ComputerName $server -ScriptBlock {
            $cpu = (Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 2 |
                   Select-Object -ExpandProperty CounterSamples |
                   Measure-Object -Property CookedValue -Average).Average

            $os = Get-CimInstance Win32_OperatingSystem
            $comp = Get-CimInstance Win32_ComputerSystem
            $boot = $os.LastBootUpTime

            [PSCustomObject]@{
                Hostname    = $env:COMPUTERNAME
                CaptureTime = (Get-Date)
                CPU_Percent = [math]::Round($cpu,2)
                RAMFreeGB   = [math]::Round($os.FreePhysicalMemory/1MB,2)
                TotalRAMGB  = [math]::Round($comp.TotalPhysicalMemory/1GB,2)
                LastBoot    = $boot
                Disks       = (Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
                ForEach-Object {
                    [PSCustomObject]@{
                        DeviceID = $_.DeviceID
                        FreeGB   = [math]::Round($_.FreeSpace/1GB,2)
                        SizeGB   = [math]::Round($_.Size/1GB,2)
                    }
                })
            }
        }

        # Generate unique BatchID per server
        $batchID = [guid]::NewGuid()

        # Add server row
        $ServerStageRows.Add([PSCustomObject]@{
            BatchID     = $batchID
            Hostname    = $newPoint.Hostname
            CaptureTime = $newPoint.CaptureTime
            CPU_Percent = $newPoint.CPU_Percent
            RAMFreeGB   = $newPoint.RAMFreeGB
            TotalRAMGB  = $newPoint.TotalRAMGB
            LastBoot    = $newPoint.LastBoot
        })

        # Add disk rows
        foreach ($disk in $newPoint.Disks) {
            $DiskStageRows.Add([PSCustomObject]@{
                BatchID  = $batchID
                DeviceID = $disk.DeviceID
                FreeGB   = $disk.FreeGB
                SizeGB   = $disk.SizeGB
            })
        }

        Write-Host "✅ Collected data for $server"

    } catch {
        Write-Host "❌ Failed for $server : $_"
    }
}

# ===============================================
# 2. PREPARE DATATABLES FOR BULK INSERT
# ===============================================

# --- CHANGED: Define explicit column types ---
$serverTable = New-Object System.Data.DataTable
$serverTable.Columns.Add("BatchID",     [System.Guid])     | Out-Null
$serverTable.Columns.Add("Hostname",    [System.String])   | Out-Null
$serverTable.Columns.Add("CaptureTime", [System.DateTime]) | Out-Null
$serverTable.Columns.Add("CPU_Percent", [System.Double])   | Out-Null
$serverTable.Columns.Add("RAMFreeGB",   [System.Double])   | Out-Null
$serverTable.Columns.Add("TotalRAMGB",  [System.Double])   | Out-Null
$serverTable.Columns.Add("LastBoot",    [System.DateTime]) | Out-Null

foreach ($row in $ServerStageRows) {
    $dr = $serverTable.NewRow()
    $dr.BatchID     = [guid]$row.BatchID
    $dr.Hostname    = [string]$row.Hostname
    $dr.CaptureTime = [datetime]$row.CaptureTime   # ✅ FIX
    $dr.CPU_Percent = [double]$row.CPU_Percent
    $dr.RAMFreeGB   = [double]$row.RAMFreeGB
    $dr.TotalRAMGB  = [double]$row.TotalRAMGB
    $dr.LastBoot    = [datetime]$row.LastBoot      # ✅ FIX
    $serverTable.Rows.Add($dr)
}

# --- CHANGED: Define explicit column types ---
$diskTable = New-Object System.Data.DataTable
$diskTable.Columns.Add("BatchID",  [System.Guid])   | Out-Null
$diskTable.Columns.Add("DeviceID", [System.String]) | Out-Null
$diskTable.Columns.Add("FreeGB",   [System.Double]) | Out-Null
$diskTable.Columns.Add("SizeGB",   [System.Double]) | Out-Null

foreach ($row in $DiskStageRows) {
    $dr = $diskTable.NewRow()
    $dr.BatchID  = [guid]$row.BatchID   # ✅ FIX ensure GUID
    $dr.DeviceID = [string]$row.DeviceID
    $dr.FreeGB   = [double]$row.FreeGB
    $dr.SizeGB   = [double]$row.SizeGB
    $diskTable.Rows.Add($dr)
}


# ===============================================
# 3. BULK INSERT INTO STAGE TABLES
# ===============================================
$connection = New-Object System.Data.SqlClient.SqlConnection $connectionString
$connection.Open()

$bulkServer = New-Object System.Data.SqlClient.SqlBulkCopy $connection
$bulkServer.DestinationTableName = 'dbo.ServerStatus_Stage'

# ✅ Explicit Column Mappings Added
$null = $bulkServer.ColumnMappings.Add("BatchID", "BatchID")
$null = $bulkServer.ColumnMappings.Add("Hostname", "Hostname")
$null = $bulkServer.ColumnMappings.Add("CaptureTime", "CaptureTime")
$null = $bulkServer.ColumnMappings.Add("CPU_Percent", "CPU_Percent")
$null = $bulkServer.ColumnMappings.Add("RAMFreeGB", "RAMFreeGB")
$null = $bulkServer.ColumnMappings.Add("TotalRAMGB", "TotalRAMGB")
$null = $bulkServer.ColumnMappings.Add("LastBoot", "LastBoot")

# 🔎 Debug: Preview Server Data
#Write-Host "`n🔎 Preview of ServerStage Data going into SQL:"
#$serverTable | Select-Object -First 5 | Format-Table -AutoSize

$bulkServer.WriteToServer($serverTable)
#Write-Host "✅ Bulk inserted $($serverTable.Rows.Count) rows into ServerStatus_Stage."


$bulkDisk = New-Object System.Data.SqlClient.SqlBulkCopy $connection
$bulkDisk.DestinationTableName = 'dbo.DiskStatus_Stage'

# ✅ Explicit Column Mappings Added
$null = $bulkDisk.ColumnMappings.Add("BatchID", "BatchID")
$null = $bulkDisk.ColumnMappings.Add("DeviceID", "DeviceID")
$null = $bulkDisk.ColumnMappings.Add("FreeGB", "FreeGB")
$null = $bulkDisk.ColumnMappings.Add("SizeGB", "SizeGB")

# 🔎 Debug: Preview Disk Data
#Write-Host "`n🔎 Preview of DiskStage Data going into SQL:"
#$diskTable | Select-Object -First 5 | Format-Table -AutoSize

$bulkDisk.WriteToServer($diskTable)
#Write-Host "✅ Bulk inserted $($diskTable.Rows.Count) rows into DiskStatus_Stage."

# ===============================================
# 4. CALL MERGE PROCEDURE
# ===============================================
$mergeCmd = $connection.CreateCommand()
$mergeCmd.CommandText = "EXEC dbo.MergeServerAndDiskData"
$mergeCmd.ExecuteNonQuery() | Out-Null

$connection.Close()

#Write-Host "🚀 Bulk Insert + Merge Complete: $($ServerStageRows.Count) servers, $($DiskStageRows.Count) disks."
