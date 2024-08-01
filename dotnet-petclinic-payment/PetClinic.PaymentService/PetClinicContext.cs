using Amazon.DynamoDBv2.DataModel;
using Steeltoe.Common.Discovery;
using Steeltoe.Discovery;

namespace PetClinic.PaymentService;

public interface IPetClinicContext
{
    HttpClient HttpClient { get; }
    IDynamoDBContext DynamoDbContext { get; }
}

public class PetClinicContext(
        IDynamoDBContext dynamoDbContext,
        IDiscoveryClient client) : IPetClinicContext
{
    public HttpClient HttpClient { get; private set; } = new HttpClient(new DiscoveryHttpClientHandler(client), false);
    public IDynamoDBContext DynamoDbContext { get; private set; } = dynamoDbContext;
}