import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { asyncComputed } from '@vueuse/core';
import * as vg from '@uwdata/vgplot';

import { computedAsync } from '@vueuse/core';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useDatasetSelectionTrrackedStore } from '@/stores/dataStores/datasetSelectionTrrackedStore';
import { useConfigStore } from '../misc/configStore';
import type { TextTransforms } from '@/util/datasetLoader';

import {
    type CsvParserResults,
    loadCsv,
    loadFileIntoDuckDb,
} from '@/util/datasetLoader';
import { useNotificationStore } from '../misc/notificationStore';

export interface ExperimentMetadata {
    // name?: string; // user friendly name
    filename: string;
    headers: string[];
    headerTransforms?: TextTransforms; // maps things like "Time (h)" to "time"
    // valueRanges?: { string: { min: number; max: number } };
    // can precompute min/max for each column across experiments
    // conditions?: string[]; // TODO: - does this need to be 2d?
    locationMetadataList: LocationMetadata[];
    compositeTabularDataFilename?: string;
}

export interface LocationMetadata {
    // data related to a single imaging location
    id: string;
    tabularDataFilename: string;
    imageDataFilename?: string;
    segmentationsFolder?: string;
    // name?: string; // user friendly name
    // condition?: string; // experimental condition // TODO: - does this need to be an array
    // plate?: string;
    // well?: string;
    // location?: string;
}

export const useDatasetSelectionStore = defineStore(
    'datasetSelectionStore',
    () => {
        const serverUrlValid = ref(true);
        const fetchingEntryFile = ref(false);
        const errorMessage = ref('default error message');

        const cellMetaData = useCellMetaData();

        const datasetSelectionTrrackedStore =
            useDatasetSelectionTrrackedStore();
        const configStore = useConfigStore();
        const { notify } = useNotificationStore();
        const fetchingTabularData = ref(false);
        const refreshTime = ref<string>(new Date().getTime().toString());
        const experimentDataLoaded = ref(false);
        const experimentDataInitialized = computed(() => {
            return experimentDataLoaded.value;
        });
        let controller: AbortController;

        // Generate Experiment List
        const experimentFilenameList = asyncComputed<string[]>(async () => {
            if (configStore.serverUrl == null) return null;
            const fullURL = configStore.getFileUrl(
                configStore.entryPointFilename
            );
            if (controller) {
                controller.abort('stale request'); // cancel last fetch if it's still trying
            }
            controller = new AbortController();
            fetchingEntryFile.value = true;
            const response = await fetch(
                fullURL + `?timestamp=${refreshTime.value}`,
                {
                    signal: controller.signal, // link controller so can cancel if need to
                }
            ).catch((error: Error) => {
                handleFetchEntryError(
                    `Could not access ${fullURL}. "${error.message}"`
                );
            });
            if (response == null) return;
            if (!response.ok) {
                handleFetchEntryError(
                    `Server Error. "${response.status}: ${response.statusText}"`
                );
                return;
            }
            fetchingEntryFile.value = false;
            serverUrlValid.value = true;

            const connector = vg.socketConnector(
                configStore.duckDbWebSocketUrl
            );

            // If you need to use web instance of duckdb instead, you can use this connector rather than the one above.
            // const connector = vg.wasmConnector();

            // Initialize Duckdb Socket Connection
            vg.coordinator().databaseConnector(connector);

            const data = await response.json();
            return data.experiments;
        }, [refreshTime.value]);

        // Sets location Metadata
        const currentExperimentMetadata =
            computedAsync<ExperimentMetadata | null>(async () => {
                if (
                    datasetSelectionTrrackedStore.currentExperimentFilename ==
                    null
                )
                    return null;
                const fullURL = configStore.getFileUrl(
                    datasetSelectionTrrackedStore.currentExperimentFilename
                );
                const response = await fetch(fullURL, {});
                const data = await response.json();
                console.log(data);
                return data;
            });

        // Initialize experiment cell metadata store and create duckdb table.
        watch(currentExperimentMetadata, async () => {
            if (currentExperimentMetadata.value?.compositeTabularDataFilename) {
                fetchingTabularData.value = true;

                let duckDbFileUrl = configStore.getDuckDbFileUrl(
                    currentExperimentMetadata.value
                        ?.compositeTabularDataFilename
                );
                try {
                    console.log('here')
                    await loadFileIntoDuckDb(
                        duckDbFileUrl,
                        'composite_experiment_cell_metadata',
                        'parquet'
                    );
                    notify({
                        type: 'success',
                        message: `Created DuckDb Table for ${duckDbFileUrl}.`,
                    });
                } catch (error) {
                    const typedError = error as Error;
                    notify({
                        type: 'problem',
                        message: typedError.message,
                    });
                    experimentDataLoaded.value = false;
                }
                experimentDataLoaded.value = true;
                fetchingTabularData.value = false;
            } else {
                if (currentExperimentMetadata.value !== null) {
                    notify({
                        type: 'warning',
                        message:
                            'No composite dataset specified in Experiment file.',
                    });
                }
            }
        });

        function selectImagingLocation(location: LocationMetadata): void {
            datasetSelectionTrrackedStore.$patch(() => {
                for (const key in datasetSelectionTrrackedStore.selectedLocationIds) {
                    datasetSelectionTrrackedStore.selectedLocationIds[key] =
                        false;
                }
                datasetSelectionTrrackedStore.selectedLocationIds[location.id] =
                    true;
            });
        }

        // TODO: - update to support multi-location
        const currentLocationMetadata = computed<LocationMetadata | null>(
            () => {
                if (currentExperimentMetadata.value == null) return null;
                for (const location of currentExperimentMetadata.value
                    .locationMetadataList) {
                    if (
                        datasetSelectionTrrackedStore.selectedLocationIds[
                        location.id
                        ]
                    ) {
                        return location;
                    }
                }
                return null;
            }
        );

        watch(currentLocationMetadata, async () => {
            if (!currentLocationMetadata.value?.tabularDataFilename) {
                cellMetaData.dataInitialized = false;
                return;
            }
            const tabularDataFileUrl = configStore.getFileUrl(
                currentLocationMetadata.value?.tabularDataFilename
            );

            fetchingTabularData.value = true;
            await loadCurrentLocationCsvFile(tabularDataFileUrl);

            const duckDbFileUrl = configStore.getDuckDbFileUrl(
                currentLocationMetadata.value?.tabularDataFilename
            );

            try {
                await loadFileIntoDuckDb(
                    duckDbFileUrl,
                    'current_cell_metadata',
                    'csv'
                );
                notify({
                    type: 'success',
                    message: `Created DuckDb Table for ${duckDbFileUrl}.`,
                });
            } catch (error) {
                const typedError = error as Error;
                notify({
                    type: 'problem',
                    message: typedError.message,
                });
            }
        });

        function refreshFileNameList() {
            refreshTime.value = new Date().getTime().toString();
        }

        function initializeLocationCsvFile(results: CsvParserResults) {
            cellMetaData.init(
                results.data,
                results.meta.fields as string[],
                currentExperimentMetadata.value?.headerTransforms
            );
            fetchingTabularData.value = false;
        }

        async function loadCurrentLocationCsvFile(tabularDataFileUrl: string) {
            try {
                await loadCsv(tabularDataFileUrl, initializeLocationCsvFile);
            } catch (error) {
                notify({
                    type: 'problem',
                    message: 'Failed to load location CSV file.',
                });
            }
        }

        function handleFetchEntryError(message: string): void {
            errorMessage.value = message;
            serverUrlValid.value = false;
            fetchingEntryFile.value = false;
        }

        return {
            serverUrlValid,
            errorMessage,
            fetchingEntryFile,
            experimentFilenameList,
            experimentDataInitialized,
            currentExperimentMetadata,
            currentLocationMetadata,
            fetchingTabularData,
            selectImagingLocation,
            refreshFileNameList,
        };
    }
);
