# Generated by Django 5.0.6 on 2024-06-10 22:58

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_loonupload_remove_loonuploadtask_loontask_ptr_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='loonupload',
            old_name='temp_file_path',
            new_name='experiment_name',
        ),
        migrations.RemoveField(
            model_name='loonupload',
            name='unique_file_name',
        ),
    ]
