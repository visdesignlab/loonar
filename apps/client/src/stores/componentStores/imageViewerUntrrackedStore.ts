import { defineStore, storeToRefs } from 'pinia';
import { ref, watch } from 'vue';
import { useDatasetSelectionTrrackedStore } from '@/stores/dataStores/datasetSelectionTrrackedStore';

export const useImageViewerStoreUntrracked = defineStore(
    'imageViewerStoreUntrracked',
    () => {
        const datasetSelectionTrrackedStore = useDatasetSelectionTrrackedStore();
        // Get the current experiment filename.
        const { currentExperimentFilename } = storeToRefs(
            datasetSelectionTrrackedStore
        );
        // Initialize the contrast limit slider to 0, 0.
        const contrastLimitSlider = ref<{ min: number; max: number }>({
            min: 0,
            max: 0,
        });

        // Reset the contrast limit slider when the experiment filename changes.
        watch(currentExperimentFilename, () => {
            contrastLimitSlider.value = { min: 0, max: 0 };
        });

        // Initialize the size variables to 1.
        const sizeX = ref<number>(1);
        const sizeY = ref<number>(1);
        const sizeT = ref<number>(1);
        const sizeC = ref<number>(1);

        function initializeContrastLimits(limits: [number, number]) {
            // If the contrast limit slider is not initialized (0, 0), initialize it
            if (
                contrastLimitSlider.value.min === 0 &&
                contrastLimitSlider.value.max === 0
            ) {
                contrastLimitSlider.value.min = limits[0];
                contrastLimitSlider.value.max = limits[1];
            }
        }

        return {
            contrastLimitSlider,
            sizeX,
            sizeY,
            sizeT,
            sizeC,
            initializeContrastLimits,
        };
    }
);
