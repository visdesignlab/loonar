from rest_framework.views import APIView  # type: ignore
from rest_framework.response import Response  # type: ignore
from rest_framework import serializers, status  # type: ignore
from typing import Dict, Optional
import json
from django.core.files.storage import default_storage  # type: ignore
from .tasks import (
    FailedToCreateTaskException,
    execute_task
)
from celery.result import AsyncResult  # type: ignore
from django.core import signing  # type: ignore
from .serializers import (
    LoonUploadCreateSerializer,
    ExperimentCreateSerializer,
    LocationCreateSerializer
)
from .models import LoonUpload, Location
from django.core.files.base import ContentFile  # type: ignore


def field_value_object_key(serializer: serializers.Serializer) -> Optional[str]:
    try:
        field_value = serializer.validated_data['field_value']
        field_value_dict: Dict = signing.loads(field_value)
        object_key = field_value_dict['object_key']
    except signing.BadSignature:
        return None

    return object_key


InvalidFieldValueResponse = Response(
    {'field_value': ['field_value is not a valid signed string.']},
    status=status.HTTP_400_BAD_REQUEST,
)


class ProcessDataView(APIView):
    def post(self, request):
        serializer = LoonUploadCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # This gets the reference to the file in Minio
        object_key = field_value_object_key(serializer)
        if object_key is None:
            return InvalidFieldValueResponse

        loonUpload: LoonUpload = LoonUpload.objects.create(
            workflow_code=serializer.validated_data['workflow_code'],
            file_type=serializer.validated_data['file_type'],
            file_name=serializer.validated_data['file_name'],
            location=serializer.validated_data['location'],
            experiment_name=serializer.validated_data['experiment_name'],
            blob=object_key,
        )

        try:
            # Send task to celery worker
            task_result = execute_task.delay(loonUpload.pk)

            task_id = task_result.id

            # Return success
            return Response({"status": "SUCCESS",
                             "message": "task has been dispatched",
                             "task_id": task_id
                             })
        except FailedToCreateTaskException as e:
            # If failed to create task, return failure message.
            return Response({"status": "FAILED", "message": e.message})

    def get(self, request, task_id):
        result = AsyncResult(task_id)
        response_data = {
            "task_id": task_id
        }
        print(result.state, flush=True)
        if result.state == 'PENDING':
            response_data['status'] = 'QUEUED'
        elif result.state == 'STARTED':
            response_data['status'] = 'RUNNING'
        elif result.state == 'FAILURE':
            response_data['status'] = 'FAILED'
        elif result.state == 'SUCCESS':
            response_data['status'] = 'SUCCEEDED'
        else:
            response_data['status'] = 'ERROR'
            response_data['message'] = 'Unable to retrieve status'

        return Response(response_data)


class FinishExperimentView(APIView):
    def post(self, request):
        # Needs to append experiment
        # Needs to create experiment metadata file
        # Process the CSV file and grab the headers
        # Allow for UI to set values....???????
        data = request.data
        experiment_settings = json.loads(data.get('experimentSettings'))
        experiment_name = data.get('experimentName')
        experiment_data = {
            "name": experiment_name,
            "number_of_locations": len(experiment_settings),
            "header_time": "fake",
            "header_frame": "fake",
            "header_id": "fake",
            "header_parent": "fake",
            "header_mass": "fake",
            "header_x": "fake",
            "header_y": "fake"
        }
        experiment_serializer = ExperimentCreateSerializer(data=experiment_data)
        if not experiment_serializer.is_valid():
            print(experiment_serializer.errors, flush=True)
        experiment_serializer.is_valid(raise_exception=True)

        experiment_instance = experiment_serializer.save()

        for key in experiment_settings:
            location_data = {
                "name": experiment_settings[key]['id'],
                "tabular_data_filename": experiment_settings[key]['dataFrameFileName'],
                "images_data_filename": experiment_settings[key]['imageDataFileName'],
                "segmentations_folder": experiment_settings[key]['segmentationsFolder'],
            }
            location_serializer = LocationCreateSerializer(data=location_data)
            if not location_serializer.is_valid():
                print(location_serializer.errors, flush=True)

            location_serializer.is_valid(raise_exception=True)

            Location.objects.create(
                experiment=experiment_instance,
                **location_data
            )

        json_data = experiment_instance.to_json()
        json_string = json.dumps(json_data, indent=4)
        json_bytes = json_string.encode('utf-8')
        default_storage.save(f'{experiment_instance.name}.json', ContentFile(json_bytes))

        return Response({'status': 'fake_response'})
