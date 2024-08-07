using Amazon.DynamoDBv2.DataModel;

namespace PetClinic.PaymentService;

[DynamoDBTable("PetClinicPayment")]
public record Payment
{
    [DynamoDBHashKey]
    [DynamoDBProperty("id")]
    public string? Id { get; set; }

    [DynamoDBProperty]
    public int? PetId { get; set; }

    [DynamoDBProperty]
    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;

    [DynamoDBProperty]
    public required double Amount { get; set; }

    [DynamoDBProperty]
    public string? Notes { get; set; }
}