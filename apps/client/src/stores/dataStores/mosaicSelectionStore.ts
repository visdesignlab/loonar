import { defineStore, storeToRefs } from 'pinia';
import * as vg from '@uwdata/vgplot';
import { watch, ref, type Ref, computed } from 'vue';
import {
    useSelectionStore,
    type DataSelection,
} from '@/stores/interactionStores/selectionStore';
import { useDatasetSelectionStore } from './datasetSelectionUntrrackedStore';

import _ from 'lodash-es';
import { useConditionSelectorStore } from '../componentStores/conditionSelectorStore';
import { debounce } from 'lodash-es';

interface Clause {
    source: string;
    predicate: string | null;
}

interface ConditionChartSelection {
    baseSelection: any;
    filteredSelection: any;
}

/**
 * Mosaic Selection: This is the selection that handles the general filtering for the "Filter" sidebar. Any VG plot can filter by this selection to automatically receive updates when the selection is updated.
 *
 * Update Mosaic Selection: This is called by any input that is meant to update the mosaic selection. This will automatically dispatch updates to further selections. If range is null, then the selection will be cleared.
 *
 * Add ConditionChart Selection: Called when we render each condition chart. This sets up the base selection clause.
 *
 * Clear Mosaic Selection: Helper function to clear by source.
 */


interface MosaicSelectionState {
    cellLevelSelection: Ref<any>,
    trackLevelSelection: Ref<any>,
    conditionChartSelectedParams: Record<string, any>,
    previousDataSelections: DataSelection[],
    conditionChartSelectionsInitialized: Ref<boolean>


}

const initialState = (): MosaicSelectionState => ({
    cellLevelSelection: ref<any>(vg.Selection.intersect()),
    trackLevelSelection: ref<any>(vg.Selection.intersect()),
    conditionChartSelectedParams: {},
    conditionChartSelectionsInitialized: ref<boolean>(false),
    previousDataSelections: []
})


export const useMosaicSelectionStore = defineStore('cellLevelSelection', () => {

    const $yAxisParam = vg.Param.value([0, 2000]);

    // Initial state
    let {
        cellLevelSelection,
        trackLevelSelection,
        conditionChartSelectedParams,
        conditionChartSelectionsInitialized,
        previousDataSelections
    } = initialState()

    // Reset state function
    function resetState(): void {
        let newState = initialState();
        cellLevelSelection.value = newState.cellLevelSelection.value;
        trackLevelSelection.value = newState.trackLevelSelection.value;
        conditionChartSelectedParams = newState.conditionChartSelectedParams;
        conditionChartSelectionsInitialized.value = newState.conditionChartSelectionsInitialized.value
        previousDataSelections = newState.previousDataSelections
    }

    const selectionStore = useSelectionStore();
    const { dataSelections } = storeToRefs(selectionStore);
    const conditionSelectorStore = useConditionSelectorStore();

    const datasetSelectionStore = useDatasetSelectionStore();
    const { experimentDataInitialized, currentExperimentMetadata } = storeToRefs(datasetSelectionStore);

    watch(experimentDataInitialized, () => {
        resetState();
    })


    const conditionChartSelections = computed(
        (): Record<string, ConditionChartSelection> => {
            const keysList = Object.keys(
                conditionSelectorStore.currentExperimentTags
            );
            let tempConditionChartSelections: Record<
                string,
                ConditionChartSelection
            > = {};
            for (let i = 0; i < keysList.length; i++) {
                const currKey = keysList[i];
                const currValues =
                    conditionSelectorStore.currentExperimentTags[currKey];

                for (let j = i; j < keysList.length; j++) {
                    //Compare currValues with all other lists
                    const compareKey = keysList[j];
                    const compareValues =
                        conditionSelectorStore.currentExperimentTags[
                        compareKey
                        ];

                    currValues.forEach((currValue: string) => {
                        compareValues.forEach((compareValue: string) => {
                            // Create new selection based on comparison
                            const newSelection = vg.Selection.intersect();
                            const newSource = `${currKey}-${currValue}_${compareKey}-${compareValue}`;

                            const reversedSource = `${compareKey}-${compareValue}_${currKey}-${currValue}`;
                            const clause: Clause = {
                                source: newSource,
                                predicate: `"${currKey}" = '${currValue}' AND "${compareKey}" = '${compareValue}'`,
                            };

                            // Update this for new track level attributes
                            newSelection.update(clause);
                            const conditionChartSelection: ConditionChartSelection =
                            {
                                baseSelection: newSelection,
                                filteredSelection: newSelection.clone(),
                            };

                            tempConditionChartSelections[newSource] =
                                conditionChartSelection;
                            tempConditionChartSelections[reversedSource] =
                                conditionChartSelection;
                        });
                    });
                }
            }

            return tempConditionChartSelections;
        }
    );

    // Subscribe to DataSelections. Waits for Condition Chart selections to be initialized.
    watch(
        [dataSelections, conditionChartSelections],

        debounce(([newDataSelections, newConditionChartSelections]) => {
            if (Object.keys(newConditionChartSelections).length > 0) {
                // Track Changes in number of plots
                let previousPlots = previousDataSelections.map(
                    (entry) => entry.plotName
                );

                // In shared plots, get different ranges
                newDataSelections.forEach((entry: any) => {
                    const currPlotName = entry.plotName;
                    if (
                        entry.range[0] !== -Infinity &&
                        entry.range[1] !== -Infinity
                    ) {
                        if (previousPlots.includes(currPlotName)) {
                            const previousSelection =
                                previousDataSelections.find(
                                    (tempPrevSelection) =>
                                        tempPrevSelection.plotName ===
                                        currPlotName
                                );
                            if (
                                previousSelection &&
                                !_.isEqual(previousSelection.range, entry.range)
                            ) {
                                // Call update with new range
                                updateMosaicSelection(
                                    currPlotName,
                                    entry.range,
                                    entry.type
                                );
                            }
                            // Remove Name from previousPlots
                            previousPlots = previousPlots.filter(
                                (plotName) => plotName !== currPlotName
                            );
                        } else {
                            // Update with new plot source

                            updateMosaicSelection(
                                currPlotName,
                                entry.range,
                                entry.type
                            );
                        }
                    }
                });

                // If greater than 0, means previous dataSelections has a selection no longer around.
                if (previousPlots.length > 0) {
                    previousPlots.forEach((prevPlotName) => {
                        const previousSelection = previousDataSelections.find(
                            (tempPrevSelection) =>
                                tempPrevSelection.plotName === prevPlotName
                        );

                        // Update mosaic with the given max range
                        if (previousSelection) {
                            updateMosaicSelection(
                                previousSelection.plotName,
                                previousSelection.maxRange,
                                previousSelection.type
                            );
                        }
                    });
                }

                previousDataSelections = _.cloneDeep(newDataSelections);
            }

        }, 0),
        { deep: true, immediate: true }
    );

    // Used to watch when selectedGrid changes
    watch(conditionSelectorStore.selectedGrid, (newSelectedGrid) => {

        // Whenever selected Grid Changes, change
    });

    function _escapeSource(source: string) {
        return `"${source.replace(/"/g, '""')}"`;
    }

    // Called when a slider input needs to update selection
    function updateMosaicSelection(
        plotName: string,
        range: [number, number] | null = null,
        type: DataSelection['type']
    ) {
        //

        const escapedSource = _escapeSource(plotName);
        let cellPredicate;
        let trackPredicate;


        if (type === 'cell') {
            // If cell, base only on range
            cellPredicate = range
                ? `${escapedSource} BETWEEN ${range[0]} AND ${range[1]}`
                : null;

            trackPredicate = null;

            // This filters out any data that DOESN'T have a max or min of the current value falling into the band.
            trackPredicate = range
                ? `NOT ( "MAX ${plotName}" <= ${range[0]} OR "MIN ${plotName}" >= ${range[1]} )`
                : null;

        } else if (type == 'track') {
            // If track, we filter by tracking IDs

            // Get ID Column
            const id_column =
                currentExperimentMetadata.value?.headerTransforms?.['id'];

            // Aggregate Table Name
            const table_name = `${currentExperimentMetadata.value?.name}_composite_experiment_cell_metadata_aggregate`;

            // Predicate has a subquery to pull IDs from aggregate table fitting the range
            cellPredicate = range
                ? `"${id_column}" IN (SELECT tracking_id FROM ${table_name} WHERE ${escapedSource} between ${range[0]} and ${range[1]} )`
                : null;

            trackPredicate = range ? `${escapedSource} between ${range[0]} and ${range[1]}` : null;
        } else {
            cellPredicate = null;
            trackPredicate = null;
        }

        const cellClause = {
            source: plotName,
            predicate: cellPredicate,
        };

        const trackClause = {
            source: plotName,
            predicate: trackPredicate
        }
        trackLevelSelection.value.update(trackClause);
        cellLevelSelection.value.update(cellClause);
        _updateConditionChartSelections(cellClause);
    }

    function _updateConditionChartSelections(clause: Clause) {
        Object.values(conditionChartSelections.value).forEach(
            (selectionObject: ConditionChartSelection) => {
                selectionObject.filteredSelection.update(clause);
            }
        );
    }

    function updateOpacityParam(source: string, value: number) {
        conditionChartSelectedParams[source].update(value);
    }

    function updateOpacityParamAll(value: number) {
        Object.values(conditionChartSelectedParams).forEach((param: any) => {
            param.update(value);
        });
    }

    return {
        cellLevelSelection,
        trackLevelSelection,
        conditionChartSelections,
        conditionChartSelectionsInitialized,
        updateMosaicSelection,
        updateOpacityParam,
        updateOpacityParamAll,
        $yAxisParam
    };
});
