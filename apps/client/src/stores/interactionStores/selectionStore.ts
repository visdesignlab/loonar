import { defineStore } from 'pinia';
import * as vg from '@uwdata/vgplot';
import mitt from 'mitt';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useCellMetaData } from '../dataStores/cellMetaDataStore';
import type { Track } from '../dataStores/cellMetaDataStore';

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

function median(values: number[]) {
    if (values.length === 0) return 0; // Handle empty array

    // Sort the array in ascending order
    values.sort((a, b) => a - b);

    const middle = Math.floor(values.length / 2);

    // If the length is odd, return the middle element
    if (values.length % 2 !== 0) {
        return values[middle];
    }

    // If the length is even, return the average of the two middle elements
    return (values[middle - 1] + values[middle]) / 2;
}

function checkSelection(selection: DataSelection, track: Track) {
    if (selection.type === 'cell') {
        const valuesForPlotName = track.cells.map(
            (cell) => cell.attrNum[selection.plotName]
        );
        const max_value = Math.max(...valuesForPlotName);
        const min_value = Math.min(...valuesForPlotName);

        // Intersects with selected
        // Checks if max value and min value make track fall outside of range
        // This is the same logic used in the SQL query predicate for updating track level selection.
        return !(
            max_value <= selection.range[0] || min_value >= selection.range[1]
        );
    } else if (selection.type === 'track') {
        // Split plot name. Track level attributes come as 'AVG column name', so we get the first item in the split as the aggregate function
        const [aggregate, ...rest] = selection.plotName.split(' ');
        //Join the rest, which will be the original column name
        const originalColumn = rest.join(' ');
        //Get the values for that column
        const valuesForPlotName = track.cells.map(
            (cell) => cell.attrNum[originalColumn]
        );

        let aggregateValue;
        // Based on aggregate function, compute different aggregate values
        switch (aggregate) {
            case 'AVG':
                aggregateValue =
                    valuesForPlotName.reduce((sum, value) => sum + value, 0) /
                    valuesForPlotName.length;
                break;
            case 'MAX':
                aggregateValue = Math.max(...valuesForPlotName);
                break;
            case 'MIN':
                aggregateValue = Math.min(...valuesForPlotName);
                break;
            case 'SUM':
                aggregateValue = valuesForPlotName.reduce(
                    (sum, value) => sum + value,
                    0
                );
                break;
            case 'COUNT':
                aggregateValue = valuesForPlotName.length;
                break;
            case 'MEDIAN':
                aggregateValue = median(valuesForPlotName);
                break;
            default:
                //Defaults to just average
                aggregateValue =
                    valuesForPlotName.reduce((sum, value) => sum + value, 0) /
                    valuesForPlotName.length;
        }
        return (
            aggregateValue <= selection.range[1] &&
            aggregateValue >= selection.range[0]
        );
    }
    return true;
}

export const useSelectionStore = defineStore('Selection', {
    state: () => ({
        dataSelections: [] as DataSelection[],
        dataFilters: [] as DataSelection[],
    }),
    getters: {
        modifiedSelections: (state) => {
            return state.dataSelections.filter(
                (s) =>
                    s.range[0] !== s.maxRange[0] || s.range[1] !== s.maxRange[1]
            );
        },
        selectedTrackingIds: (state) => {
            const cellMetaData = useCellMetaData();
            const selectedTrackIds: string[] = [];
            cellMetaData.trackArray?.forEach((track) => {
                let selected = true;
                state.dataSelections.forEach((selection) => {
                    selected = selected && checkSelection(selection, track);
                });
                if (selected) {
                    selectedTrackIds.push(track.trackId);
                }
            });
            return state.dataSelections.length === 0 ? null : selectedTrackIds;
        },
        unfilteredTrackingIds: (state) => {
            const cellMetaData = useCellMetaData();
            const unfilteredTrackIds: string[] = [];
            cellMetaData.trackArray?.forEach((track) => {
                let unfiltered = true;
                state.dataFilters.forEach((filter) => {
                    unfiltered = unfiltered && checkSelection(filter, track);
                });
                if (unfiltered) {
                    unfilteredTrackIds.push(track.trackId);
                }
            });
            return state.dataFilters.length === 0 ? null : unfilteredTrackIds;
        },
    },
    actions: {
        addSelection(selection: DataSelection) {
            const existingIndex = this.dataSelections.findIndex(
                (s) => s.plotName === selection.plotName
            );
            if (existingIndex !== -1) {
                this.dataSelections[existingIndex] = selection;
            } else {
                this.dataSelections.push(selection);
            }
        },
        clearAllSelections() {
            this.dataSelections = [];
        },
        resetSelection(index: number) {
            this.dataSelections[index].range = [
                ...this.dataSelections[index].maxRange,
            ];
        },
        updateSelection(
            plotName: string,
            range: [number, number],
            type?: DataSelection['type']
        ) {
            const existingIndex = this.dataSelections.findIndex(
                (s) => s.plotName === plotName
            );
            if (existingIndex !== -1) {
                this.dataSelections[existingIndex].range = range;
            } else {
                this.addSelection({
                    plotName,
                    range,
                    type: type ?? 'cell', // Default value
                    maxRange: [...range], // Using the provided range as maxRange
                    displayChart: true, // Default value
                });
            }
        },
        removeFilterByPlotName(plotName: string) {
            const index = this.dataFilters.findIndex(
                (s) => s.plotName === plotName
            );
            if (index === -1) return;
            // window.dispatchEvent(
            //     new CustomEvent('filterRemoved', { detail: plotName })
            // );
            this.removeFilter(index);
        },
        removeSelectionByPlotName(plotName: string) {
            const index = this.dataSelections.findIndex(
                (s) => s.plotName === plotName
            );
            if (index !== -1) {
                this.dataSelections.splice(index, 1);
            }
        },
        removePlotWithErrors(plotName: string) {
            const index = this.dataSelections.findIndex(
                (s) => s.plotName === plotName
            );
            if (index === -1) return;
            this.dataSelections.splice(index, 1);
        },
        resetSelectionByPlotName(plotName: string) {
            const index = this.dataSelections.findIndex(
                (s) => s.plotName === plotName
            );
            if (index === -1) return;
            // window.dispatchEvent(
            //     new CustomEvent('selectionRemoved', { detail: plotName })
            // );
            this.resetSelection(index);
        },
        getSelection(name: string): DataSelection | null {
            const s = this.dataSelections.find(
                (s: DataSelection) => s.plotName === name
            );
            if (typeof s === 'undefined') return null;
            return s;
        },
        addPlot(name: string, type: DataSelection['type']) {
            const existingIndex = this.dataSelections.findIndex(
                (s) => s.plotName === name
            );
            if (existingIndex !== -1) {
                const existingPlot = this.dataSelections[existingIndex];
                if (existingPlot.type !== type) {
                    console.warn(
                        `Changing type of plot "${name}" from "${existingPlot.type}" to "${type}"`
                    );
                    existingPlot.type = type;
                    this.setMaxRange(name);
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
            this.dataSelections.push(selection);
            this.setMaxRange(name);
        },
        async getMaxRange(plotName: string): Promise<[number, number]> {
            const selection = this.getSelection(plotName);
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
        },
        async setMaxRange(plotName: string) {
            const selection = this.getSelection(plotName);
            if (selection === null) {
                throw Error(`Selection ${plotName} does not exist`);
            }
            const [minVal, maxVal] = await this.getMaxRange(plotName);
            selection.range = [minVal, maxVal];
            selection.maxRange = [minVal, maxVal];
        },
        addFilter(filter: DataSelection) {
            const existingIndex = this.dataFilters.findIndex(
                (s) => s.plotName === filter.plotName
            );
            if (existingIndex !== -1) {
                this.dataFilters[existingIndex] = filter;
            } else {
                this.dataFilters.push(filter);
            }
        },
        removeFilter(index: number) {
            this.dataFilters.splice(index, 1);
        },
        updateFilter(
            plotName: string,
            range: [number, number],
            type?: DataSelection['type']
        ) {
            const existingIndex = this.dataFilters.findIndex(
                (s) => s.plotName === plotName
            );
            if (existingIndex !== -1) {
                this.dataFilters[existingIndex].range = range;
            } else {
                this.addFilter({
                    plotName,
                    range,
                    type: type ?? 'cell',
                    maxRange: [0, 1000],
                    displayChart: true,
                });
            }
        },
        clearAllFilters() {
            this.dataFilters = [];
        },
    },
});
