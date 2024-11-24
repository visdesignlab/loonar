import { defineStore, storeToRefs } from 'pinia';
import * as vg from '@uwdata/vgplot';
import mitt from 'mitt';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { ref, computed, watch, type Ref } from 'vue';


export type SelectionType = 'cell' | 'track' | 'lineage';

export interface DataSelection {
    plotName: string;
    type: SelectionType; // Unused, but will be needed if we have track-level and lineage-level attributes here
    range: [number, number]; // The current range selected
}

export interface AttributeChart {
    plotName: string,
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
    attributeCharts: Ref<AttributeChart[]>,
    dataSelections: Ref<DataSelection[]>,
    dataFilters: Ref<DataSelection[]>,

}

const initialState = (): SelectionState => ({
    attributeCharts: ref<AttributeChart[]>([]),
    dataSelections: ref<DataSelection[]>([]),
    dataFilters: ref<DataSelection[]>([]),
})


export const useSelectionStore = defineStore('selectionStore', () => {

    // Declare initial state
    let {
        attributeCharts,
        dataSelections,
        dataFilters
    } = initialState();

    // create resetState function
    function resetState(): void {
        let newState = initialState();
        attributeCharts.value = newState.attributeCharts.value;
        dataSelections.value = newState.dataSelections.value;
        dataFilters.value = newState.dataFilters.value;
    }

    // Toggle button for showing relative charts.
    const showRelativeCell = ref<boolean>(false);
    const showRelativeTrack = ref<boolean>(false);

    const datasetSelectionStore = useDatasetSelectionStore();
    const { currentExperimentMetadata, experimentDataInitialized } = storeToRefs(datasetSelectionStore);

    // Watches for new experiment data. Initializes with basic attribute charts.
    watch([experimentDataInitialized, currentExperimentMetadata], ([isInitialized, newExperimentMetadata], [prevInit, prevMeta]) => {
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
            addPlot(`AVG ${mass}`, 'track');
        }
    }, { immediate: true, deep: true })

    // Private
    async function _getInitialMaxRange(plotName: string, type: SelectionType): Promise<[number, number]> {

        try {

            // Loading
            let minVal = -Infinity;
            let maxVal = Infinity;

            if (!plotName || plotName.trim() === '') {
                throw new Error('Invalid or empty plot name');
            }

            // Escape the column name to handle spaces and special characters
            const escapedPlotName = `${plotName.replace(/"/g, '""')}`;

            const tablePrefix = `${currentExperimentMetadata.value?.name}_composite_experiment_cell_metadata`
            const tableName = type === 'cell' ? tablePrefix : `${tablePrefix}_aggregate`

            let query = `
                SELECT
                    MIN("${escapedPlotName}") AS min_value,
                    MAX("${escapedPlotName}") AS max_value
                FROM ${tableName}
            `;

            const result = await vg.coordinator().query(query);

            if (
                !result ||
                !result.batches ||
                result.batches.length === 0 ||
                result.batches[0].numRows === 0
            ) {
                throw new Error('No data returned from query');
            }

            minVal = Number(result.batches[0].get(0).min_value);
            maxVal = Number(result.batches[0].get(0).max_value);

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
        dataSelections.value.forEach(selection => {
            addFilter({
                ...selection,
                range: [...selection.range],
            })
        })
        clearAllSelections();
    }

    function updateSelection(
        plotName: string,
        range: [number, number],
        type?: DataSelection['type']
    ) {
        const plot = dataSelections.value.find(
            (s) => s.plotName === plotName
        );
        const chart = attributeCharts.value.find(
            (s) => s.plotName === plotName
        )

        if (plot) {
            plot.range = [...range];
            if (chart) {
                chart.range = [...range];
            } else {
                console.error('Could not find corresponding plot.')
            }
        } else {
            addSelection({
                plotName,
                range,
                type: type ?? 'cell', // Default value
            });
        }
    }

    function removeFilterByPlotName(plotName: string) {
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
            const correspondingAttributeChart = attributeCharts.value.find(entry => entry.plotName === plotName);
            if (correspondingAttributeChart) {
                correspondingAttributeChart.range = [...correspondingAttributeChart.maxRange]
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
            console.warn('Chart already exists.')
            return;
        }

        // Get initial range
        const [minVal, maxVal] = await _getInitialMaxRange(name, type);

        // Create chart.
        const chart: AttributeChart = {
            plotName: name,
            range: [minVal, maxVal],
            maxRange: [minVal, maxVal],
            type: type
        }
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

    function removeFilter(index: number) {
        dataFilters.value.splice(index, 1);
        // When we remove a selection, we update to the max range.
        // When we remove a filter, we have other items in place in the mosaicSelectionStore to update the range.
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

    function clearAllFilters() {
        dataFilters.value = [];
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
        removeFilter,
        convertToFilters
    }


})

