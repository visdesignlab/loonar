import { defineStore } from 'pinia';
import * as vg from '@uwdata/vgplot';
import mitt from 'mitt';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';


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

export const useSelectionStore = defineStore('Selection', {
    state: () => ({
        dataSelections: [] as DataSelection[],
    }),
    getters: {
        modifiedSelections: (state) => {
            return state.dataSelections.filter(
                (s) =>
                    s.range[0] !== s.maxRange[0] || s.range[1] !== s.maxRange[1]
            );
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
        removeSelection(index: number) {
            this.dataSelections[index].range = [
                ...this.dataSelections[index].maxRange,
            ];
        },
        updateSelection(plotName: string, range: [number, number]) {
            const existingIndex = this.dataSelections.findIndex(
                (s) => s.plotName === plotName
            );
            if (existingIndex !== -1) {
                this.dataSelections[existingIndex].range = range;
            } else {
                this.addSelection({
                    plotName,
                    range,
                    type: 'cell', // Default value
                    maxRange: [...range], // Using the provided range as maxRange
                    displayChart: true, // Default value
                });
            }
        },
        removeSelectionByPlotName(plotName: string) {
            const index = this.dataSelections.findIndex(
                (s) => s.plotName === plotName
            );
            if (index === -1) return;
            window.dispatchEvent(
                new CustomEvent('selectionRemoved', { detail: plotName })
            );
            this.removeSelection(index);
        },
        removePlotWithErrors(plotName: string) {
            const index = this.dataSelections.findIndex(
                (s) => s.plotName === plotName
            );
            if (index === -1) return;
            this.dataSelections.splice(index, 1);
        },
        getSelection(name: string): DataSelection | null {
            const s = this.dataSelections.find(
                (s: DataSelection) => s.plotName === name
            );
            if (typeof s === 'undefined') return null;
            return s;
        },
        addPlot(name: string) {
            if (
                this.dataSelections.some(
                    (s: DataSelection) => s.plotName === name
                )
            ) {
                // plot is already here, do not add again
                return;
            }
            const selection: DataSelection = {
                plotName: name,
                range: [-Infinity, Infinity],
                maxRange: [-Infinity, Infinity],
                type: 'cell',
                displayChart: true,
            };
            this.dataSelections.push(selection);
            this.setMaxRange(name);
        },
        async getMaxRange(plotName: string): Promise<[number, number]> {
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

                const query = `
                    SELECT
                        MIN("${escapedPlotName}") AS min_value,
                        MAX("${escapedPlotName}") AS max_value
                    FROM ${currentExperimentMetadata?.name}_composite_experiment_cell_metadata
                `;

                console.log('Constructed query:', query);

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
    },
});
