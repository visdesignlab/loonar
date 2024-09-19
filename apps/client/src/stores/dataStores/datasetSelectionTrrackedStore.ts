import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export interface SelectedLocationIds {
    [index: string]: boolean;
}

export const useDatasetSelectionTrrackedStore = defineStore(
    'datasetSelectionTrrackedStore',
    () => {
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
            currentExperimentFilename,
            selectedLocationIds,
            selectedLocationId,
        };
    }
);
