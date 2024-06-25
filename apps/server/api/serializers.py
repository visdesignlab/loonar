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


class ExperimentCreateSerializer(serializers.Serializer):
    locations = serializers.StringRelatedField(many=True, required=False)

    class Meta:
        model = Experiment
        fields = "__all__"

    def create(self, validated_data):
        return Experiment.objects.create(**validated_data)

    name = serializers.CharField()
    header_time = serializers.CharField()
    header_frame = serializers.CharField()
    header_id = serializers.CharField()
    header_parent = serializers.CharField()
    header_mass = serializers.CharField()
    header_x = serializers.CharField()
    header_y = serializers.CharField()
    number_of_locations = serializers.IntegerField()


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
