# Generated by Django 5.0.6 on 2024-06-11 16:31

import api.models
import s3_file_field.fields
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_rename_temp_file_path_loonupload_experiment_name_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='loonupload',
            name='blob',
            field=s3_file_field.fields.S3FileField(upload_to=api.models.LoonUpload.upload_path),
        ),
    ]
