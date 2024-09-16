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
from .models import LoonUpload, Location, Experiment
from django.core.files.base import ContentFile  # type: ignore
import csv
import tempfile
import io
import os


def field_value_object_key(serializer: serializers.Serializer) -> Optional[str]:
    try:
        field_value = serializer.validated_data['field_value']
        field_value_dict: Dict = signing.loads(field_value)
        object_key = field_value_dict['object_key']
    except signing.BadSignature:
        return None

    return object_key


def create_composite_tabular_data_file(experiment_name: str, experiment_settings: list) -> str:
    composite_tabular_data_file_name = f"{experiment_name}/composite_tabular_data.csv"

    # Step 1: Create a temporary file
    with tempfile.NamedTemporaryFile(mode='w+', newline='', delete=False) as temp_file:
        temp_file_name = temp_file.name

        for idx, entry in enumerate(experiment_settings):
            curr_tabular_data_file = entry['tabularDataFilename']
            with default_storage.open(curr_tabular_data_file, 'rb') as curr_source_file:
                text_stream = io.TextIOWrapper(curr_source_file, encoding='utf-8')
                csv_reader = csv.reader(text_stream, delimiter=',')
                csv_writer = csv.writer(temp_file, delimiter=',')

                # Assuming first line is always a header
                for row_idx, row in enumerate(csv_reader):
                    if row_idx == 0:
                        if idx == 0:
                            row.insert(0, "Location")
                            csv_writer.writerow(row)
                    else:
                        row.insert(0, entry["id"])
                        csv_writer.writerow(row)

    # Step 4: Upload the temporary file back to default storage
    with open(temp_file_name, 'rb') as final_file:
        # Save the temp file in default storage
        default_storage.save(composite_tabular_data_file_name, final_file)

    # Clean up the temp file from local disk
    os.remove(temp_file_name)

    return composite_tabular_data_file_name


InvalidFieldValueResponse = Response(
    {'field_value': ['field_value is not a valid signed string.']},
    status=status.HTTP_400_BAD_REQUEST,
)


# Called on each individual upload
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

        if result.ready():
            return_value = result.get()
            response_data['data'] = return_value

        return Response(response_data)


# Called once all processing steps have finished and all data has been uploaded.
class FinishExperimentView(APIView):
    def post(self, request):
        data = request.data
        experiment_settings = json.loads(data.get('experimentSettings'))
        experiment_headers = json.loads(data.get('experimentHeaders'))
        experiment_header_transforms = json.loads(data.get('experimentHeaderTransforms'))

        experiment_name = data.get('experimentName')

        composite_tabular_data_file_name = create_composite_tabular_data_file(
            experiment_name, experiment_settings
            )

        experiment_data = {
            "name": experiment_name,
            "headers": "|".join(experiment_headers),
            "number_of_locations": len(experiment_settings),
            "composite_tabular_data_file_name": composite_tabular_data_file_name,
            "header_transforms": experiment_header_transforms
        }

        experiment_serializer = ExperimentCreateSerializer(data=experiment_data)
        if not experiment_serializer.is_valid():
            print(experiment_serializer.errors, flush=True)
        experiment_serializer.is_valid(raise_exception=True)

        experiment_instance = experiment_serializer.save()

        # Create individual Location table entries
        for i in range(len(experiment_settings)):
            location_data = {
                "name": experiment_settings[i]['id'],
                "tabular_data_filename": experiment_settings[i]['tabularDataFilename'],
                "images_data_filename": experiment_settings[i]['imageDataFilename'],
                "segmentations_folder": experiment_settings[i]['segmentationsFolder'],
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

        experiment_names = [name + '.json' for name in
                            Experiment.objects.values_list('name', flat=True)]

        index_file = {"experiments": experiment_names}
        json_index_file = json.dumps(index_file, indent=4)
        json_index_file_bytes = json_index_file.encode('utf-8')

        index_file_name = 'aa_index.json'

        if default_storage.exists(index_file_name):
            default_storage.delete(index_file_name)

        default_storage.save(index_file_name, ContentFile(json_index_file_bytes))

        return Response({'status': 'SUCCESS'})


class VerifyExperimentNameView(APIView):
    def get(self, request, experiment_name):

        '''
        Leaving both checks in here. I do not think checking 'aa_index.json' is necessary
        when Loon is fully developed, but for now, I would like to discourage the re-use
        of any experiment even if the original data is deleted.
        '''

        def strip_json(s):
            if s.endswith('.json'):
                return s[:-5]
            return s

        experiment_name = strip_json(experiment_name)

        # Checks aa_index.json file
        with default_storage.open('aa_index.json', 'r') as file:
            content = file.read()

        experiment_list = json.loads(content)['experiments']

        experiment_list_stripped = [strip_json(element) for element in experiment_list]

        if experiment_name in experiment_list_stripped:
            return Response({'status': 'FAILED'})

        # Checks directories
        subdirs, files = default_storage.listdir('')

        if experiment_name in subdirs:
            return Response({'status': 'FAILED'})

        # Checks experiment table
        exists = Experiment.objects.filter(name=experiment_name).exists()
        if exists:
            return Response({'status': 'FAILED'})

        return Response({'status': 'SUCCESS'})
