import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { asyncComputed } from '@vueuse/core';
import * as vg from '@uwdata/vgplot';

import { computedAsync } from '@vueuse/core';
import { useCellMetaData } from '@/stores/dataStores/cellMetaDataStore';
import { useDatasetSelectionTrrackedStore } from '@/stores/dataStores/datasetSelectionTrrackedStore';
import { useConfigStore } from '../misc/configStore';
import type { TextTransforms } from '@/util/datasetLoader';
import type { SelectedLocationIds } from '@/stores/dataStores/datasetSelectionTrrackedStore';

import {
    type CsvParserResults,
    loadCsv,
    loadFileIntoDuckDb,
    createAggregateTable,
    addAdditionalCellColumns,
} from '@/util/datasetLoader';
import { useNotificationStore } from '../misc/notificationStore';

export interface ExperimentMetadata {
    name: string; // user friendly name
    filename: string;
    headers: string[];
    headerTransforms?: TextTransforms; // maps things like "Time (h)" to "time"
    // valueRanges?: { string: { min: number; max: number } };
    // can precompute min/max for each column across experiments
    locationMetadataList: LocationMetadata[];
    compositeTabularDataFilename?: string;
    // how the segmentation files are saved
    // split by cell (default), split by frame
    segmentationGrouping?: SegmentationGroupingOptions;
}

export type SegmentationGroupingOptions = 'CellFiles' | 'FrameFiles';

export type Tags = Record<string, string>;

export interface LocationMetadata {
    // data related to a single imaging location
    id: string;
    tabularDataFilename: string;
    imageDataFilename?: string;
    segmentationsFolder?: string;
    tags?: Tags;
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

        const compTableName = computed(() => {
            if (currentExperimentMetadata.value) {
                return `${currentExperimentMetadata.value?.name}_composite_experiment_cell_metadata`;
            }
            return null;
        });

        const aggTableName = computed(() => {
            if (currentExperimentMetadata.value) {
                return `${currentExperimentMetadata.value?.name}_composite_experiment_cell_metadata_aggregate`;
            }
            return null;
        });

        const segmentationGrouping = computed<SegmentationGroupingOptions>(() => {
            // TODO: calc based on currentExperimentMetadata
            if (!currentExperimentMetadata.value) {
                return 'CellFiles'
            }
            return currentExperimentMetadata.value.segmentationGrouping ?? 'CellFiles';
        })

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
                // If experiment data has changed, need to ensure that we set 'loaded' to false.
                experimentDataLoaded.value = false;
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
                return data;
            });

        function getLocationMetadata(
            locationId: string
        ): LocationMetadata | null {
            if (!currentExperimentMetadata.value) return null;
            for (const locationMetatadata of currentExperimentMetadata.value
                .locationMetadataList) {
                if (locationMetatadata.id === locationId) {
                    return locationMetatadata;
                }
            }
            return null;
        }

        // Add a function to get all unique tag names
        function generateAllTagNames(
            locationMetadataList: LocationMetadata[]
        ): string[] {
            const tagSet = new Set<string>();
            locationMetadataList.forEach((location) => {
                if (location.tags) {
                    Object.keys(location.tags).forEach((tagName) =>
                        tagSet.add(tagName)
                    );
                }
            });
            return Array.from(tagSet);
        }

        // Initialize experiment cell metadata store and create duckdb table.
        watch(currentExperimentMetadata, async () => {
            if (currentExperimentMetadata.value?.compositeTabularDataFilename) {
                fetchingTabularData.value = true;

                const duckDbFileUrl = configStore.getDuckDbFileUrl(
                    currentExperimentMetadata.value
                        ?.compositeTabularDataFilename
                );
                try {
                    if (compTableName.value) {
                        await loadFileIntoDuckDb(
                            duckDbFileUrl,
                            compTableName.value,
                            'parquet'
                        );
                        try {
                            await addAdditionalCellColumns(
                                compTableName.value,
                                currentExperimentMetadata.value.headers,
                                currentExperimentMetadata.value.headerTransforms
                            );
                        } catch (error) {
                            console.error(error);
                        }
                        try {
                            // Generate allTagNames here
                            const allTagNames = generateAllTagNames(
                                currentExperimentMetadata.value
                                    .locationMetadataList
                            );
                            await createAggregateTable(
                                `${currentExperimentMetadata.value.name}_composite_experiment_cell_metadata`,
                                currentExperimentMetadata.value.headers,
                                currentExperimentMetadata.value
                                    .headerTransforms,
                                allTagNames
                            );
                            notify({
                                type: 'success',
                                message: `Created Aggregate DuckDB Table for ${duckDbFileUrl}.`,
                            });
                        } catch (error) {
                            const typedError = error as Error;
                            notify({
                                type: 'problem',
                                message: typedError.message,
                            });
                        }
                        notify({
                            type: 'success',
                            message: `Created DuckDb Table for ${duckDbFileUrl}.`,
                        });
                        // Selects default imaging location
                        selectImagingLocation(
                            currentExperimentMetadata.value
                                .locationMetadataList[0]
                        );
                    }
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

        // Location shown in list
        const shownSelectedLocationIds = ref<SelectedLocationIds>({});

        // Holds most recent, working location metadata
        const shownSelectedLocationMetadata = computed<LocationMetadata | null>(
            () => {
                if (currentExperimentMetadata.value == null) return null;
                for (const location of currentExperimentMetadata.value
                    .locationMetadataList) {
                    if (shownSelectedLocationIds.value[location.id]) {
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
            try {
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

                    for (const key in shownSelectedLocationIds.value) {
                        shownSelectedLocationIds.value[key] = false;
                    }
                    shownSelectedLocationIds.value[
                        currentLocationMetadata.value.id
                    ] = true;
                } catch (error) {
                    const typedError = error as Error;

                    if (shownSelectedLocationMetadata.value) {
                        selectImagingLocation(
                            shownSelectedLocationMetadata.value
                        );
                        notify({
                            type: 'problem',
                            message: `${typedError.message}. Reverting to Location "${shownSelectedLocationMetadata.value.id}"`,
                        });
                    } else {
                        notify({
                            type: 'problem',
                            message: typedError.message,
                        });
                    }
                }
            } catch (error) {
                // Revert back to previous location.
                if (shownSelectedLocationMetadata.value) {
                    selectImagingLocation(shownSelectedLocationMetadata.value);
                    notify({
                        type: 'problem',
                        message: `Failed to load location CSV file. Reverting to Location ${shownSelectedLocationMetadata.value.id}`,
                    });
                } else {
                    notify({
                        type: 'problem',
                        message: `Failed to load location CSV file. No location chosen.`,
                    });
                }
            }
            fetchingTabularData.value = false;
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
            await loadCsv(tabularDataFileUrl, initializeLocationCsvFile);
        }

        function handleFetchEntryError(message: string): void {
            errorMessage.value = message;
            serverUrlValid.value = false;
            fetchingEntryFile.value = false;
        }

        return {
            serverUrlValid,
            getLocationMetadata,
            errorMessage,
            fetchingEntryFile,
            experimentFilenameList,
            experimentDataInitialized,
            currentExperimentMetadata,
            currentLocationMetadata,
            fetchingTabularData,
            selectImagingLocation,
            refreshFileNameList,
            compTableName,
            aggTableName,
            shownSelectedLocationIds,
            segmentationGrouping,
        };
    }
);
