import { defineStore, storeToRefs } from 'pinia';
import { ref, watch } from 'vue';
import { useDatasetSelectionTrrackedStore } from '@/stores/dataStores/datasetSelectionTrrackedStore';

export const useImageViewerStoreUntrracked = defineStore(
    'imageViewerStoreUntrracked',
    () => {
        const datasetSelectionTrrackedStore = useDatasetSelectionTrrackedStore();
        const { currentExperimentFilename } = storeToRefs(
            datasetSelectionTrrackedStore
        );
        const contrastLimitSlider = ref<{ min: number; max: number }>({
            min: 0,
            max: 0,
        });

        watch(currentExperimentFilename, () => {
            contrastLimitSlider.value = { min: 0, max: 0 };
        });

        const sizeX = ref<number>(1);
        const sizeY = ref<number>(1);
        const sizeT = ref<number>(1);
        const sizeC = ref<number>(1);

        return {
            contrastLimitSlider,
            sizeX,
            sizeY,
            sizeT,
            sizeC,
        };
    }
);
