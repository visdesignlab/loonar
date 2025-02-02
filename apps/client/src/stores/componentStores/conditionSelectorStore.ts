import { ref, computed, watch, type Ref } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { useDatasetSelectionStore } from '../dataStores/datasetSelectionUntrrackedStore';
import {
    useSelectionStore,
    type DataSelection,
} from '../interactionStores/selectionStore';
import { keysToString, stringToKeys } from '@/util/conChartStringFunctions';
import { useNotificationStore } from '../misc/notificationStore';
import { isEmpty } from 'lodash-es';

export type Axis = 'x-axis' | 'y-axis';

interface AxesOption {
    label: string;
    value: string;
}

interface ConditionSelectorState {
    selectedXTag: Ref<string>;
    selectedYTag: Ref<string>;
    selectedGrid: Ref<Record<string, boolean>>;
    selectedIndividualAxes: Ref<AxesOption | null>;
    axesOptions: Ref<AxesOption[]>;
}

const initialState = (): ConditionSelectorState => ({
    selectedXTag: ref<string>(''),
    selectedYTag: ref<string>(''),
    selectedGrid: ref<Record<string, boolean>>({}),
    selectedIndividualAxes: ref<AxesOption | null>(null),
    axesOptions: ref<AxesOption[]>([]),
});

export const useConditionSelectorStore = defineStore(
    'conditionSelectorStore',
    () => {
        const defaultState = initialState();
        const {
            selectedXTag,
            selectedYTag,
            selectedGrid,
            selectedIndividualAxes,
            axesOptions,
        } = defaultState;

        function resetState(): void {
            const newState = initialState();
            selectedXTag.value = newState.selectedXTag.value;
            selectedYTag.value = newState.selectedYTag.value;
            selectedGrid.value = newState.selectedGrid.value;
            selectedIndividualAxes.value =
                newState.selectedIndividualAxes.value;
            axesOptions.value = newState.axesOptions.value;
        }

        const datasetSelectionStore = useDatasetSelectionStore();
        const {
            currentExperimentMetadata,
            experimentDataInitialized,
            currentLocationMetadata,
        } = storeToRefs(datasetSelectionStore);

        const selectionStore = useSelectionStore();
        // const mosaicSelectionStore = useMosaicSelectionStore();

        // Initialize starting tags as empty strings
        // Initialize as empty. Used to indicate what is selected.

        const { notify } = useNotificationStore();

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
        watch(experimentDataInitialized, (isInitialized) => {
            if (
                isInitialized &&
                Object.keys(currentExperimentTags.value).length > 1 &&
                isEmpty(selectedGrid.value)
            ) {
                // Reset grid. Should always be reset
                clickConditionChartAll();
                axesOptions.value = [
                    ...currentExperimentMetadata.value!.headers.map((entry) => {
                        return { label: entry, value: entry };
                    }),
                    { label: 'Mass Norm', value: 'Mass Norm' },
                ];
                selectedIndividualAxes.value = {
                    label: currentExperimentMetadata.value!.headerTransforms!
                        .mass,
                    value: currentExperimentMetadata.value!.headerTransforms!
                        .mass,
                };
            }
        });

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
        watch(
            selectedGrid,
            (newSelectedGrid) => {
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

                // Changes imaging location if the current location gets filtered out.
                if (
                    currentExperimentMetadata.value &&
                    currentLocationMetadata.value
                ) {
                    const tags = currentLocationMetadata.value.tags;
                    if (tags) {
                        const entries = Object.entries(tags);
                        const keyString = keysToString(
                            entries[0][0],
                            entries[0][1],
                            entries[1][0],
                            entries[1][1]
                        );
                        const isSelected = newSelectedGrid[keyString];
                        if (!isSelected) {
                            // Iterate through location metadata list until you find one that is selected
                            const locationMetadata =
                                currentExperimentMetadata.value
                                    .locationMetadataList;
                            for (const currMetadata of locationMetadata) {
                                const currTags = currMetadata.tags;
                                if (currTags) {
                                    const currEntries =
                                        Object.entries(currTags);
                                    const currKeyString = keysToString(
                                        currEntries[0][0],
                                        currEntries[0][1],
                                        currEntries[1][0],
                                        currEntries[1][1]
                                    );
                                    const currIsSelected =
                                        newSelectedGrid[currKeyString];
                                    if (currIsSelected) {
                                        // select location
                                        datasetSelectionStore.selectImagingLocation(
                                            currMetadata
                                        );
                                        notify({
                                            type: 'info',
                                            message: `Changing to location "${currMetadata.id}"`,
                                        });
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            },
            { deep: true }
        );

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
            const columns = currentExperimentTags.value[selectedXTag.value];
            const rows = currentExperimentTags.value[selectedYTag.value];
            if (type === 'all') {
                return columns.every((column) =>
                    rows.every((row) => getSelectedGridValue(column, row))
                );
            }
            if (index === null) {
                throw new Error('Index is required when type is not all');
            }
            if (type === 'col') {
                const column: string = columns[index];
                return rows.every((row) => getSelectedGridValue(column, row));
            }
            if (type === 'row') {
                const row: string = rows[index];
                return columns.every((col) => getSelectedGridValue(col, row));
            }
            throw new Error('Invalid type');
        }

        // Add conditionColorMap
        const conditionColorMap = computed<Record<string, string>>(() => {
            console.log('conditionColorMap computed');
            const map: Record<string, string> = {};
            yLabels.value.forEach((label, index) => {
                map[label] = chartColorScheme[index % chartColorScheme.length];
                console.log(
                    `Mapping Y Label: ${label} to Color: ${map[label]}`
                ); // Debug log
            });
            console.log('conditionColorMap:', map); // Debug log
            return map;
        });

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
            selectedGrid,
            getSelectedGridValue,
            allSelected,
            selectedIndividualAxes,
            axesOptions,
            selectedIndividualYAxis,
            resetState,
            conditionColorMap,
        };
    }
);
