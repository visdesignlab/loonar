import { ref, computed, watch } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import {
    useDatasetSelectionStore,
    type LocationMetadata,
} from '../dataStores/datasetSelectionUntrrackedStore';
import { debounce } from 'quasar';
import {
    useSelectionStore,
    type DataSelection,
} from '../interactionStores/selectionStore';
import { keysToString, stringToKeys } from '@/util/conChartStringFunctions';
// import { useMosaicSelectionStore } from '../dataStores/mosaicSelectionStore';

export type Axis = 'x-axis' | 'y-axis';

interface AxesOption {
    label: string;
    value: string;
}

export const useConditionSelectorStore = defineStore(
    'conditionSelectorStore',
    () => {
        const datasetSelectionStore = useDatasetSelectionStore();
        const { currentExperimentMetadata, experimentDataInitialized } =
            storeToRefs(datasetSelectionStore);
        const selectionStore = useSelectionStore();
        // const mosaicSelectionStore = useMosaicSelectionStore();

        // Initialize starting tags as empty strings
        const selectedXTag = ref<string>('');
        const selectedYTag = ref<string>('');
        // Initialize as empty. Used to indicate what is selected.
        const selectedGrid = ref<Record<string, boolean>>({});

        const selectedIndividualAxes = ref<AxesOption | null>(null);

        const axesOptions = ref<AxesOption[]>([]);

        const selectedIndividualYAxis = computed(() => {
            return selectedIndividualAxes.value?.value;
        });

        const chartColorScheme = [
            '#C026D3', // Fuchsia 600
            '#0D9488', // teal 600
            '#2563EB', //blue 600
            '#65A30D', // lime 600
            '#0EA5E9', // sky 500
            '#E11D48', // rose 600
        ];

        // Provides the set of tags
        const currentExperimentTags = computed((): Record<string, string[]> => {
            const experimentTags: Record<string, string[]> = {};
            if (!currentExperimentMetadata.value) {
                return experimentTags;
            }
            const locationMetadataList =
                currentExperimentMetadata.value.locationMetadataList;
            for (const locationMetadata of locationMetadataList) {
                const locationTags = locationMetadata.tags;
                if (!locationTags) continue;
                for (const [tagKey, tagValue] of Object.entries(locationTags)) {
                    if (!(tagKey in experimentTags)) {
                        experimentTags[tagKey] = [];
                    }

                    if (!experimentTags[tagKey].includes(tagValue)) {
                        experimentTags[tagKey].push(tagValue);
                    }
                }
            }
            return experimentTags;
        });

        // When experimentTags change, initialize as values.
        watch(
            currentExperimentTags,
            (newExperimentTags) => {
                const tagKeys = Object.keys(newExperimentTags);
                if (tagKeys.length > 1) {
                    selectedXTag.value = tagKeys[0];
                    selectedYTag.value = tagKeys[1];
                }
            },
            { immediate: true }
        );

        // Initializes the condition chart as being all selected. Ensures that experiment tags are chosen.
        watch(
            experimentDataInitialized,
            (isInitialized) => {
                if (
                    isInitialized &&
                    Object.keys(currentExperimentTags.value).length > 1
                ) {
                    // Reset grid. Should always be reset
                    selectedGrid.value = {};
                    clickConditionChartAll();
                    axesOptions.value = [
                        ...currentExperimentMetadata.value!.headers.map(
                            (entry) => {
                                return { label: entry, value: entry };
                            }
                        ),
                        { label: 'Mass Norm', value: 'Mass Norm' },
                    ];
                    selectedIndividualAxes.value = {
                        label: currentExperimentMetadata.value!
                            .headerTransforms!.mass,
                        value: currentExperimentMetadata.value!
                            .headerTransforms!.mass,
                    };
                }
            },
            { immediate: true }
        );

        const xLabels = computed<string[]>(() => {
            return currentExperimentTags.value[selectedXTag.value];
        });

        const yLabels = computed<string[]>(() => {
            return currentExperimentTags.value[selectedYTag.value];
        });

        function selectTag(tag: string, axis: Axis): void {
            if (axis === 'x-axis') {
                selectedXTag.value = tag;
            } else {
                selectedYTag.value = tag;
            }
        }

        function clickConditionChartColumn(idx: number): void {
            const allSelected = _checkAllSelected(idx, 'col');

            currentExperimentTags.value[selectedYTag.value].forEach(
                (value: string, idy: number) => {
                    toggleConditionChart(idx, idy, allSelected);
                }
            );
        }

        function clickConditionChartRow(idy: number): void {
            const allSelected = _checkAllSelected(idy, 'row');

            currentExperimentTags.value[selectedXTag.value].forEach(
                (value: string, idx: number) => {
                    toggleConditionChart(idx, idy, allSelected);
                }
            );
        }

        function clickConditionChartAll(): void {
            const allSelected = _checkAllSelected(null, 'all');

            currentExperimentTags.value[selectedXTag.value].forEach(
                (xValue: string, idx: number) => {
                    currentExperimentTags.value[selectedYTag.value].forEach(
                        (yValue: string, idy: number) => {
                            toggleConditionChart(idx, idy, allSelected);
                        }
                    );
                }
            );
        }

        function allSelected(): boolean {
            return Object.keys(selectedGrid.value).length === 0;
        }

        // Boolean to avoid circular logic
        let isExternalGridUpdate = false;
        watch(
            selectedGrid,
            debounce((newSelectedGrid) => {
                if (!isExternalGridUpdate) {
                    const keys = Object.entries(newSelectedGrid)
                        .filter((entry) => entry[1] === true)
                        .map((entry) => entry[0]);
                    const newFilters: DataSelection[] = [];
                    keys.forEach((key) => {
                        const [key1, value1, key2, value2] = stringToKeys(key);
                        newFilters.push({
                            plotName: `condition_chart_${key}`,
                            type: 'conditionChart',
                            range: [0, 0],
                            predicate: `"${key1}" = '${value1}' AND "${key2}" = '${value2}'`,
                        });
                    });
                    selectionStore.addConditionChartFilters(newFilters);
                }
                isExternalGridUpdate = false;
            }),
            { deep: true, immediate: true }
        );

        function clickConditionChartByName(name: string) {
            const [key1, value1, key2, value2] = stringToKeys(name);
            const idx = currentExperimentTags.value[
                selectedXTag.value
            ].findIndex((entry) => entry === value1);
            const idy = currentExperimentTags.value[
                selectedYTag.value
            ].findIndex((entry) => entry === value2);
            isExternalGridUpdate = true;
            toggleConditionChart(idx, idy);
        }

        function toggleConditionChart(
            idx: number,
            idy: number,
            show: boolean | null = null
        ) {
            const column = currentExperimentTags.value[selectedXTag.value][idx];
            const row = currentExperimentTags.value[selectedYTag.value][idy];

            const currentValue = getSelectedGridValue(column, row);

            let newValue = !currentValue;
            if (show !== null) {
                newValue = !show;
            }

            setSelectedGridValue(column, row, newValue);
        }

        function clickConditionChart(idx: number, idy: number): void {
            // clicking a condition chart should select that individual cell if everything is selected
            // otherwise it should just toggle the chart.
            const allSelected = _checkAllSelected(null, 'all');
            if (allSelected) {
                clickConditionChartAll();
            }
            toggleConditionChart(idx, idy);
        }

        function getSelectedGridValue(column: string, row: string): boolean {
            const keys = getSelectedKeys(column, row);
            // check if all values are the same
            const allEqual = keys.every((key) => {
                return selectedGrid.value[key] === selectedGrid.value[keys[0]];
            });
            if (!allEqual) {
                throw new Error('Selected grid values are not all the same');
            }

            return selectedGrid.value[keys[0]];
        }

        function setSelectedGridValue(
            column: string,
            row: string,
            value: boolean
        ): void {
            for (const key of getSelectedKeys(column, row)) {
                selectedGrid.value[key] = value;
            }
        }

        function getSelectedKeys(column: string, row: string): string[] {
            const keys: string[] = [];
            keys.push(
                keysToString(
                    selectedXTag.value,
                    column,
                    selectedYTag.value,
                    row
                )
            );
            keys.push(
                keysToString(
                    selectedYTag.value,
                    row,
                    selectedXTag.value,
                    column
                )
            );
            return keys;
        }

        type allSelectedType = 'row' | 'col' | 'all';

        //Helper function to determine if all objects in a row or column are selected (or if all are selected)
        function _checkAllSelected(
            index: number | null,
            type: allSelectedType = 'all'
        ): boolean {
            if (type === 'col') {
                if (index !== null) {
                    const column: string =
                        currentExperimentTags.value[selectedXTag.value][index];
                    let allSelected = true;

                    currentExperimentTags.value[selectedYTag.value].forEach(
                        (value: string) => {
                            const row: string = value;
                            const selected = getSelectedGridValue(column, row);
                            allSelected = allSelected && selected;
                        }
                    );
                    return allSelected;
                }
                return false;
            } else if (type === 'row') {
                if (index !== null) {
                    const row: string =
                        currentExperimentTags.value[selectedYTag.value][index];
                    let allSelected = true;

                    currentExperimentTags.value[selectedXTag.value].forEach(
                        (value: string) => {
                            const column: string = value;
                            const selected = getSelectedGridValue(column, row);
                            allSelected = allSelected && selected;
                        }
                    );
                    return allSelected;
                }
                return false;
            } else {
                let allSelected = true;
                currentExperimentTags.value[selectedXTag.value].forEach(
                    (xValue: string) => {
                        const column: string = xValue;
                        currentExperimentTags.value[selectedYTag.value].forEach(
                            (yValue: string) => {
                                const row: string = yValue;
                                const selected = getSelectedGridValue(
                                    column,
                                    row
                                );
                                allSelected = allSelected && selected;
                            }
                        );
                    }
                );
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
            getSelectedGridValue,
            allSelected,
            selectedIndividualAxes,
            axesOptions,
            selectedIndividualYAxis,
        };
    }
);
