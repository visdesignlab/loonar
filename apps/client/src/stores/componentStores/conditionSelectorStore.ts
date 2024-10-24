import { ref, computed, watch } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { useDatasetSelectionStore, type LocationMetadata } from '../dataStores/datasetSelectionUntrrackedStore';

export type Axis = 'x-axis' | 'y-axis';

export const useConditionSelector = defineStore('conditionSelector', () => {
    const datasetSelectionStore = useDatasetSelectionStore();
    const { currentExperimentMetadata } = storeToRefs(datasetSelectionStore)

    // Initialize starting tags as empty strings
    const selectedXTag = ref<string>('');
    const selectedYTag = ref<string>('');

    const chartColorScheme = [
        "#C026D3", // Fuchsia 600
        "#0D9488", // teal 600
        "#2563EB", //blue 600
        "#65A30D", // lime 600
        "#0EA5E9", // sky 500
        "#E11D48", // rose 600
    ]


    // Provides the set of tags
    const currentExperimentTags = computed((): Record<string, string[]> => {
        const tempTags: Record<string, string[]> = {};
        currentExperimentMetadata.value?.locationMetadataList.forEach((locationMetadata: LocationMetadata) => {
            if (locationMetadata.tags) {

                Object.entries(locationMetadata.tags).forEach((entry: [string, string]) => {
                    let tempTagKey = entry[0];
                    let tempTagValue = entry[1];

                    if (!(tempTagKey in tempTags)) {
                        tempTags[tempTagKey] = [];
                    }

                    if (!(tempTags[tempTagKey].includes(tempTagValue))) {
                        tempTags[tempTagKey].push(tempTagValue)
                    }
                })

            }
        });
        return tempTags;
    });

    // When experimentTags change, initialize as values.
    watch(currentExperimentTags, (newExperimentTags) => {
        if (Object.keys(newExperimentTags).length > 1) {
            selectedXTag.value = Object.keys(newExperimentTags)[0];
            selectedYTag.value = Object.keys(newExperimentTags)[1];
        }
    }, { immediate: true })


    const xLabels = computed<string[]>(() => {
        return currentExperimentTags.value[selectedXTag.value];
    });

    const yLabels = computed<string[]>(() => {
        return currentExperimentTags.value[selectedYTag.value];
    });

    function selectTag(tag: string, axis: Axis) {
        if (axis === 'x-axis') {
            selectedXTag.value = tag;
        } else {
            selectedYTag.value = tag;
        }
    }


    return {
        selectedXTag,
        selectedYTag,
        selectTag,
        xLabels,
        yLabels,
        currentExperimentTags,
        chartColorScheme
    };
});
