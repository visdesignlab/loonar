import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';
import { useConfigStore } from '@/stores/configStore';

export interface SelectedLocationIds {
    [index: string]: boolean;
}

export const useDatasetSelectionTrrackedStore = defineStore(
    'datasetSelectionTrrackedStore',
    () => {
        const configStore = useConfigStore();

        let httpValue = 'http://';
        let wsValue = 'ws://';
        if (!configStore.useHttp) {
            httpValue = 'https://';
            wsValue = 'wss://';
        }

        // Used to retrieve static files hosted by data store (local or MinIO)
        const serverUrl = ref<string>(
            `${httpValue}${configStore.envServerUrl}`
        );
        // Location of websocket for DuckDb as specified in NGINX
        const duckDbWebsocketUrl = ref<string>(
            `${wsValue}${configStore.envServerUrl.replace('/data', '/ws/')}`
        );

        // Environment based location of data retrieval for DuckDb
        let duckDbDataLocation =
            configStore.environment === 'local' ? 'data:9000' : 'minio:9000';
        const duckDbUrl = ref<string>(`${httpValue}${duckDbDataLocation}`);
        const entryPointFilename = '/aa_index.json';
        const currentExperimentFilename = ref<string | null>(null);
        const selectedLocationIds = ref<SelectedLocationIds>({});
        const selectedLocationId = computed<string | null>(() => {
            for (const id in selectedLocationIds.value) {
                if (selectedLocationIds.value[id]) {
                    return id;
                }
            }
            return null;
        });

        return {
            serverUrl,
            entryPointFilename,
            currentExperimentFilename,
            selectedLocationIds,
            selectedLocationId,
            duckDbWebsocketUrl,
            duckDbUrl,
        };
    }
);
