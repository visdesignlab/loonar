import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useImageViewerStoreUntrracked = defineStore(
    'imageViewerStoreUntrracked',
    () => {
        const contrastLimitSlider = ref<{ min: number; max: number }>({
            min: 0,
            max: 0,
        });

        const sizeX = ref<number>(1);
        const sizeY = ref<number>(1);
        const sizeT = ref<number>(1);
        const sizeC = ref<number>(1);

        const lastExperimentFilename = ref<string | null>(null);

        return {
            contrastLimitSlider,
            sizeX,
            sizeY,
            sizeT,
            sizeC,
            lastExperimentFilename,
        };
    }
);
