# ===============================================
# CONFIGURATION
# ===============================================
$serversList  = "C:\Share_Details\ServerList.txt"
$dbServer     = "castel"
$databaseName = "InfraMonitorDB"
$username     = "monitor"
$password     = "NewPass123"
$servers = Get-Content $serversList
$jobs = @()

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
        # Generate unique BatchID for this server
        $batchID = [guid]::NewGuid()

        # Add to server stage collection
        $ServerStageRows.Add([PSCustomObject]@{
            BatchID     = $batchID
            Hostname    = $newPoint.Hostname
            CaptureTime = $newPoint.CaptureTime
            CPU_Percent = $newPoint.CPU_Percent
            RAMFreeGB   = $newPoint.RAMFreeGB
            TotalRAMGB  = $newPoint.TotalRAMGB
            LastBoot    = $newPoint.LastBoot
        })

        # Add each disk to disk stage collection
        foreach ($disk in $newPoint.Disks) {
            $DiskStageRows.Add([PSCustomObject]@{
                BatchID  = $batchID
                DeviceID = $disk.DeviceID
                FreeGB   = $disk.FreeGB
                SizeGB   = $disk.SizeGB
            })
        }
        Write-Host "✅ Inserted data for $server"

    } catch {
        Write-Host "❌ Failed for $server : $_"
    }
}

# ===============================================
# 2. Bulk Insert into Stage Tables
# ===============================================
$connection = New-Object System.Data.SqlClient.SqlConnection $connectionString
$connection.Open()



# ---- Insert ServerStatus_Stage ----
foreach ($row in $ServerStageRows) {
    $query = "INSERT INTO dbo.ServerStatus_Stage (BatchID, Hostname, CaptureTime, CPU_Percent, RAMFreeGB, TotalRAMGB, LastBoot)
              VALUES (@BatchID, @Hostname, @CaptureTime, @CPU_Percent, @RAMFreeGB, @TotalRAMGB, @LastBoot)"

    $command = $connection.CreateCommand()
    $command.CommandText = $query

    $command.Parameters.AddWithValue("@BatchID", $row.BatchID) | Out-Null
    $command.Parameters.AddWithValue("@Hostname", $row.Hostname) | Out-Null
    $command.Parameters.AddWithValue("@CaptureTime", $row.CaptureTime) | Out-Null
    $command.Parameters.AddWithValue("@CPU_Percent", $row.CPU_Percent) | Out-Null
    $command.Parameters.AddWithValue("@RAMFreeGB", $row.RAMFreeGB) | Out-Null
    $command.Parameters.AddWithValue("@TotalRAMGB", $row.TotalRAMGB) | Out-Null
    $command.Parameters.AddWithValue("@LastBoot", $row.LastBoot) | Out-Null


    $command.ExecuteNonQuery() | Out-Null
}

# ---- Insert DiskStatus_Stage ----
foreach ($row in $DiskStageRows) {
    $queryDisk = "INSERT INTO dbo.DiskStatus_Stage (BatchID, DeviceID, FreeGB, SizeGB)
              VALUES (@BatchID, @DeviceID, @FreeGB, @SizeGB)"

    $command = $connection.CreateCommand()
    $command.CommandText = $queryDisk

    $command.Parameters.AddWithValue("@BatchID", $row.BatchID) | Out-Null
    $command.Parameters.AddWithValue("@DeviceID", $row.DeviceID) | Out-Null
    $command.Parameters.AddWithValue("@FreeGB", $row.FreeGB) | Out-Null
    $command.Parameters.AddWithValue("@SizeGB", $row.SizeGB) | Out-Null

    $command.ExecuteNonQuery() | Out-Null

}

# ===============================================
# 3. Call Merge Procedure
# ===============================================
$mergeCmd = $connection.CreateCommand()
$mergeCmd.CommandText = "EXEC dbo.MergeServerAndDiskData"
$mergeCmd.ExecuteNonQuery() | Out-Null


$connection.Close()

Write-Host "🚀 Insert + Merge Complete: $($ServerStageRows.Count) servers, $($DiskStageRows.Count) disks."