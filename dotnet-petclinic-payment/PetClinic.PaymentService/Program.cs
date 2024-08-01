using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DataModel;
using PetClinic.PaymentService;
using Steeltoe.Discovery.Client;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddJsonFile("appsettings.json")
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", true)
    .AddEnvironmentVariables();

builder.SetEurekaIps();

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDefaultAWSOptions(builder.Configuration.GetAWSOptions());
builder.Services.AddAWSService<IAmazonDynamoDB>();
builder.Services.AddSingleton<IDynamoDBContext, DynamoDBContext>();
builder.Services.AddSingleton<IPetClinicContext, PetClinicContext>();

builder.Services.AddDiscoveryClient();
builder.Services.AddHealthChecks();

var app = builder.Build();


// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseHealthChecks("/healthz");

app.MapGet("/owners/{ownerId:regex(^.*$)}/pets/{petId}/payments",
    async (
        string ownerId,
        string petId,
        IPetClinicContext context) =>
    {
        var petResponse = await context.HttpClient.GetAsync($"http:/customers-service/api/customer/owners/{ownerId}/pets/{petId}");

        if (!petResponse.IsSuccessStatusCode)
        {
            return Results.BadRequest();
        }

        var request = context.DynamoDbContext.ScanAsync<Payment>([]);

        var payments = new List<Payment>();

        do
        {
            var page = await request.GetNextSetAsync();
            payments.AddRange(page);
        } while (!request.IsDone);

        return Results.Ok(payments.Where(x => x.PetId == petId));
    }
);

app.MapGet("/owners/{ownerId:regex(^.*$)}/pets/{petId}/payments/{paymentId}",
    async (
        string ownerId,
        string petId,
        string paymentId,
        IPetClinicContext context) =>
    {
        var petResponse = await context.HttpClient.GetAsync($"http:/customers-service/api/customer/owners/{ownerId}/pets/{petId}");

        if (!petResponse.IsSuccessStatusCode)
        {
            return Results.BadRequest();
        }

        var payment = await context.DynamoDbContext.LoadAsync<Payment>(paymentId);

        return payment == null ? Results.NotFound() : Results.Ok(payment);
    }
);

app.MapPost("/owners/{ownerId:regex(^.*$)}/pets/{petId}/payments/",
    async (
        string ownerId,
        string petId,
        Payment payment,
        IPetClinicContext context) =>
    {
        var petResponse = await context.HttpClient.GetAsync($"http:/customers-service/api/customer/owners/{ownerId}/pets/{petId}");

        if (!petResponse.IsSuccessStatusCode)
        {
            return Results.BadRequest();
        }

        await context.DynamoDbContext.SaveAsync(payment);

        return Results.Created();
    }
);

await app.RunAsync();