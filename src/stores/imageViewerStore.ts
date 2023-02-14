import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export const useImageViewerStore = defineStore('imageViewerStore', () => {
    const colormap = ref<string>('jet');
    const colormapOptions = ['jet', 'bone', 'greys', 'rainbow'];
    const contrastLimitSlider = ref<{ min: number; max: number }>({
        min: 0,
        max: 0,
    });
    const contrastLimitExtentSlider = ref<{ min: number; max: number }>({
        min: 0,
        max: 0,
    });
    const contrastLimit = computed(() => {
        return [[contrastLimitSlider.value.min, contrastLimitSlider.value.max]];
    });

    return {
        colormap,
        colormapOptions,
        contrastLimit,
        contrastLimitSlider,
        contrastLimitExtentSlider,
    };
});
