using System.Text.RegularExpressions;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DataModel;
using Amazon.DynamoDBv2.Model;
using Steeltoe.Common.Discovery;
using Steeltoe.Discovery;

namespace PetClinic.PaymentService;

public interface IPetClinicContext
{
    HttpClient HttpClient { get; }
    IDynamoDBContext DynamoDbContext { get; }
    public Task InitializeDB();

    public Task CleanDB();
}

public class PetClinicContext(
    IDynamoDBContext dynamoDbContext,
    IAmazonDynamoDB amazonDynamoDB,
    IDiscoveryClient client,
    ILogger<PetClinicContext> logger) : IPetClinicContext
{
    public HttpClient HttpClient { get; } = new HttpClient(new DiscoveryHttpClientHandler(client), false);
    public IDynamoDBContext DynamoDbContext { get; set; } = dynamoDbContext;
    public ILogger<PetClinicContext> Logger { get; } = logger;
    public IAmazonDynamoDB AmazonDynamoDBClient { get; } = amazonDynamoDB;

    public async Task InitializeDB()
    {
        Logger.LogInformation("Initializing DynamoDB Table");

        try
        {
            //Check if DynamoDB Table exists
            await AmazonDynamoDBClient.DescribeTableAsync(new DescribeTableRequest { TableName = "PetClinicPayment" });
            Logger.LogInformation("DynamoDB Table exists");
        }
        catch (ResourceNotFoundException ex)
        {
            string pattern = @"Requested resource not found: Table:\s*(\w+)";

            Match match = Regex.Match(ex.Message, pattern);

            if ((ex.ErrorCode == "ResourceNotFoundException" || ex.StatusCode == System.Net.HttpStatusCode.BadRequest) && match.Success)
            {
                Logger.LogError(ex, "DynamoDB Table does not exist");
                string tableName = "PetClinicPayment";
                Logger.LogInformation("Creating DynamoDB Table: {tableName}", tableName);

                //Create DynamoDb Table
                var response = await this.AmazonDynamoDBClient.CreateTableAsync(new CreateTableRequest
                {
                    TableName = tableName,
                    ProvisionedThroughput = new()
                    {
                        ReadCapacityUnits = 5,
                        WriteCapacityUnits = 5
                    },
                    KeySchema =
                    [
                        new() {
                            AttributeName = "id",
                            KeyType = KeyType.HASH
                        }
                    ],
                    AttributeDefinitions =
                    [
                        new() {
                            AttributeName = "id",
                            AttributeType = ScalarAttributeType.S
                        }
                    ]
                });

                //check if the table is active
                var tableDescription = response.TableDescription;
                Logger.LogInformation("Table Status: {status}", tableDescription.TableStatus);
                string tableStatus = tableDescription.TableStatus;
                int i = 0;
                while (tableStatus != TableStatus.ACTIVE)
                {
                    await Task.Delay(5000);
                    var responseDescibre = await AmazonDynamoDBClient.DescribeTableAsync(new DescribeTableRequest
                    {
                        TableName = tableName
                    });

                    tableStatus = responseDescibre.Table.TableStatus;
                    i++;
                    if (i > 10)
                    {
                        throw new Exception("Table status not active within the specified time");
                    }
                }

                Logger.LogInformation("DynamoDB Table Status is now: {status}", tableStatus);
            }
        }

    }

    public async Task CleanDB()
    {
        try
        {
            if (Attribute.GetCustomAttribute(typeof(Payment), typeof(DynamoDBTableAttribute)) is DynamoDBTableAttribute att)
            {
                var request = new DeleteTableRequest
                {
                    TableName = att.TableName
                };
                await AmazonDynamoDBClient.DeleteTableAsync(request);

                try
                {
                    while (true)
                    {
                        await Task.Delay(5000);
                        await AmazonDynamoDBClient.DescribeTableAsync(new DescribeTableRequest { TableName = "PetClinicPayment" });
                    }
                }
                catch (ResourceNotFoundException)
                {
                    await InitializeDB();
                }
            }
        }
        catch (System.Exception ex)
        {
            Logger.LogError(ex, "Error cleaning DynamoDB");
        }
    }
}