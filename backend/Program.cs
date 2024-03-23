using backend;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Npgsql;

#if DEBUG
Env.TraversePath().Load();
#else
Env.Load();
#endif

var builder = WebApplication.CreateBuilder(args);

var connectionString = new NpgsqlConnectionStringBuilder
{
    Host = Env.GetString("DB_HOST"),
    Port = Env.GetInt("DB_PORT"),
    Database = Env.GetString("DB_NAME"),
    Username = Env.GetString("DB_USER"),
    Password = Env.GetString("DB_PASSWORD"),
}.ConnectionString;

// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddDbContext<AppDbContext>(
    options => options
        .UseNpgsql(connectionString)
        .LogTo(Console.WriteLine, LogLevel.Information)
        .EnableSensitiveDataLogging()
        .EnableDetailedErrors()
);

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = $"{Env.GetString("REDIS_HOST")}:{Env.GetInt("REDIS_PORT")}";
    options.InstanceName = Env.GetString("REDIS_NAME");
});

builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseRouting();

app.UseSession();

app.MapControllers();

app.Run();
