namespace MonitorAPI.Models;

public class ServerStatusModel
{
    public string? Hostname { get; set; }
    public DateTime? CaptureTime { get; set; }
    public double? CPU_Percent { get; set; }
    public double? RAMFreeGB { get; set; }
    public double? TotalRAMGB { get; set; }
    public DateTime? LastBoot { get; set; }

    public List<DiskStatusModel> Disks { get; set; } = new();
}