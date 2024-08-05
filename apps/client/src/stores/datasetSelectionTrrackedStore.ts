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
        const serverUrl = ref<string>(configStore.envServerUrl);
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
        };
    }
);
