from abc import abstractmethod, ABC
import zipfile
import logging
from celery import shared_task  # type: ignore
from .models import LoonUpload
from django.core.files.storage import default_storage  # type: ignore
from django.core.files.base import ContentFile  # type: ignore
import csv
import io
from .processing_callbacks.roi_to_geojson import roi_to_geojson

BAD_FILES = [".DS_Store", "__MACOSX"]

# Configure logging


# Creates a filter so that only manually added logging messages will pass to file handlers.
class RootOnlyFilter(logging.Filter):
    def filter(self, record):
        return record.name == "root"


logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

file_handler = logging.FileHandler("app.log")
file_handler.setLevel(logging.INFO)
file_formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
file_handler.setFormatter(file_formatter)

# Create a stream handler
stream_handler = logging.StreamHandler()
stream_handler.setLevel(logging.DEBUG)
stream_formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
stream_handler.setFormatter(stream_formatter)

# Apply the filter to both handlers
file_handler.addFilter(RootOnlyFilter())
stream_handler.addFilter(RootOnlyFilter())

# Add handlers to the root logger
logger.addHandler(file_handler)
logger.addHandler(stream_handler)


def _badFileChecker(file_name: str):
    for check_name in BAD_FILES:
        if check_name in file_name:
            return True
    return False


class FailedToCreateTaskException(Exception):
    """Exception raised when we fail to create a task."""

    def __init__(self, message="Failed to create task"):
        self.message = message
        super().__init__(self.message)


class CallbackException(Exception):
    def __init__(self, message="Failed to run callback."):
        self.message = message
        super().__init__(self.message)


class Task(ABC):
    def __str__(self):
        return f"\nFile name: {self.file_name}\nLocation: {self.location}\n" \
                f"Experiment Name: {self.experiment_name}\n" \
                f"Location Prefix: {self.location_prefix}"

    def __init__(self, **kwargs):
        try:
            self.file_name = kwargs["file_name"]
            self.location = kwargs["location"]
            self.experiment_name = kwargs["experiment_name"]
            self.blob = kwargs["blob"]
            self.record_id = kwargs["record_id"]
            self.location_prefix = f"location_{self.location}"
        except KeyError as e:
            raise FailedToCreateTaskException(f"Failed to create task:{e.message}")

    def cleanup_temp_files(self):
        # os.remove(self.temp_file_path)
        logger.info('Fake Cleaning')

    # Generic unpacking of a zip file with callback for additional processing.
    def process_zip_file(self,
                         base_file_location="",
                         callback=None,
                         base_file_location_suffix="",
                         task_instance=None
                         ):
        try:
            companion_ome = ""
            with zipfile.ZipFile(self.blob, 'r') as zip_ref:
                zip_contents = zip_ref.namelist()
                total = len(zip_contents)
                for i, curr_file_name in enumerate(zip_contents):
                    if not _badFileChecker(
                        curr_file_name
                    ):
                        if curr_file_name.endswith('.companion.ome'):
                            companion_ome = curr_file_name
                        file_contents = zip_ref.read(curr_file_name)
                        if file_contents:
                            # Removes all prefixes to the file from the zip
                            corrected_curr_file_name = curr_file_name.split("/")[-1]
                            if corrected_curr_file_name.endswith('.companion.ome'):
                                companion_ome = corrected_curr_file_name

                            if callback:
                                try:
                                    file_contents, corrected_curr_file_name = callback(
                                        file_contents, corrected_curr_file_name
                                    )
                                except CallbackException as e:
                                    return {
                                        "process_zip_file_status": "FAILED",
                                        "message": f"Failed at callback: {e.message}",
                                    }

                            file_location = f"{base_file_location}/{base_file_location_suffix}/" \
                                            f"{corrected_curr_file_name}"
                            # Create a ContentFile object with the file contents
                            content_file = ContentFile(file_contents)

                            # Set the size attribute explicitly (if possible)
                            try:
                                content_file.size = len(file_contents)
                            except AttributeError:
                                logger.info('Could not set file manually')
                                pass  # If setting size manually is not possible

                            default_storage.save(file_location, content_file)
                            if task_instance:
                                task_instance.update_state(
                                    state='STARTED',
                                    meta={
                                        'metadata': {
                                            'current': i, 'total': total
                                        }
                                    }
                                )

            return {
                    "processed_zip_file_status": "SUCCESS",
                    "base_file_location": base_file_location,
                    "companion_ome": companion_ome,
                    "metadata": {
                        "total": total,
                        "current": total
                        }
                    }

        except FileNotFoundError:
            return {"process_zip_file_status": "FAILED", "message": "Could not find file"}

    def process_csv_file(self, base_file_location="", skip_rows=0, delimiter=',', callback=None):

        with self.blob.open('rb') as file:
            text_stream = io.TextIOWrapper(file, encoding='utf-8')
            csv_reader = csv.reader(text_stream, delimiter=delimiter)
            column_names = []
            remaining_rows = []

            # Skip first N rows
            for idx, row in enumerate(csv_reader):
                if idx < skip_rows:
                    continue
                if idx == skip_rows:
                    column_names.append(row)
                remaining_rows.append(row)

            # Convert the remaining rows back to a CSV format
            output_stream = io.StringIO()
            csv_writer = csv.writer(output_stream, delimiter=delimiter)
            csv_writer.writerows(remaining_rows)
            output_content = output_stream.getvalue()
            output_bytes = output_content.encode('utf-8')

            file_name = f"{base_file_location}/" \
                f"{self.file_name}"

            # Callback
            if callback:
                try:
                    output_bytes, file_name = callback(
                        output_bytes, file_name
                    )
                except CallbackException as e:
                    return {
                        "process_zip_file_status": "FAILED",
                        "message": f"Failed at callback: {e.message}",
                    }

            default_storage.save(file_name, io.BytesIO(output_bytes))

            return {
                "processed_csv_file": "SUCCESS",
                "headers": column_names[0],
                "base_file_location": base_file_location
            }

    # Declare abstract execute method
    @abstractmethod
    def execute(self, task_instance=None):
        pass

    # Declare abstract cleanup method
    @abstractmethod
    def cleanup(self):
        pass

    # Method to initialize correct task dependent on the workflow_code and the workflow_file_type.
    @staticmethod
    def create_task(workflow_code, workflow_file_type, **kwargs):
        if workflow_code == "live_cyte":
            if workflow_file_type == "segmentations":
                logger.info("Got a segmentations task")
                return LiveCyteSegmentationsTask(**kwargs)
            elif workflow_file_type == "cell_images":
                logger.info("Got a cell_images task")
                return LiveCyteCellImagesTask(**kwargs)
            elif workflow_file_type == "metadata":
                logger.info("Got a metadata task")
                return LiveCyteMetadataTask(**kwargs)
            else:
                raise FailedToCreateTaskException(
                    f"Unknown task type {workflow_file_type} for workflow {workflow_code}"
                )


class LiveCyteSegmentationsTask(Task):
    def execute(self, task_instance=None):
        logger.info(f"Executing task: {self.record_id}")
        base_file_location = f"{self.experiment_name}/" \
                             f"location_{self.location}/" \
                             "segmentations"
        data = self.process_zip_file(
            base_file_location=base_file_location,
            callback=roi_to_geojson,
            base_file_location_suffix="cells",
            task_instance=task_instance
            )
        return data

    def cleanup(self):
        logger.info(f"Cleaning up task: {self.record_id}")
        self.cleanup_temp_files()


class LiveCyteCellImagesTask(Task):
    def execute(self, task_instance=None):
        logger.info(f"Executing task: {self.record_id}")
        base_file_location = f"{self.experiment_name}/" \
                             f"location_{self.location}/" \
                             "images"
        data = self.process_zip_file(
            base_file_location=base_file_location,
            callback=None,
            task_instance=task_instance
            )
        return data

    def cleanup(self):
        logger.info(f"Cleaning up task: {self.record_id}")
        self.cleanup_temp_files()


class LiveCyteMetadataTask(Task):
    def execute(self, task_instance=None):
        logger.info(f"Executing task: {self.record_id}")

        base_file_location = f"{self.experiment_name}/" \
            f"location_{self.location}"
        data = self.process_csv_file(base_file_location=base_file_location, skip_rows=1,
                                     callback=None)
        return data

    def cleanup(self):
        logger.info(f"Cleaning up task: {self.record_id}")
        self.cleanup_temp_files()


@shared_task(bind=True)
def execute_task(self, record_id):
    # Get entry from our SQL Table
    loonUpload: LoonUpload = LoonUpload.objects.get(id=record_id)
    # Create a task for this entry
    curr_task = Task.create_task(
        loonUpload.workflow_code,
        loonUpload.file_type,
        file_name=loonUpload.file_name,
        location=loonUpload.location,
        experiment_name=loonUpload.experiment_name,
        blob=loonUpload.blob,
        record_id=record_id
    )
    # Execute the task
    response_data = curr_task.execute(task_instance=self)
    # Perform cleanup
    curr_task.cleanup()

    return response_data
