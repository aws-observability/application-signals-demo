using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DataModel;
using Microsoft.AspNetCore.Mvc;
using PetClinic.PaymentService;
using Steeltoe.Discovery.Client;
using Amazon.SQS;
using Amazon.SQS.Model;
using System.Diagnostics;
using System.Runtime.CompilerServices;

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
builder.Services.AddAWSService<IAmazonSQS>();
builder.Services.AddSingleton<IDynamoDBContext, DynamoDBContext>();
builder.Services.AddSingleton<IPetClinicContext, PetClinicContext>();

builder.Services.AddDiscoveryClient();
builder.Services.AddHealthChecks();

var app = builder.Build();

// Utility method to add code location attributes to the current activity
static void AddCodeLocationAttributes([CallerFilePath] string filePath = "", [CallerLineNumber] int lineNumber = 0, [CallerMemberName] string memberName = "")
{
    Activity currentActivity = Activity.Current;
    if (currentActivity != null)
    {
        // Use OpenTelemetry semantic convention attribute names
        currentActivity.SetTag("code.file.path", Path.GetFileName(filePath));
        currentActivity.SetTag("code.line.number", lineNumber);
        currentActivity.SetTag("code.function.name", $"PetClinic.PaymentService.Program.{memberName}");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHealthChecks("/healthz");

app.MapGet("/owners/{ownerId:int}/pets/{petId:int}/payments",
    async (
        int ownerId,
        int petId,
        [FromServices] IPetClinicContext context) =>
    {
        AddCodeLocationAttributes();
        Activity currentActivity = Activity.Current;
        if (currentActivity != null)
        {
            currentActivity.SetTag("owner.id", ownerId);
            currentActivity.SetTag("pet.id", petId);
        }

        var petResponse = await context.HttpClient.GetAsync($"http://customers-service/owners/{ownerId}/pets/{petId}");

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

        return Results.Ok(payments.Where(x => x.PetId == petId).ToList());
    }
);

app.MapGet("/owners/{ownerId:int}/pets/{petId:int}/payments/{paymentId}",
    async (
        int ownerId,
        int petId,
        string paymentId,
        [FromServices] IPetClinicContext context) =>
    {
        AddCodeLocationAttributes();
        Activity currentActivity = Activity.Current;
        if (currentActivity != null)
        {
            currentActivity.SetTag("owner.id", ownerId);
            currentActivity.SetTag("pet.id", petId);
            currentActivity.SetTag("order.id", paymentId);
        }

        var petResponse = await context.HttpClient.GetAsync($"http://customers-service/owners/{ownerId}/pets/{petId}");

        if (!petResponse.IsSuccessStatusCode)
        {
            return Results.BadRequest();
        }

        var payment = await context.DynamoDbContext.LoadAsync<Payment>(paymentId);

        return payment == null ? Results.NotFound() : Results.Ok(payment);
    }
);

app.MapPost("/owners/{ownerId:int}/pets/{petId:int}/payments/",
    async (
        int ownerId,
        int petId,
        Payment payment,
       [FromServices] IPetClinicContext context) =>
    {
        AddCodeLocationAttributes();
        payment.Id ??= Random.Shared.Next(100000, 1000000).ToString();

        Activity currentActivity = Activity.Current;
        if (currentActivity != null)
        {
            currentActivity.SetTag("owner.id", ownerId);
            currentActivity.SetTag("pet.id", petId);
            currentActivity.SetTag("order.id", payment.Id);
        }

        var queueName = "audit-jobs";
        var queueUrl = "";
        try
        {
            var request = new GetQueueUrlRequest { QueueName = queueName };
            var response = await context.SqsClient.GetQueueUrlAsync(request);
            queueUrl = response.QueueUrl;
        }
        catch (QueueDoesNotExistException)
        {
            Console.WriteLine($"Queue {queueName} does not exist.");
            return null;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting queue URL: {ex.Message}");
            return null;
        }

        var messageBody = System.Text.Json.JsonSerializer.Serialize(new
        {
            PaymentId = payment.Id,
            OwnerId = ownerId,
            PetId = petId,
            Amount = payment.Amount
        });

        var sendMessageRequest = new SendMessageRequest
        {
            QueueUrl = queueUrl,
            MessageBody = messageBody
        };

        try
        {
            var sendMessageResponse = await context.SqsClient.SendMessageAsync(sendMessageRequest);
            if (currentActivity != null)
            {
                currentActivity.SetTag("sqs.message.id", sendMessageResponse.MessageId);
            }
            Console.WriteLine($"Message sent to SQS. MessageId: {sendMessageResponse.MessageId}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error sending message to SQS: {ex.Message}");
        }

        var petResponse = await context.HttpClient.GetAsync($"http://customers-service/owners/{ownerId}/pets/{petId}");

        if (!petResponse.IsSuccessStatusCode)
        {
            return Results.BadRequest();
        }

        payment.PetId = petId;

        await context.DynamoDbContext.SaveAsync(payment);

        return Results.Ok(payment);
    }
);

app.MapDelete("/clean-db", async ([FromServices] IPetClinicContext context) =>
{
    AddCodeLocationAttributes();
    await context.CleanDB();

    return Results.Ok();
});

await InitializeDB();

await app.RunAsync();

async Task InitializeDB()
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<IPetClinicContext>();
    await context.InitializeDB();
}
