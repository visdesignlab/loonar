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

        return {
            currentExperimentFilename,
            selectedLocationIds,
        };
    }
);
