using Microsoft.AspNetCore.Mvc;
using MonitorAPI.Data;

namespace MonitorAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MonitorController : ControllerBase
{
    private readonly MonitoringRepository _repository;

    public MonitorController(MonitoringRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public async Task<IActionResult> GetData()
    {
        var data = await _repository.GetMonitoringDataAsync();
        return Ok(data);
    }
}