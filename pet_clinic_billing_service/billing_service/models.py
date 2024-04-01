from django.db import models

# Create your models here.
class Billing(models.Model):
    owner_id   = models.IntegerField()
    type = models.CharField(max_length=200)
    type_name = models.CharField(max_length=200)
    pet_id = models.IntegerField()
    payment = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20)

    class Meta:
        unique_together = ('owner_id', 'pet_id', 'type')

    def __str__(self):
        return self.owner_id