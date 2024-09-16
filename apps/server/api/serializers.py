from rest_framework import serializers  # type: ignore
from .models import Experiment, LoonUpload, Location


class UploadCreateSerializer(serializers.Serializer):
    field_value = serializers.CharField()


class LoonUploadCreateSerializer(UploadCreateSerializer):
    class Meta:
        model = LoonUpload
        fields = "__all__"

    workflow_code = serializers.CharField()
    file_type = serializers.CharField()
    file_name = serializers.CharField()
    location = serializers.CharField()
    experiment_name = serializers.CharField()


class HeaderTransformSerializer(serializers.Serializer):
    time = serializers.CharField()
    frame = serializers.CharField()
    id = serializers.CharField()
    parent = serializers.CharField()
    mass = serializers.CharField()
    x = serializers.CharField()
    y = serializers.CharField()


class ExperimentCreateSerializer(serializers.Serializer):
    locations = serializers.StringRelatedField(many=True, required=False)
    header_transforms = HeaderTransformSerializer()

    class Meta:
        model = Experiment
        fields = [
            'name', 'headers', 'number_of_locations', 'header_transforms'
        ]

    def create(self, validated_data):
        header_transforms_data = validated_data.pop('header_transforms', {})

        # Strip unwanted characters from each header transform field
        cleaned_header_transforms = {
            'header_' + key: value.strip('\"') for key, value in header_transforms_data.items()
        }

        validated_data.update(cleaned_header_transforms)

        return Experiment.objects.create(**validated_data)

    name = serializers.CharField()
    headers = serializers.CharField()
    number_of_locations = serializers.IntegerField()
    composite_tabular_data_file_name = serializers.CharField()


class LocationCreateSerializer(serializers.Serializer):
    class Meta:
        model = Location
        fields = "__all__"

    def create(self, validated_data):
        return Location.objects.create(**validated_data)

    name = serializers.CharField()
    tabular_data_filename = serializers.CharField()
    images_data_filename = serializers.CharField()
    segmentations_folder = serializers.CharField()
