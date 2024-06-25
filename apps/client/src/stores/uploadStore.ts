import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import {
    createLoonAxiosInstance,
    type ProcessResponseData,
    type StatusResponseData,
    type CreateExperimentResponseData,
} from '@/util/axios';

import type { ProgressRecord } from '@/components/upload/LoadingProgress.vue';

export interface LocationFiles {
    locationId: string;
    table: FileToUpload;
    images: FileToUpload;
    segmentations: FileToUpload;
}

export interface FileToUpload {
    file: File | null;
    checkForUpdates?: boolean;
    uploading: 0 | 1 | 2 | 3 | -1;
    processing: 0 | 1 | 2 | 3 | -1;
}

export interface LocationConfig {
    id: string;
    tabularDataFilename: string;
    imageDataFilename: string;
    segmentationsFolder: string;
}

export const useUploadStore = defineStore('uploadStore', () => {
    // const currBaseUrl = window.location.origin;

    const loonAxios = createLoonAxiosInstance({
        baseURL: `${window.location.origin}/api`,
    });

    const experimentName = ref<string>('');

    const locationFileList = ref<LocationFiles[]>([
        {
            locationId: '1',
            table: {
                file: null,
                checkForUpdates: true,
                uploading: 0,
                processing: 0,
            },
            images: {
                file: null,
                checkForUpdates: true,
                uploading: 0,
                processing: 0,
            },
            segmentations: {
                file: null,
                checkForUpdates: true,
                uploading: 0,
                processing: 0,
            },
        },
    ]);

    const experimentConfig = computed<LocationConfig[]>(() => {
        return locationFileList.value.map((locationFiles) => {
            // TODO: probably want relative paths (expname / locationId / filename)
            return {
                id: locationFiles.locationId,
                tabularDataFilename: locationFiles.table.file!.name,
                imageDataFilename: locationFiles.images.file!.name,
                segmentationsFolder: locationFiles.segmentations.file!.name,
            };
        });
    });

    const numberOfLocations = computed<number>(() => {
        return locationFileList.value.length;
    });

    function addLocation() {
        locationFileList.value.push({
            locationId: (locationFileList.value.length + 1).toString(),
            table: {
                file: null,
                checkForUpdates: true,
                uploading: 0,
                processing: 0,
            },
            images: {
                file: null,
                checkForUpdates: true,
                uploading: 0,
                processing: 0,
            },
            segmentations: {
                file: null,
                checkForUpdates: true,
                uploading: 0,
                processing: 0,
            },
        });
    }

    function removeLocation(index: number) {
        locationFileList.value.splice(index, 1);
    }

    function allFilesPopulated(): boolean {
        for (const locationFiles of locationFileList.value) {
            if (
                !locationFiles.table.file ||
                !locationFiles.images.file ||
                !locationFiles.segmentations.file
            ) {
                return false;
            }
        }
        return true;
    }

    const experimentCreated = ref(false);

    // Function to upload all necessary files in experiment.
    async function uploadAll() {
        console.log('upload all triggered');
        experimentCreated.value = true;
        for (let i = 0; i < locationFileList.value.length; i++) {
            const locationFiles = locationFileList.value[i];
            uploadFile(locationFiles.table, i, 'metadata');
            uploadFile(locationFiles.images, i, 'cell_images');
            uploadFile(locationFiles.segmentations, i, 'segmentations');
        }
    }

    async function uploadFile(
        fileToUpload: FileToUpload,
        locationIndex: number,
        fileType: 'metadata' | 'cell_images' | 'segmentations'
    ) {
        if (fileToUpload && fileToUpload.file && experimentName.value) {
            fileToUpload.uploading = 2;
            fileToUpload.processing = 0;

            try {
                const fieldValue = await loonAxios.upload(fileToUpload.file);

                fileToUpload.uploading = 3;
                fileToUpload.processing = 1;

                try {
                    const processResponse = await loonAxios.process(
                        fieldValue,
                        'live_cyte',
                        fileType,
                        fileToUpload.file.name,
                        locationIndex.toString(),
                        experimentName.value
                    );

                    const processResponseData: ProcessResponseData =
                        processResponse.data;
                    if (processResponseData.task_id) {
                        checkForUpdates(
                            processResponseData.task_id,
                            fileToUpload
                        );
                    }
                } catch (error) {
                    console.warn(
                        'There was an error with the processing endpoint'
                    );
                    fileToUpload.processing = -1;
                }
            } catch (error) {
                console.warn('There was an error uploading the file.');
                fileToUpload.uploading = -1;
                fileToUpload.processing = 0;
            }
        }
    }

    // Asynchronous function to continuously check for processing status
    // async function checkForUpdates(task_id: string, fileKey: string) {
    async function checkForUpdates(
        task_id: string,
        uploadingFile: FileToUpload
    ) {
        try {
            let updatesAvailable = false;
            while (!updatesAvailable) {
                // Make a request to your server to check for updates
                const response = await loonAxios.checkForUpdates(task_id);
                const responseData = response.data as StatusResponseData;

                if (responseData.status === 'SUCCEEDED') {
                    updatesAvailable = true;
                } else if (
                    responseData.status === 'FAILED' ||
                    responseData.status === 'ERROR'
                ) {
                    // show error/failure message
                    updatesAvailable = true;
                } else if (responseData.status === 'RUNNING') {
                    // show running symbol like it normally does
                    uploadingFile.processing = 2;
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                } else {
                    // show queued symbol
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            }
            uploadingFile.processing = 3;
        } catch (error) {
            console.error('Error checking for updates:', error);
            uploadingFile.processing = -1;
        }
    }

    const progressStatusList = computed(() => {
        const tableListIndex = 0;
        const imageListIndex = 1;
        const segmentationListIndex = 2;
        let keyList = ['Table', 'Images', 'Segmentations'];
        let progressResult: ProgressRecord[] = keyList.map((key) => {
            return {
                label: 'Uploading and Processing ' + key,
                progress: 0,
                subProgress: [],
            };
        });
        for (let i = 0; i < numberOfLocations.value; i++) {
            const locationFiles = locationFileList.value[i];
            addToSubProgressList(
                progressResult[tableListIndex].subProgress!,
                locationFiles.table,
                locationFiles.locationId
            );
            addToSubProgressList(
                progressResult[imageListIndex].subProgress!,
                locationFiles.images,
                locationFiles.locationId
            );
            addToSubProgressList(
                progressResult[segmentationListIndex].subProgress!,
                locationFiles.segmentations,
                locationFiles.locationId
            );
        }

        console.log('progressResult: ', progressResult);
        return progressResult;
    });

    function addToSubProgressList(
        subProgressList: ProgressRecord[],
        uploadingFile: FileToUpload,
        locationId: string
    ) {
        subProgressList.push({
            label: 'Uploading ' + locationId,
            progress: uploadingFile.uploading,
        });
        if (uploadingFile.checkForUpdates) {
            subProgressList.push({
                label: 'Processing ' + locationId,
                progress: uploadingFile.processing,
            });
        }
    }

    async function onSubmitExperiment(): Promise<CreateExperimentResponseData> {
        if (experimentName && experimentName.value) {
            const submitExperimentResponse = await loonAxios.createExperiment(
                experimentName.value,
                experimentConfig.value
            );

            const submitExperimentResponseData: CreateExperimentResponseData =
                submitExperimentResponse.data;

            return submitExperimentResponseData;
        }
        return {"status":"failed","message":"No experiment name given."}
    }

    return {
        experimentCreated,
        experimentName,
        numberOfLocations,
        locationFileList,
        allFilesPopulated,
        addLocation,
        removeLocation,
        uploadAll,
        progressStatusList,
        onSubmitExperiment,
    };
});
