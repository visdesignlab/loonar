import { defineStore } from 'pinia';
import * as vg from '@uwdata/vgplot';


interface Clause {
    source: string,
    predicate: string | null
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

export const useMosaicSelectionStore = defineStore('mosaicSelection', () => {
    let mosaicSelection = vg.Selection.intersect();
    const conditionChartSelections: Record<string, any> = {};
    const conditionChartSelectedParams: Record<string, any> = {}

    function _escapeSource(source: string) {
        return `"${source.replace(/"/g, '""')}"`;
    }

    // Called when a slider input needs to update selection
    function updateMosaicSelection(plotName: string, range: [number, number] | null = null) {
        const escapedSource = _escapeSource(plotName)
        const clause = {
            source: plotName,
            predicate: range ? `${escapedSource} BETWEEN ${range[0]} AND ${range[1]}` : null
        }
        mosaicSelection.update(clause);
        _updateConditionChartSelections(clause)
    }

    function addConditionChartSelection(tags: [string, string][]) {
        const conditionChartSelection = vg.Selection.intersect();
        // Creates an opacity param
        const conditionChartSelectedParam = vg.Param.value(1);
        const source = `${tags[0][0]}-${tags[0][1]}_${tags[1][0]}-${tags[1][1]}`;
        const clause: Clause = {
            source,
            predicate: `"${tags[0][0]}" = '${tags[0][1]}' AND "${tags[1][0]}" = '${tags[1][1]}'`
        }
        conditionChartSelection.update(clause)
        // Add selection to record
        conditionChartSelections[source] = conditionChartSelection;
        // Add parameter to record
        conditionChartSelectedParams[source] = conditionChartSelectedParam;

        const conditionChartBaseSelection = conditionChartSelection.clone();
        return {
            baseSelection: conditionChartBaseSelection,
            filteredSelection: conditionChartSelection,
            opacityParam: conditionChartSelectedParam
        };
    }

    function _updateConditionChartSelections(clause: Clause) {
        Object.values(conditionChartSelections).forEach(selection => {
            selection.update(clause);
        })
    }

    function clearMosaicSource(source: string) {
        updateMosaicSelection(source);
    }

    function updateOpacityParam(source: string, value: number) {
        conditionChartSelectedParams[source].update(value)
    }

    function updateOpacityParamAll(value: number) {
        console.log(conditionChartSelectedParams);
        Object.values(conditionChartSelectedParams).forEach((param: any) => {
            param.update(value);
        })
    }


    return {
        mosaicSelection,
        updateMosaicSelection,
        addConditionChartSelection,
        clearMosaicSource,
        updateOpacityParam,
        updateOpacityParamAll
    }
});