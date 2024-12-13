import { ref, computed, watch } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { useDatasetSelectionStore, type LocationMetadata } from '../dataStores/datasetSelectionUntrrackedStore';
import { debounce } from 'quasar';
import { useSelectionStore, type DataSelection } from '../interactionStores/selectionStore';
import { stringToKeys } from '@/util/conChartStringFunctions';
// import { useMosaicSelectionStore } from '../dataStores/mosaicSelectionStore';

export type Axis = 'x-axis' | 'y-axis';

export const useConditionSelectorStore = defineStore('conditionSelector', () => {
    const datasetSelectionStore = useDatasetSelectionStore();
    const { currentExperimentMetadata, experimentDataInitialized } = storeToRefs(datasetSelectionStore)
    const selectionStore = useSelectionStore();
    // const mosaicSelectionStore = useMosaicSelectionStore();

    // Initialize starting tags as empty strings
    const selectedXTag = ref<string>('');
    const selectedYTag = ref<string>('');
    // Initialize as empty. Used to indicate what is selected.
    const selectedGrid = ref<Record<string, boolean>>({});

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


    // Initializes the condition chart as being all selected. Ensures that experiment tags are chosen.
    watch(experimentDataInitialized, (isInitialized) => {
        if (isInitialized && Object.keys(currentExperimentTags.value).length > 1) {
            // Reset grid. Should always be reset
            selectedGrid.value = {}
            clickConditionChartAll()
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



    function clickConditionChartColumn(idx: number) {

        const allSelected = _checkAllSelected(idx, 'col');

        currentExperimentTags.value[selectedYTag.value].forEach((value: string, idy: number) => {
            clickConditionChart(idx, idy, allSelected)
        })
    }

    function clickConditionChartRow(idy: number) {

        const allSelected = _checkAllSelected(idy, 'row');

        currentExperimentTags.value[selectedXTag.value].forEach((value: string, idx: number) => {
            clickConditionChart(idx, idy, allSelected)
        })
    }

    function clickConditionChartAll() {

        const allSelected = _checkAllSelected(null, 'all');

        currentExperimentTags.value[selectedXTag.value].forEach((xValue: string, idx: number) => {
            currentExperimentTags.value[selectedYTag.value].forEach((yValue: string, idy: number) => {
                clickConditionChart(idx, idy, allSelected)
            })
        })
    }

    function allSelected() {
        return Object.keys(selectedGrid.value).length === 0;
    }

    // Boolean to avoid circular logic
    let isExternalGridUpdate = false;
    watch(selectedGrid, debounce((newSelectedGrid) => {
        if (!isExternalGridUpdate) {
            const keys = Object.entries(newSelectedGrid).filter(entry => entry[1] === true).map(entry => entry[0])
            const newFilters: DataSelection[] = [];
            keys.forEach(key => {
                const [key1, value1, key2, value2] = stringToKeys(key);
                newFilters.push({
                    plotName: `condition_chart_${key}`,
                    type: 'conditionChart',
                    range: [0, 0],
                    predicate: `"${key1}" = '${value1}' AND "${key2}" = '${value2}'`
                })
            })
            selectionStore.addConditionChartFilters(newFilters);
        }
        isExternalGridUpdate = false;


    }), { deep: true, immediate: true });

    function clickConditionChartByName(name: string) {
        const [key1, value1, key2, value2] = stringToKeys(name);
        const idx = currentExperimentTags.value[selectedXTag.value].findIndex(entry => entry === value1);
        const idy = currentExperimentTags.value[selectedYTag.value].findIndex(entry => entry === value2);
        isExternalGridUpdate = true;
        clickConditionChart(idx, idy);
    }

    function clickConditionChart(idx: number, idy: number, allSelected: boolean | null = null) {
        const currentColumnVal = currentExperimentTags.value[selectedXTag.value][idx]
        const currentRowVal = currentExperimentTags.value[selectedYTag.value][idy]

        const currentValue = selectedGrid.value[`${selectedXTag.value}¶${currentColumnVal}¶${selectedYTag.value}¶${currentRowVal}`];

        let newValue = !currentValue;
        if (allSelected !== null) {
            newValue = allSelected ? false : true;
        }

        // Set 'Selected' on current selection
        selectedGrid.value[`${selectedXTag.value}¶${currentColumnVal}¶${selectedYTag.value}¶${currentRowVal}`] = newValue;
    }
    type allSelectedType = 'row' | 'col' | 'all'

    //Helper function to determine if all objects in a row or column are selected (or if all are selected)
    function _checkAllSelected(index: number | null, type: allSelectedType = 'all') {
        if (type === 'col') {
            if (index !== null) {
                const currentColumnVal: string = currentExperimentTags.value[selectedXTag.value][index]
                let allSelected = true;

                currentExperimentTags.value[selectedYTag.value].forEach((value: string) => {
                    const currentRowVal: string = value;
                    const selected = selectedGrid.value[`${selectedXTag.value}¶${currentColumnVal}¶${selectedYTag.value}¶${currentRowVal}`] ?? false;
                    allSelected = allSelected && selected;
                })
                return allSelected
            }
            return false

        } else if (type === 'row') {
            if (index !== null) {

                const currentRowVal: string = currentExperimentTags.value[selectedYTag.value][index]
                let allSelected = true;

                currentExperimentTags.value[selectedXTag.value].forEach((value: string) => {
                    const currentColumnVal: string = value;
                    const selected = selectedGrid.value[`${selectedXTag.value}¶${currentColumnVal}¶${selectedYTag.value}¶${currentRowVal}`] ?? false;
                    allSelected = allSelected && selected;
                })
                return allSelected
            }
            return false
        } else {
            let allSelected = true;
            currentExperimentTags.value[selectedXTag.value].forEach((xValue: string) => {
                const currentColumnVal: string = xValue;
                currentExperimentTags.value[selectedYTag.value].forEach((yValue: string) => {
                    const currentRowVal: string = yValue;
                    const selected = selectedGrid.value[`${selectedXTag.value}¶${currentColumnVal}¶${selectedYTag.value}¶${currentRowVal}`] ?? false;
                    allSelected = allSelected && selected;
                })
            })
            return allSelected;
        }
    }



    return {
        selectedXTag,
        selectedYTag,
        selectTag,
        xLabels,
        yLabels,
        currentExperimentTags,
        chartColorScheme,
        clickConditionChart,
        clickConditionChartAll,
        clickConditionChartColumn,
        clickConditionChartRow,
        clickConditionChartByName,
        selectedGrid,
        allSelected
    };
});
