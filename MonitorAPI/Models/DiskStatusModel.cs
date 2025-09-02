namespace MonitorAPI.Models;

public class DiskStatusModel
{
    public string? DeviceID { get; set; }
    public double? FreeGB { get; set; }
    public double? SizeGB { get; set; }
}