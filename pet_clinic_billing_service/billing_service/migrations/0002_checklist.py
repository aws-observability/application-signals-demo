# Generated by Django 4.2.16 on 2024-11-07 22:51

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('billing_service', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='CheckList',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('invalid_name', models.CharField(max_length=200)),
            ],
            options={
                'db_table': 'check_list',
            },
        ),
    ]
