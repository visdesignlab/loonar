import { ref, computed } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { useDatasetSelectionStore, type LocationMetadata } from '../dataStores/datasetSelectionUntrrackedStore';

export type Axis = 'x-axis' | 'y-axis';

export const useConditionSelector = defineStore('conditionSelector', () => {
    const datasetSelectionStore = useDatasetSelectionStore();
    const { currentExperimentMetadata } = storeToRefs(datasetSelectionStore)

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


    const selectedXTag = ref<string>('drug');
    const selectedYTag = ref<string>('concentration');

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
        currentExperimentTags
    };
});
