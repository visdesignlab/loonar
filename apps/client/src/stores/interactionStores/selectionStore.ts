import { defineStore, storeToRefs } from 'pinia';
import * as vg from '@uwdata/vgplot';
import mitt from 'mitt';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { ref, computed, watch, type Ref } from 'vue';
import { useConditionSelectorStore } from '../componentStores/conditionSelectorStore';
import { addAggregateColumn } from '@/util/datasetLoader';
import { aggregateFunctions } from '@/components/plotSelector/aggregateFunctions';

export type SelectionType = 'cell' | 'track' | 'lineage' | 'conditionChart';

export interface DataSelection {
    plotName: string;
    type: SelectionType; // Unused, but will be needed if we have track-level and lineage-level attributes here
    range: [number, number]; // The current range selected
    predicate?: string;
}

export interface AttributeChart {
    plotName: string;
    type: SelectionType;
    maxRange: [number, number];
    range: [number, number];
}

type Events = {
    'plot-error': string;
};

export const emitter = mitt<Events>();
//const emit = defineEmits(['plot-error']);

interface SelectionState {
    attributeCharts: Ref<AttributeChart[]>;
    dataSelections: Ref<DataSelection[]>;
    dataFilters: Ref<DataSelection[]>;
}

const initialState = (): SelectionState => ({
    attributeCharts: ref<AttributeChart[]>([]),
    dataSelections: ref<DataSelection[]>([]),
    dataFilters: ref<DataSelection[]>([]),
});

export const useSelectionStore = defineStore('selectionStore', () => {
    // Declare initial state
    const { attributeCharts, dataSelections, dataFilters } = initialState();

    // create resetState function
    function resetState(): void {
        const newState = initialState();
        attributeCharts.value = newState.attributeCharts.value;
        dataSelections.value = newState.dataSelections.value;
        dataFilters.value = newState.dataFilters.value;
    }

    // Toggle button for showing relative charts.
    const showRelativeCell = ref<boolean>(false);
    const showRelativeTrack = ref<boolean>(false);

    const datasetSelectionStore = useDatasetSelectionStore();
    const { currentExperimentMetadata, experimentDataInitialized } =
        storeToRefs(datasetSelectionStore);
    const conditionSelectorStore = useConditionSelectorStore();
    // Watches for new experiment data. Initializes with basic attribute charts.
    watch(
        [experimentDataInitialized, currentExperimentMetadata],
        ([isInitialized, newExperimentMetadata], [prevInit, prevMeta]) => {
            // Resets state when initialization or experiment data changes.
            if (
                isInitialized &&
                newExperimentMetadata &&
                newExperimentMetadata.headerTransforms
            ) {
                const { mass } = newExperimentMetadata.headerTransforms;
                // Add mass plot.
                addPlot(mass, 'cell');
                // Add average mass plot.
                addPlot(`Average ${mass}`, 'track');
                // Use helper for track_length plot and filter
                addTrackLengthPlotAndFilter(newExperimentMetadata);
            }
        },
        { immediate: true, deep: true }
    );
    // Helper function to add track_length plot and filter above 50th percentile
    async function addTrackLengthPlotAndFilter(newExperimentMetadata: any) {
        const aggTable = `${newExperimentMetadata.name}_composite_experiment_cell_metadata_aggregate`;
        const compTable = `${newExperimentMetadata.name}_composite_experiment_cell_metadata`;
        // Add track_length plot
        await addAggregateColumn(
            aggTable,
            compTable,
            {
                functionName: aggregateFunctions['Track Length'].functionName,
                label: 'track_length',
            },
            newExperimentMetadata.headerTransforms
        );
        await addPlot('track_length', 'track');

        // Compute 50th percentile for track_length
        const percentileQuery = `
            SELECT
                approx_quantile(track_length, 0.50) AS p50,
                MAX(track_length) AS max_val
            FROM ${aggTable}
            WHERE track_length > 1
        `;
        const result = await vg.coordinator().query(percentileQuery, { type: 'json' });
        const p50 = Number(result[0].p50);
        const maxVal = Number(result[0].max_val);

        // Add filter for track_length >= 50th percentile
        addFilter({
            plotName: 'track_length',
            type: 'track',
            range: [p50, maxVal],
        });
    }

    // Private
    async function _getInitialMaxRange(
        plotName: string,
        type: SelectionType
    ): Promise<[number, number]> {
        try {
            // Loading
            let minVal = -Infinity;
            let maxVal = Infinity;

            if (!plotName || plotName.trim() === '') {
                throw new Error('Invalid or empty plot name');
            }

            // Escape the column name to handle spaces and special characters
            const escapedPlotName = `${plotName.replace(/"/g, '""')}`;

            const tablePrefix = `${currentExperimentMetadata.value?.name}_composite_experiment_cell_metadata`;
            const tableName =
                type === 'cell' ? tablePrefix : `${tablePrefix}_aggregate`;

            // Cast as varchar. Will convert back to number
            const query = `
                SELECT
                    CAST(MIN("${escapedPlotName}") AS VARCHAR) AS min_value,
                    CAST(MAX("${escapedPlotName}") AS VARCHAR) AS max_value
                FROM ${tableName}
            `;

            const result = await vg
                .coordinator()
                .query(query, { type: 'json' });

            minVal = Number(result[0].min_value);
            maxVal = Number(result[0].max_value);

            if (isNaN(minVal) || isNaN(maxVal)) {
                emitter.emit('plot-error', plotName);
                //throw new Error('NaN values detected in the data');
            }

            return [minVal, maxVal];
        } catch (error) {
            console.error('Error fetching data range:', error);
            // TODO: can't emit from store
            emitter.emit('plot-error', plotName);
            //throw error;
            return [0, 0];
        }
    }

    function addSelection(selection: DataSelection) {
        const existingIndex = dataSelections.value.findIndex(
            (s) => s.plotName === selection.plotName
        );
        if (existingIndex !== -1) {
            dataSelections.value[existingIndex] = selection;
        } else {
            dataSelections.value.push(selection);
        }
    }

    function clearAllSelections() {
        dataSelections.value = [];
    }

    function convertToFilters() {
        dataSelections.value.forEach((selection) => {
            addFilter({
                ...selection,
                range: [...selection.range],
            });
        });
        clearAllSelections();
    }

    function updateSelection(plotName: string, range: [number, number]) {
        const selection = dataSelections.value.find(
            (s) => s.plotName === plotName
        );
        const chart = attributeCharts.value.find(
            (s) => s.plotName === plotName
        );

        if (selection) {
            selection.range = [...range];
            if (chart) {
                chart.range = [...range];
            } else {
                console.error('Could not find corresponding plot.');
            }
        }
    }

    function removePlotByName(plotName: string) {
        const chartIndex = attributeCharts.value.findIndex(
            (chart: AttributeChart) => chart.plotName === plotName
        );
        if (chartIndex === -1) return;

        attributeCharts.value.splice(chartIndex, 1);
        removeSelectionByPlotName(plotName);
        removeFilterByPlotName(plotName);
    }

    function removeFilterByPlotName(plotName: string) {
        if (plotName === 'Condition Charts') {
            // When removing this filter, same as clicking "All" when not all selected.
            // Situation of deleting this filter when all are selected is impossible.
            conditionSelectorStore.clickConditionChartAll();
            return;
        }
        const index = dataFilters.value.findIndex(
            (s) => s.plotName === plotName
        );

        if (index === -1) return;

        removeFilter(index);
    }

    function removeSelectionByPlotName(plotName: string) {
        const index = dataSelections.value.findIndex(
            (s) => s.plotName === plotName
        );
        if (index !== -1) {
            dataSelections.value.splice(index, 1);

            // Update selection range when removing selection.
            const correspondingAttributeChart = attributeCharts.value.find(
                (entry) => entry.plotName === plotName
            );
            if (correspondingAttributeChart) {
                correspondingAttributeChart.range = [
                    ...correspondingAttributeChart.maxRange,
                ];
            }
        }
    }

    function removePlotWithErrors(plotName: string) {
        const index = dataSelections.value.findIndex(
            (s) => s.plotName === plotName
        );
        if (index === -1) return;
        dataSelections.value.splice(index, 1);
    }

    function getSelection(name: string): DataSelection | null {
        const s = dataSelections.value.find(
            (s: DataSelection) => s.plotName === name
        );
        if (typeof s === 'undefined') return null;
        return s;
    }

    async function addPlot(name: string, type: DataSelection['type']) {
        const existingIndex = attributeCharts.value.findIndex(
            (s) => s.plotName === name
        );
        if (existingIndex !== -1) {
            // Not sure when above would ever be triggered. Just warning for now, do nothing otherwise.
            console.warn('Chart already exists.');
            return;
        }

        // Get initial range
        const [minVal, maxVal] = await _getInitialMaxRange(name, type);

        // Create chart.
        const chart: AttributeChart = {
            plotName: name,
            range: [minVal, maxVal],
            maxRange: [minVal, maxVal],
            type: type,
        };
        attributeCharts.value.push(chart);
    }

    function addFilter(filter: DataSelection) {
        const existingIndex = dataFilters.value.findIndex(
            (s) => s.plotName === filter.plotName
        );
        if (existingIndex !== -1) {
            dataFilters.value[existingIndex] = filter;
        } else {
            dataFilters.value.push(filter);
        }
    }

    // Function to add multiple filters at once in order to avoid multiple watch triggers.
    function addConditionChartFilters(filters: DataSelection[]) {
        // Create deep copy temp data filters
        const tempDataFilters: DataSelection[] = dataFilters.value
            .filter((item) => !item.plotName.startsWith('condition_chart'))
            .map((item) => {
                return { ...item };
            });
        filters.forEach((filter) => {
            const existingIndex = tempDataFilters.findIndex(
                (s) => s.plotName === filter.plotName
            );

            if (existingIndex !== -1) {
                tempDataFilters[existingIndex] = filter;
            } else {
                tempDataFilters.push(filter);
            }
        });
        dataFilters.value = tempDataFilters;
    }

    function removeFilter(index: number) {
        dataFilters.value.splice(index, 1);
    }

    function updateFilter(
        plotName: string,
        range: [number, number],
        type?: DataSelection['type']
    ) {
        const existingIndex = dataFilters.value.findIndex(
            (s) => s.plotName === plotName
        );
        if (existingIndex !== -1) {
            dataFilters.value[existingIndex].range = range;
        } else {
            addFilter({
                plotName,
                range,
                type: type ?? 'cell',
            });
        }
    }

    // When we remove all filters (which is currently only happening when locations change), we need to "clickAll" for the condition chart again and ensure everything is selected.
    function clearAllFilters() {
        dataFilters.value = [];
        conditionSelectorStore.clickConditionChartAll();
    }

    return {
        dataSelections,
        dataFilters,
        attributeCharts,
        showRelativeCell,
        showRelativeTrack,
        resetState,
        clearAllSelections,
        updateSelection,
        updateFilter,
        clearAllFilters,
        removeSelectionByPlotName,
        removeFilterByPlotName,
        removePlotWithErrors,
        addPlot,
        getSelection,
        addSelection,
        addFilter,
        addConditionChartFilters,
        removeFilter,
        convertToFilters,
        removePlotByName,
    };
});
