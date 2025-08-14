$serverName = "127.0.0.1"
$databaseName = "InfraMonitorDB"
$username = "monitor"
$password = "NewPass123"
$connectionString = "Data Source=$serverName;Initial Catalog=$databaseName;User ID=$username;Password=$password;TrustServerCertificate=True;"


$sqlConnection = New-Object System.Data.SqlClient.SqlConnection
$sqlConnection.ConnectionString = $connectionString

try {
    $sqlConnection.Open()
    Write-Host "Connection to database '$databaseName' on server '$serverName' successful."
}
catch {
    Write-Host "Connection failed: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    if ($sqlConnection.State -eq 'Open') {
        $sqlConnection.Close()
        Write-Host "Connection closed."
    }
}