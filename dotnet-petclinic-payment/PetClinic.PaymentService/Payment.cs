using Amazon.DynamoDBv2.DataModel;

namespace PetClinic.PaymentService;

[DynamoDBTable("PetClinicPayment")]
public record Payment
{
    [DynamoDBHashKey]
    [DynamoDBProperty("id")]
    public required string Id { get; set; }

    [DynamoDBProperty]
    public required string PetId { get; set; }

    [DynamoDBProperty]
    public required DateTime PaymentDate { get; set; }

    [DynamoDBProperty]
    public required double Amount { get; set; }
}