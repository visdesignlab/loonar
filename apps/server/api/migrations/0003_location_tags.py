# Generated by Django 5.0.6 on 2024-09-27 01:11

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_experiment_composite_tabular_data_file_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='location',
            name='tags',
            field=models.JSONField(default={}),
        ),
    ]