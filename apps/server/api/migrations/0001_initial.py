# Generated by Django 5.0.6 on 2024-09-16 20:39

import api.models
import django.db.models.deletion
import s3_file_field.fields
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Experiment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('headers', models.TextField(default='')),
                ('header_time', models.CharField(max_length=255)),
                ('header_frame', models.CharField(max_length=255)),
                ('header_id', models.CharField(max_length=255)),
                ('header_parent', models.CharField(max_length=255)),
                ('header_mass', models.CharField(max_length=255)),
                ('header_x', models.CharField(max_length=255)),
                ('header_y', models.CharField(max_length=255)),
                ('number_of_locations', models.IntegerField())
            ],
        ),
        migrations.CreateModel(
            name='LoonUpload',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('workflow_code', models.CharField(choices=[('live_cyte', 'Live Cyte')], max_length=30)),
                ('file_type', models.CharField(choices=[('segmentations', 'Segmentations'), ('cell_images', 'Cell Images'), ('metadata', 'Metadata')], max_length=20)),
                ('file_name', models.CharField(max_length=255)),
                ('location', models.DecimalField(decimal_places=0, max_digits=5)),
                ('experiment_name', models.CharField(max_length=255)),
                ('blob', s3_file_field.fields.S3FileField(upload_to=api.models.LoonUpload.upload_path)),
            ],
        ),
        migrations.CreateModel(
            name='Location',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('tabular_data_filename', models.CharField(max_length=255)),
                ('images_data_filename', models.CharField(max_length=255)),
                ('segmentations_folder', models.CharField(max_length=255)),
                ('experiment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='locations', to='api.experiment')),
            ],
        ),
    ]