import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { asyncComputed } from '@vueuse/core';
import * as vg from '@uwdata/vgplot';

import { computedAsync } from '@vueuse/core';
import {
    useCellMetaData,
    type TextTransforms,
} from '@/stores/dataStores/cellMetaDataStore';
import { useDatasetSelectionTrrackedStore } from '@/stores/dataStores/datasetSelectionTrrackedStore';
import { useConfigStore } from '../misc/configStore';

import { type CsvParserResults, parseCsv } from '@/util/csvParser';

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
        const fetchingTabularData = ref(false);
        const refreshTime = ref<string>(new Date().getTime().toString());
        let controller: AbortController;

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
            const data = await response.json();
            return data.experiments;
        }, [refreshTime.value]);

        function handleFetchEntryError(message: string): void {
            errorMessage.value = message;
            serverUrlValid.value = false;
            fetchingEntryFile.value = false;
        }

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
                return data;
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

        function initializeLocationCsvFile(results: CsvParserResults) {
            cellMetaData.init(
                results.data,
                results.meta.fields as string[],
                currentExperimentMetadata.value?.headerTransforms
            );
            fetchingTabularData.value = false;
        }

        async function loadCurrentLocationCsvFile(tabularDataFileUrl: string) {
            await parseCsv(tabularDataFileUrl, initializeLocationCsvFile);
        }

        watch(currentLocationMetadata, async () => {
            if (!currentLocationMetadata.value?.tabularDataFilename) {
                cellMetaData.dataInitialized = false;
                return;
            }
            const tabularDataFileUrl = configStore.getFileUrl(
                currentLocationMetadata.value?.tabularDataFilename
            );

            // DuckDB uses different routing. Need a separate URL
            const tabularDataDuckDbFileUrl: string =
                configStore.getDuckDbFileUrl(
                    currentLocationMetadata.value?.tabularDataFilename
                );

            fetchingTabularData.value = true;
            await loadCurrentLocationCsvFile(tabularDataFileUrl);

            vg.coordinator().databaseConnector(
                vg.socketConnector(configStore.duckDbWebSocketUrl)
            );

            await vg
                .coordinator()
                .exec([
                    vg.loadCSV(
                        'current_cell_metadata',
                        tabularDataDuckDbFileUrl
                    ),
                ]);

            // If you need to use web based duckDb instance, you can use this.
            // vg.coordinator().databaseConnector(vg.wasmConnector());

            // if (currentExperimentMetadata.value?.compositeTabularDataFilename) {
            //     let compositeTabularDataFileUrl = configStore.getDuckDbFileUrl(
            //         currentExperimentMetadata.value
            //             ?.compositeTabularDataFilename
            //     );
            //     await vg
            //         .coordinator()
            //         .exec([
            //             vg.loadCSV(
            //                 'composite_cell_metadata',
            //                 compositeTabularDataFileUrl
            //             ),
            //         ]);
            // }
        });

        function refreshFileNameList() {
            refreshTime.value = new Date().getTime().toString();
        }

        return {
            serverUrlValid,
            errorMessage,
            fetchingEntryFile,
            experimentFilenameList,
            currentExperimentMetadata,
            currentLocationMetadata,
            fetchingTabularData,
            selectImagingLocation,
            refreshFileNameList,
        };
    }
);
