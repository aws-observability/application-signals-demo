from django.db import models

# Create your models here.
class Insurance(models.Model):
    id   = models.IntegerField
    name = models.CharField(max_length=200)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return self.name

class PetInsurance(models.Model):
    id   = models.IntegerField
    pet_id   = models.IntegerField(unique=True)
    insurance_id = models.IntegerField()
    insurance_name = models.CharField(max_length=200)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return self.id