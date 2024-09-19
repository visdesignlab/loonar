import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import {
    createLoonAxiosInstance,
    type ProcessResponseData,
    type StatusResponseData,
    type CreateExperimentResponseData,
    type VerifyExperimentNameResponseData,
} from '@/util/axios';

import type { ProgressRecord } from '@/components/upload/LoadingProgress.vue';

export type progress =
    | 'failed'
    | 'not_started'
    | 'dispatched'
    | 'running'
    | 'succeeded';

export interface LocationFiles {
    locationId: string;
    table: FileToUpload;
    images: FileToUpload;
    segmentations: FileToUpload;
}

export interface FileToUpload {
    file: File | null;
    checkForUpdates?: boolean;
    uploading: progress;
    processing: progress;
    processedData?: Record<string, any>;
}

export interface LocationConfig {
    id: string;
    tabularDataFilename: string;
    imageDataFilename: string;
    segmentationsFolder: string;
}

export interface OverallProgress {
    status: -1 | 0 | 1 | 2; // Failed, not started, running, succeeded
    message?: string;
}

export interface WorkflowConfiguration {
    code: string;
    skip_lines: number;
}

type FileType = 'metadata' | 'cell_images' | 'segmentations';

const initialState = () => ({
    currentWorkflowConfig: ref<WorkflowConfiguration>({
        code: 'live_cyte',
        skip_lines: 1,
    }),
    experimentName: ref<string>(''),
    overallProgress: ref<OverallProgress>({
        status: 1,
    }),
    experimentCreated: ref(false),
    columnMappings: ref<Record<string, string> | null>(null),
    columnNames: ref<string[]>([]),
    step: ref<string>('metadata'),
    locationFileList: ref<LocationFiles[]>([
        {
            locationId: '1',
            table: {
                file: null,
                checkForUpdates: true,
                uploading: 'not_started',
                processing: 'not_started',
            },
            images: {
                file: null,
                checkForUpdates: true,
                uploading: 'not_started',
                processing: 'not_started',
            },
            segmentations: {
                file: null,
                checkForUpdates: true,
                uploading: 'not_started',
                processing: 'not_started',
            },
        },
    ]),
    experimentNameValid: ref<boolean>(true),
});

export const useUploadStore = defineStore('uploadStore', () => {
    // const currBaseUrl = window.location.origin;
    const loonAxios = createLoonAxiosInstance({
        baseURL: `${window.location.origin}/api`,
    });

    const {
        currentWorkflowConfig,
        experimentName,
        locationFileList,
        overallProgress,
        experimentCreated,
        columnMappings,
        columnNames,
        step,
        experimentNameValid,
    } = initialState();

    function resetState(): void {
        const newState = initialState();
        currentWorkflowConfig.value = newState.currentWorkflowConfig.value;
        currentWorkflowConfig.value = newState.currentWorkflowConfig.value;
        experimentName.value = newState.experimentName.value;
        locationFileList.value = newState.locationFileList.value;
        overallProgress.value = newState.overallProgress.value;
        experimentCreated.value = newState.experimentCreated.value;
        columnMappings.value = newState.columnMappings.value;
        columnNames.value = newState.columnNames.value;
        step.value = newState.step.value;
        experimentNameValid.value = newState.experimentNameValid.value;
    }

    async function verifyExperimentName(): Promise<boolean> {
        const verifyExperimentName = await loonAxios.verifyExperimentName(
            experimentName.value
        );

        const verifyExperimentNameData: VerifyExperimentNameResponseData =
            verifyExperimentName.data;
        if (verifyExperimentNameData.status === 'SUCCESS') {
            return true;
        }
        return false;
    }

    const experimentConfig = computed<LocationConfig[] | null>(() => {
        // Computes all values once all is processed. If any remain to be processed, return null instead.

        const locationConfig: LocationConfig[] = [];
        for (let i = 0; i < locationFileList.value.length; i++) {
            const locationFiles = locationFileList.value[i];
            if (
                locationFiles.images.processedData &&
                locationFiles.segmentations.processedData &&
                locationFiles.table.processedData
            ) {
                const imageDataFilename = `${locationFiles.images.processedData.base_file_location.replace(
                    /\/$/,
                    ''
                )}/${locationFiles.images.processedData.companion_ome}`;
                const segmentationsFolder =
                    `${locationFiles.segmentations.processedData.base_file_location}`.replace(
                        /\/$/,
                        ''
                    );
                const tabularDataFilename = `${locationFiles.table.processedData.base_file_location.replace(
                    /\/$/,
                    ''
                )}/${locationFiles.table.file!.name}`;
                locationConfig.push({
                    id: locationFiles.locationId,
                    tabularDataFilename,
                    imageDataFilename,
                    segmentationsFolder,
                });
            } else {
                return null;
            }
        }
        return locationConfig;
    });

    function _listsAreIdentical(arr1: string[], arr2: string[]): boolean {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }

    const experimentHeaders = computed<string[] | null>(() => {
        let prevHeaders: string[] | null = null;
        locationFileList.value.forEach((locationFile: LocationFiles) => {
            if (locationFile.table.processedData) {
                const currHeaders = locationFile.table.processedData.headers;
                if (prevHeaders) {
                    if (!_listsAreIdentical(currHeaders, prevHeaders)) {
                        return null;
                    }
                } else {
                    prevHeaders = currHeaders;
                }
            }
        });
        return prevHeaders;
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
                uploading: 'not_started',
                processing: 'not_started',
            },
            images: {
                file: null,
                checkForUpdates: true,
                uploading: 'not_started',
                processing: 'not_started',
            },
            segmentations: {
                file: null,
                checkForUpdates: true,
                uploading: 'not_started',
                processing: 'not_started',
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

    function locationIdsUnique(): boolean {
        const locationIds = new Set<string>();
        for (const locationFiles of locationFileList.value) {
            if (locationIds.has(locationFiles.locationId)) {
                return false;
            }
            locationIds.add(locationFiles.locationId);
        }
        return true;
    }

    // Function to upload all necessary files in experiment.
    async function uploadAll() {
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
        fileType: FileType
    ) {
        if (fileToUpload && fileToUpload.file && experimentName.value) {
            fileToUpload.uploading = 'running';
            fileToUpload.processing = 'not_started';

            try {
                const fieldValue = await loonAxios.upload(fileToUpload.file);

                fileToUpload.uploading = 'succeeded';
                fileToUpload.processing = 'dispatched';

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
                    if (
                        processResponseData.task_id &&
                        fileToUpload.checkForUpdates
                    ) {
                        checkForUpdates(
                            processResponseData.task_id,
                            fileToUpload
                        );
                    }
                } catch (error) {
                    console.warn(
                        'There was an error with the processing endpoint'
                    );
                    fileToUpload.processing = 'failed';
                }
            } catch (error) {
                console.warn('There was an error uploading the file.');
                fileToUpload.uploading = 'failed';
                fileToUpload.processing = 'not_started';
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
                    if (responseData.data) {
                        uploadingFile.processedData = responseData.data;
                    }
                    uploadingFile.processing = 'succeeded';
                } else if (
                    responseData.status === 'FAILED' ||
                    responseData.status === 'ERROR'
                ) {
                    // show error/failure message
                    updatesAvailable = true;
                    uploadingFile.processing = 'failed';
                } else if (responseData.status === 'RUNNING') {
                    // show running symbol like it normally does
                    uploadingFile.processing = 'running';
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                } else {
                    // show queued symbol
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
            uploadingFile.processing = 'failed';
        }
    }

    // --------------------------------------------------------
    // --------------------------------------------------------
    // --------------------------------------------------------

    const createExperimentProgress = ref<ProgressRecord>({
        label: 'Create Experiment',
        progress: 'not_started',
    });

    // Function to construct the Progress Status List
    function initializeProgressStatusList(): ProgressRecord[] {
        const keyList = ['Table', 'Images', 'Segmentations'];
        let currentProgressStatusList: ProgressRecord[] = keyList.map((key) => {
            return {
                label: 'Uploading and Processing ' + key,
                progress: 'not_started',
                subProgress: [],
            };
        });
        const tableListIndex = 0;
        const imageListIndex = 1;
        const segmentationListIndex = 2;
        for (let i = 0; i < numberOfLocations.value; i++) {
            const locationFiles = locationFileList.value[i];
            addToSubProgressList(
                currentProgressStatusList[tableListIndex].subProgress!,
                locationFiles.table,
                locationFiles.locationId
            );
            addToSubProgressList(
                currentProgressStatusList[imageListIndex].subProgress!,
                locationFiles.images,
                locationFiles.locationId
            );
            addToSubProgressList(
                currentProgressStatusList[segmentationListIndex].subProgress!,
                locationFiles.segmentations,
                locationFiles.locationId
            );
        }

        currentProgressStatusList.push(createExperimentProgress.value);

        return currentProgressStatusList;
    }

    // Computes the Progress Status list whenever individual FileToUpload objects change in their uploading/processing status
    const rawProgressStatusList = computed<ProgressRecord[]>(() =>
        initializeProgressStatusList()
    );

    //Once the raw progress status gets updated, we compute the overall statuses dependent on their subprogress.
    const progressStatusList = computed((): ProgressRecord[] => {
        const progressStatusResult: ProgressRecord[] = [];
        for (let i = 0; i < rawProgressStatusList.value.length; i++) {
            let currentProgress = rawProgressStatusList.value[i];
            if (currentProgress.subProgress) {
                // determine based on sub progress
                const currentSubProgress = determineProgress(
                    currentProgress.subProgress
                );
                currentProgress.progress = currentSubProgress;
                progressStatusResult.push(currentProgress);
            } else {
                progressStatusResult.push(currentProgress);
            }
        }
        return progressStatusResult;
    });

    const determineProgress = (subProgress: ProgressRecord[]) => {
        const failed = subProgress.some(
            (element) => element.progress === 'failed'
        );
        if (failed) {
            // If any failed, set total to failed
            return 'failed';
        } else {
            const running = subProgress.some(
                (element) =>
                    element.progress === 'running' ||
                    element.progress === 'dispatched'
            );
            if (running) {
                // If none failed but any are running/queued, set to running
                return 'running';
            } else {
                const succeeded = subProgress.every(
                    (element) => element.progress === 'succeeded'
                );
                if (succeeded) {
                    // If none running, none failed, and all have succeeded, set to 3
                    return 'succeeded';
                }
            }
        }
        // If none running, none failed, and not all succeeded, then it's still starting. Return 0
        return 'not_started';
    };

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

    // Watches progress list for all successes or any failures. Sets overall status based on the findings.
    watch(
        progressStatusList,
        (newList) => {
            const anyFailed = newList.some(
                (item: ProgressRecord) => item.progress == 'failed'
            );
            if (anyFailed) {
                overallProgress.value.status = -1;
                overallProgress.value.message =
                    'There was an error submitting this experiment.';
            }
            const allSucceeded = newList.every(
                (item: ProgressRecord) => item.progress === 'succeeded'
            );
            if (allSucceeded) {
                overallProgress.value.status = 2;
                overallProgress.value.message = 'Succeeded.';
            }
        },
        { deep: true }
    );

    // --------------------------------------------------------
    // --------------------------------------------------------
    // --------------------------------------------------------

    // Watches for completion of all previous processing steps. When everything has completed and records progress.
    watch(experimentConfig, async (newVal) => {
        if (newVal !== null) {
            // This only triggers when everything is done since experimentConfig is only computed once all has finished.
            if (experimentConfig && experimentHeaders) {
                createExperimentProgress.value.progress = 'running';
                const submitExperimentResponse: CreateExperimentResponseData =
                    await onSubmitExperiment();
                if (submitExperimentResponse.status === 'SUCCESS') {
                    createExperimentProgress.value.progress = 'succeeded';
                } else {
                    createExperimentProgress.value.progress = 'failed';
                }
            }
        }
    });

    async function onSubmitExperiment(): Promise<CreateExperimentResponseData> {
        if (experimentName.value && experimentConfig.value) {
            const submitExperimentResponse = await loonAxios.createExperiment(
                experimentName.value,
                experimentConfig.value,
                experimentHeaders.value,
                columnMappings.value
            );

            const submitExperimentResponseData: CreateExperimentResponseData =
                submitExperimentResponse.data;

            return submitExperimentResponseData;
        }
        return { status: 'failed', message: 'No experiment name given.' };
    }

    function allColumnsMapped(): boolean {
        if (!columnMappings.value) {
            return false;
        }
        for (const key of specialHeaders) {
            if (!columnMappings.value[key]) {
                return false;
            }
        }
        return true;
    }

    const specialHeaders: string[] = [
        'frame',
        'time',
        'id',
        'parent',
        'mass',
        'x',
        'y',
    ];

    async function populateDefaultColumnMappings() {
        if (locationFileList.value.length == 0) {
            // if there are no files are selectted don't populate
            return;
        }
        const firstCsvFile = locationFileList.value[0].table.file;
        if (!firstCsvFile) {
            // if the first file dones't exist don't populate
            return;
        }
        const reader = firstCsvFile.stream().getReader();
        const decoder = new TextDecoder('utf-8');
        let { value: chunk, done: readerDone } = await reader.read();
        let text = '';
        let firstLine = '';

        while (!readerDone) {
            text += decoder.decode(chunk, { stream: true });
            const lines = text.split('\n');
            if (lines.length > 1) {
                let headerIndex = currentWorkflowConfig.value.skip_lines;
                firstLine = lines[headerIndex];
                break;
            }
            ({ value: chunk, done: readerDone } = await reader.read());
        }
        columnNames.value = firstLine.split(',');
        columnMappings.value = {};
        for (const name of specialHeaders) {
            columnMappings.value[name] = getReasonableDefault(
                name,
                columnNames.value
            );
        }
    }

    function getReasonableDefault(
        header: string,
        columnNames: string[]
    ): string {
        // First check for an exact match.
        if (columnNames.includes(header)) {
            return header;
        }

        // If no exact match, check for a case-insensitive match.
        const lowerHeader = header.toLowerCase();
        for (const name of columnNames) {
            if (name.toLowerCase() === lowerHeader) {
                return name;
            }
        }

        // If no exact match, check if a word in the column name matches the header.
        for (const name of columnNames) {
            const columnWords = name.split(' ');
            for (const word of columnWords) {
                if (word.toLowerCase() === lowerHeader) {
                    return name;
                }
            }
        }

        // Otherwise, return ''
        return '';
    }

    return {
        experimentCreated,
        experimentName,
        verifyExperimentName,
        numberOfLocations,
        locationFileList,
        allFilesPopulated,
        locationIdsUnique,
        addLocation,
        removeLocation,
        uploadAll,
        progressStatusList,
        onSubmitExperiment,
        experimentConfig,
        experimentHeaders,
        overallProgress,
        allColumnsMapped,
        columnMappings,
        populateDefaultColumnMappings,
        columnNames,
        resetState,
        step,
        experimentNameValid,
    };
});
