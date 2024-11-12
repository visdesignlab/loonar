import { defineStore, storeToRefs } from 'pinia';
import * as vg from '@uwdata/vgplot';
import mitt from 'mitt';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import type { Track } from '../dataStores/cellMetaDataStore';
import { ref, computed, watch } from 'vue';


export interface DataSelection {
    plotName: string;
    type: 'cell' | 'track' | 'lineage'; // Unused, but will be needed if we have track-level and lineage-level attributes here
    range: [number, number]; // The current range selected
    maxRange: [number, number]; // The maximum range of the data
    displayChart: boolean; // controls if the chart is shown or not, true by default
}

type Events = {
    'plot-error': string;
};

export const emitter = mitt<Events>();
//const emit = defineEmits(['plot-error']);



function getPredicate(selection: DataSelection) {
    if (selection.type === 'cell') {
        return `NOT ("MAX ${selection.plotName}" <= ${selection.range[0]} OR "MIN ${selection.plotName}" >= ${selection.range[1]})`
    } else if (selection.type === 'track') {
        return `"${selection.plotName}" >= ${selection.range[0]} AND "${selection.plotName}" <= ${selection.range[1]}`
    }
    return true;
}

export const useSelectionStore = defineStore('selectionStore', () => {

    const dataSetSelectionStore = useDatasetSelectionStore();
    const { currentExperimentMetadata, currentLocationMetadata } = storeToRefs(dataSetSelectionStore);

    // const aggregateTableName = `${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata_aggregate`


    const dataSelections = ref<DataSelection[]>([]);
    const dataFilters = ref<DataSelection[]>([]);
    const selectedTrackingIds = ref<string[] | null>(null);
    const unfilteredTrackingIds = ref<string[] | null>(null);

    const modifiedSelections = computed<DataSelection[]>(() => {
        return dataSelections.value.filter(
            (s) =>
                s.range[0] !== s.maxRange[0] || s.range[1] !== s.maxRange[1]
        );
    })

    interface TrackingIdQueryResult {
        id: string
    }

    // Watch variable for getting selections
    watch([dataSelections, dataFilters], async ([newDataSelections, newDataFilters]) => {
        const queryPrefix = `
            SELECT CAST(tracking_id as VARCHAR) AS id
            FROM ${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata_aggregate
            WHERE location = '${currentLocationMetadata?.value?.id}'
        `;

        const selectionPredicate = newDataSelections.map(selection => getPredicate(selection)).join(' AND ');

        if (selectionPredicate.length > 0) {
            const selectionQuery = `${queryPrefix} AND ${selectionPredicate}`;
            const selectionRes: TrackingIdQueryResult[] = await vg.coordinator().query(selectionQuery, { 'type': 'json' });
            selectedTrackingIds.value = selectionRes.map((entry: TrackingIdQueryResult) => entry.id);
        } else {
            selectedTrackingIds.value = null;
        }


        const filterPredicate = newDataFilters.map(filter => getPredicate(filter)).join(' AND ');

        if (filterPredicate.length > 0) {
            const filterQuery = `${queryPrefix} AND ${filterPredicate}`;
            const filterRes: TrackingIdQueryResult[] = await vg.coordinator().query(filterQuery, { 'type': 'json' });
            unfilteredTrackingIds.value = filterRes.map((entry: TrackingIdQueryResult) => entry.id);
        } else {
            unfilteredTrackingIds.value = null;
        }


    }, { deep: true })



    // Private
    function _resetSelection(index: number) {
        dataSelections.value[index].range = [
            ...dataSelections.value[index].maxRange,
        ];
    }

    // Private
    async function _getMaxRange(plotName: string): Promise<[number, number]> {
        const selection = getSelection(plotName);
        if (!selection) {
            throw new Error(`Selection "${plotName}" does not exist.`);
        }
        const { currentExperimentMetadata } = useDatasetSelectionStore();

        try {
            // Loading
            let minVal = -Infinity;
            let maxVal = Infinity;

            if (!plotName || plotName.trim() === '') {
                throw new Error('Invalid or empty plot name');
            }

            // Escape the column name to handle spaces and special characters
            const escapedPlotName = `${plotName.replace(/"/g, '""')}`;

            let query = '';
            if (selection.type === 'cell') {
                query = `
            SELECT
                MIN("${escapedPlotName}") AS min_value,
                MAX("${escapedPlotName}") AS max_value
            FROM ${currentExperimentMetadata?.name}_composite_experiment_cell_metadata
        `;
            } else if (selection.type === 'track') {
                query = `
            SELECT
                MIN("${escapedPlotName}") AS min_value,
                MAX("${escapedPlotName}") AS max_value
            FROM ${currentExperimentMetadata?.name}_composite_experiment_cell_metadata_aggregate
        `;
            } else {
                throw new Error(
                    `Unknown type "${selection.type}" for plot "${plotName}"`
                );
            }

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

    // Private
    async function _setMaxRange(plotName: string) {
        const selection = getSelection(plotName);
        if (selection === null) {
            throw Error(`Selection ${plotName} does not exist`);
        }
        const [minVal, maxVal] = await _getMaxRange(plotName);
        selection.range = [minVal, maxVal];
        selection.maxRange = [minVal, maxVal];
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

    function updateSelection(
        plotName: string,
        range: [number, number],
        type?: DataSelection['type']
    ) {
        const existingIndex = dataSelections.value.findIndex(
            (s) => s.plotName === plotName
        );
        if (existingIndex !== -1) {
            dataSelections.value[existingIndex].range = range;
        } else {
            addSelection({
                plotName,
                range,
                type: type ?? 'cell', // Default value
                maxRange: [...range], // Using the provided range as maxRange
                displayChart: true, // Default value
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
        }
    }

    function removePlotWithErrors(plotName: string) {
        const index = dataSelections.value.findIndex(
            (s) => s.plotName === plotName
        );
        if (index === -1) return;
        dataSelections.value.splice(index, 1);
    }

    function resetSelectionByPlotName(plotName: string) {
        const index = dataSelections.value.findIndex(
            (s) => s.plotName === plotName
        );
        if (index === -1) return;
        // window.dispatchEvent(
        //     new CustomEvent('selectionRemoved', { detail: plotName })
        // );
        _resetSelection(index);
    }

    function getSelection(name: string): DataSelection | null {
        const s = dataSelections.value.find(
            (s: DataSelection) => s.plotName === name
        );
        if (typeof s === 'undefined') return null;
        return s;
    }

    function addPlot(name: string, type: DataSelection['type']) {
        const existingIndex = dataSelections.value.findIndex(
            (s) => s.plotName === name
        );
        if (existingIndex !== -1) {
            const existingPlot = dataSelections.value[existingIndex];
            if (existingPlot.type !== type) {
                console.warn(
                    `Changing type of plot "${name}" from "${existingPlot.type}" to "${type}"`
                );
                existingPlot.type = type;
                _setMaxRange(name);
            }
            return;
        }
        const selection: DataSelection = {
            plotName: name,
            range: [-Infinity, Infinity],
            maxRange: [-Infinity, Infinity],
            type: type,
            displayChart: true,
        };
        dataSelections.value.push(selection);
        _setMaxRange(name);
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
                maxRange: [0, 1000],
                displayChart: true,
            });
        }
    }

    function clearAllFilters() {
        dataFilters.value = [];
    }

    return {
        dataSelections,
        dataFilters,
        modifiedSelections,
        selectedTrackingIds,
        unfilteredTrackingIds,
        clearAllSelections,
        updateSelection,
        updateFilter,
        clearAllFilters,
        removeSelectionByPlotName,
        removeFilterByPlotName,
        removePlotWithErrors,
        resetSelectionByPlotName,
        addPlot,
        getSelection,
        addFilter,
        removeFilter
    }


})

