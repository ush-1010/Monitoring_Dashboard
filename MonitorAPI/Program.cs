using MonitorAPI.Data;

var builder = WebApplication.CreateBuilder(args);

// Register MonitoringRepository with the connection string from appsettings.json
builder.Services.AddScoped(sp =>
    new MonitoringRepository(builder.Configuration.GetConnectionString("DefaultConnection")!)
);

// Add controllers
builder.Services.AddControllers();

// Add Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Swagger UI
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
