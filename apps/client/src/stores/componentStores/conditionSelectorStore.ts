import { ref, computed } from 'vue';
import { defineStore } from 'pinia';


export type Axis = "x-axis" | "y-axis";


export const useConditionSelector = defineStore('conditionSelector', () => {

    const tags = ref<string[]>([
        "drug",
        "concentration",
        "cancer_concentration"
    ]);
    const selectedXTag = ref<string>('drug');
    const selectedYTag = ref<string>('concentration');

    const valuesFromTags = ref<Record<string, string[]>>({
        "drug": ['tylenol', 'advil', 'aspirin', 'ibuprofen'],
        "concentration": ['0.3', '0.4', '0.5', '0.6', '0.7'],
        "cancer_concentration": ['0.1', '0.2']
    });

    const xLabels = computed<string[]>(() => {
        return valuesFromTags.value[selectedXTag.value]
    })

    const yLabels = computed<string[]>(() => {
        return valuesFromTags.value[selectedYTag.value]
    })


    function selectTag(tag: string, axis: Axis) {
        if (axis === 'x-axis') {
            selectedXTag.value = tag;
        } else {
            selectedYTag.value = tag;
        }
    }

    return {
        tags,
        selectedXTag,
        selectedYTag,
        selectTag,
        xLabels,
        yLabels
    };
});
