import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { useDataPointSelection } from '../interactionStores/dataPointSelectionTrrackedStore';

export interface SelectionIndex {
    c: number;
    t: number;
    z: number;
}

export const useImageViewerStore = defineStore('imageViewerStore', () => {
    const dataPointSelection = useDataPointSelection();
    const colormap = ref<string>('bone');
    const colormapOptions = [
        'jet',
        'viridis',
        'bone',
        'greys',
        'hsv',
        'hot',
        'cool',
        'copper',
        'blackbody',
        'earth',
        'electric',
        'magma',
        'oxygen',
        'temperature',
        'cubehelix',
        'rainbow',
    ];
    // all options: https://github.com/glslify/glsl-colormap#glsl-colormap
    const contrastLimitSliderDebounced = ref<{ min: number; max: number }>({
        // TODO: this is also a bit problematic
        min: 0,
        max: 0,
    });

    const contrastLimitExtentSlider = ref<{ min: number; max: number }>({
        // TODO: this should be handled more gracefully, this is causing
        // this to be stored in the trrack state.
        min: 0,
        max: 0,
    });

    const frameNumber = computed({
        get() {
            return dataPointSelection.currentFrameIndex + 1;
        },
        set(val) {
            dataPointSelection.currentFrameIndex = val - 1;
        },
    });
    function stepBackwards() {
        dataPointSelection.currentFrameIndex = Math.max(
            dataPointSelection.currentFrameIndex - 1,
            0
        );
    }
    function stepForwards(maxValue: number) {
        dataPointSelection.currentFrameIndex = Math.min(
            dataPointSelection.currentFrameIndex + 1,
            maxValue
        );
    }
    const selections = computed(() => {
        return [{ c: 0, t: dataPointSelection.currentFrameIndex, z: 0 }];
    });

    const trailLength = ref(10);
    const effectiveTrailLength = computed(() => {
        // if the current index is less than than the trail length
        // then the effective trail length should be shorter to
        // prevent rendering artifacts
        return Math.min(
            dataPointSelection.currentFrameIndex,
            trailLength.value
        );
    });

    const showImageLayer = ref(true);
    const showCellBoundaryLayer = ref(true);
    const showTrailLayer = ref(true);
    const showLineageLayer = ref(true);

    return {
        colormap,
        colormapOptions,
        contrastLimitSliderDebounced,
        contrastLimitExtentSlider,
        frameNumber,
        stepBackwards,
        stepForwards,
        selections,
        trailLength,
        effectiveTrailLength,
        showImageLayer,
        showCellBoundaryLayer,
        showTrailLayer,
        showLineageLayer,
    };
});
