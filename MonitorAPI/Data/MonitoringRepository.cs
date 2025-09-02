using Microsoft.Data.SqlClient;
using MonitorAPI.Models;

namespace MonitorAPI.Data;

public class MonitoringRepository
{
    private readonly string _connectionString;

    public MonitoringRepository(string connectionString)
    {
        _connectionString = connectionString;
    }

    public async Task<List<ServerStatusModel>> GetMonitoringDataAsync()
    {
        var results = new Dictionary<int, ServerStatusModel>();

        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        var sql = @"
            SELECT 
                s.ID AS ServerID,
                s.Hostname,
                s.CaptureTime,
                s.CPU_Percent,
                s.RAMFreeGB,
                s.TotalRAMGB,
                s.LastBoot,
                d.DeviceID,
                d.FreeGB,
                d.SizeGB
            FROM ServerStatus s
            LEFT JOIN DiskStatus d ON s.ID = d.ServerStatusID
            ORDER BY s.CaptureTime ASC;";

        using var cmd = new SqlCommand(sql, conn);
        using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            int serverId = Convert.ToInt32(reader["ServerID"]);

            if (!results.ContainsKey(serverId))
            {
                results[serverId] = new ServerStatusModel
                {
                    Hostname = reader["Hostname"] as string,
                    CaptureTime = reader["CaptureTime"] as DateTime?,
                    CPU_Percent = reader["CPU_Percent"] as double?,
                    RAMFreeGB = reader["RAMFreeGB"] as double?,
                    TotalRAMGB = reader["TotalRAMGB"] as double?,
                    LastBoot = reader["LastBoot"] as DateTime?,
                    Disks = new List<DiskStatusModel>()
                };
            }

            if (!(reader["DeviceID"] is DBNull))
            {
                results[serverId].Disks.Add(new DiskStatusModel
                {
                    DeviceID = reader["DeviceID"] as string,
                    FreeGB = reader["FreeGB"] as double?,
                    SizeGB = reader["SizeGB"] as double?
                });
            }
        }

        return results.Values.ToList();
    }
}