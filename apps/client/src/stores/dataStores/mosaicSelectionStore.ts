import { defineStore, storeToRefs } from 'pinia';
import * as vg from '@uwdata/vgplot';
import { watch, ref, type Ref, computed } from 'vue';
import {
    useSelectionStore,
    type DataSelection,
    type AttributeChart
} from '@/stores/interactionStores/selectionStore';
import { useDatasetSelectionStore } from './datasetSelectionUntrrackedStore';

import _ from 'lodash-es';
import { useConditionSelectorStore } from '../componentStores/conditionSelectorStore';
import {
    getPredicateSelectionComposite,
    getPredicateSelectionAgg,
    getPredicateFilterComposite,
    getPredicateFilterAgg
} from '@/util/predicateGenerator';

interface ConditionChartSelection {
    baseSelection: any;
    filteredSelection: any;
}

interface LoonarClause {
    source: string;
    predicate: string | null;
}

interface QueryResult {
    id: string;
}

interface RangeResult {
    source: string;
    max_value: string;
    min_value: string;
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
    cellLevelFilter: Ref<any>,
    trackLevelFilter: Ref<any>,
    previousDataSelections: DataSelection[],
    previousDataFilters: DataSelection[],
    conditionChartSelectionsInitialized: Ref<boolean>
    highlightedCellIds: Ref<string[] | null>,
    unfilteredTrackIds: Ref<string[] | null>
    $conditionChartYAxisDomain: Ref<any>,
    compSelClauseList: Ref<LoonarClause[]>,
    aggSelClauseList: Ref<LoonarClause[]>,
    compFilClauseList: Ref<LoonarClause[]>,
    aggFilClauseList: Ref<LoonarClause[]>,
}


const initialState = (): MosaicSelectionState => ({
    cellLevelSelection: ref<any>(vg.Selection.intersect()),
    trackLevelSelection: ref<any>(vg.Selection.intersect()),
    cellLevelFilter: ref<any>(vg.Selection.intersect()),
    trackLevelFilter: ref<any>(vg.Selection.intersect()),
    conditionChartSelectionsInitialized: ref<boolean>(false),
    previousDataSelections: [],
    previousDataFilters: [],
    highlightedCellIds: ref<string[] | null>(null),
    unfilteredTrackIds: ref<string[] | null>(null),
    $conditionChartYAxisDomain: ref<any>(vg.Param.value([0, 10000])),
    compSelClauseList: ref<LoonarClause[]>([]),
    aggSelClauseList: ref<LoonarClause[]>([]),
    compFilClauseList: ref<LoonarClause[]>([]),
    aggFilClauseList: ref<LoonarClause[]>([]),
})


export const useMosaicSelectionStore = defineStore('cellLevelSelection', () => {


    // Initial state
    let {
        cellLevelSelection,
        trackLevelSelection,
        cellLevelFilter,
        trackLevelFilter,
        conditionChartSelectionsInitialized,
        previousDataSelections,
        previousDataFilters,
        highlightedCellIds,
        unfilteredTrackIds,
        compSelClauseList,
        aggSelClauseList,
        compFilClauseList,
        aggFilClauseList,
    } = initialState()

    // Reset state function
    function resetState(): void {
        let newState = initialState();
        cellLevelSelection.value = newState.cellLevelSelection.value;
        trackLevelSelection.value = newState.trackLevelSelection.value;
        cellLevelFilter.value = newState.cellLevelFilter.value;
        trackLevelFilter.value = newState.trackLevelFilter.value;
        conditionChartSelectionsInitialized.value = newState.conditionChartSelectionsInitialized.value;
        previousDataSelections = newState.previousDataSelections;
        previousDataFilters = newState.previousDataFilters;
        highlightedCellIds.value = newState.highlightedCellIds.value;
        unfilteredTrackIds.value = newState.unfilteredTrackIds.value;
        compSelClauseList.value = newState.compSelClauseList.value;
        aggSelClauseList.value = newState.aggSelClauseList.value;
        compFilClauseList.value = newState.compFilClauseList.value;
        aggFilClauseList.value = newState.aggFilClauseList.value;
    }


    let $conditionChartYAxisDomain = vg.Param.value([0, 2000])


    const selectionStore = useSelectionStore();
    const { dataSelections, dataFilters, attributeCharts } = storeToRefs(selectionStore);
    const conditionSelectorStore = useConditionSelectorStore();

    const datasetSelectionStore = useDatasetSelectionStore();
    const { experimentDataInitialized, currentExperimentMetadata, currentLocationMetadata } = storeToRefs(datasetSelectionStore);



    watch([experimentDataInitialized, conditionChartSelectionsInitialized], ([isInitialized, isConditionChartInitialized]) => {
        if (isInitialized && isConditionChartInitialized) {
            _updateConditionChartsDomain();
        }
    })


    // Object containing all condition chart selections
    // Indexed by unique key containing the tag labels and values
    // When we add "tag1-A_tab2-B", we also add "tag2-B_tag1-A" with the reference to the same selection
    // This is so we can easily grab the selection regardless of the orientation of the condition
    // chart matrix.
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
                            const clause: LoonarClause = {
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
            conditionChartSelectionsInitialized.value = true;
            return tempConditionChartSelections;
        }
    );


    /* -------------------------------------------------
    -------- SELECTION AND FILTER SUBSCRIPTIONS --------
    ------------------------------------------------- */

    const compSelPredString = computed(() =>
        _clauseListToPredString(compSelClauseList.value)
    )

    const aggSelPredString = computed(() =>
        _clauseListToPredString(aggSelClauseList.value)
    )

    const compFilPredString = computed(() =>
        _clauseListToPredString(compFilClauseList.value)
    )

    const aggFilPredString = computed(() =>
        _clauseListToPredString(aggFilClauseList.value)
    )



    watch([dataSelections, dataFilters, conditionChartSelections], ([newDataSelections, newDataFilters, newConditionChartSelections]) => {
        if (Object.keys(newConditionChartSelections).length > 0) {
            // Update existing or new
            newDataSelections.forEach(selection => {
                const compositePredicate = getPredicateSelectionComposite(selection);
                const compClause = {
                    source: selection.plotName,
                    predicate: compositePredicate
                }
                _updatePredicate(compSelClauseList.value, compClause);

                const aggregatePredicate = getPredicateSelectionAgg(selection);
                const aggClause = {
                    source: selection.plotName,
                    predicate: aggregatePredicate
                }

                _updatePredicate(aggSelClauseList.value, aggClause);
            })


            // Update existing or new
            newDataFilters.forEach(filter => {
                const compositePredicate = getPredicateFilterComposite(filter);
                const compClause = {
                    source: `${filter.plotName}_filter`,
                    predicate: compositePredicate
                }
                _updatePredicate(compFilClauseList.value, compClause);

                const aggregatePredicate = getPredicateFilterAgg(filter);
                const aggClause = {
                    source: `${filter.plotName}_filter`,
                    predicate: aggregatePredicate
                }
                _updatePredicate(aggFilClauseList.value, aggClause);
            })

            // All selections removed
            const removedSelections = previousDataSelections.filter(entry => {
                return !newDataSelections.map(newEntry => newEntry.plotName).includes(entry.plotName)
            })

            // All filters removed
            const removedFilters = previousDataFilters.filter(entry => {
                return !newDataFilters.map(newEntry => newEntry.plotName).includes(entry.plotName)
            });

            // Set predicates to null for all removed selections.
            removedSelections.forEach(removedSelection => {
                const clause = { source: removedSelection.plotName, predicate: null }
                _updatePredicate(compSelClauseList.value, clause);
                _updatePredicate(aggSelClauseList.value, clause);
            })

            // Set predicates to null for all removed filters.
            removedFilters.forEach(removedFilter => {
                const clause = { source: `${removedFilter.plotName}_filter`, predicate: null }
                _updatePredicate(compFilClauseList.value, clause);
                _updatePredicate(aggFilClauseList.value, clause);
            })

            previousDataSelections = _.cloneDeep(newDataSelections);
            previousDataFilters = _.cloneDeep(newDataFilters);
        }


    }, { deep: true, immediate: true })



    /* -------------------------------------------------
    --------------- CLAUSE SUBSCRIPTIONS ---------------
    ------------------------------------------------- */

    /*
    NOTE:

    For some reason, we can't pass our clause interface directly into update functions. We need to unpack them. I'm not sure why this is.
    */

    // Watch for selection clause changes
    watch([
        compSelClauseList,
        aggSelClauseList,
    ], ([
        newCompSelList,
        newAggSelList,
    ]) => {
        newCompSelList.forEach((clause: LoonarClause) => {
            cellLevelSelection.value.update({ ...clause });
            _updateConditionChartSelections({ ...clause });
        })


        newAggSelList.forEach((clause: LoonarClause) => {
            trackLevelSelection.value.update({ ...clause });
        })

        _updateConditionChartsDomain();
        _updateStandardHighlightOrFilter(false)

    }, { deep: true })

    // Watch for filter clause changes
    watch([
        compFilClauseList,
        aggFilClauseList
    ], ([
        newCompFilList,
        newAggFilList
    ]) => {

        newCompFilList.forEach((clause: LoonarClause) => {
            cellLevelSelection.value.update({ ...clause });
            cellLevelFilter.value.update({ ...clause });
            _updateConditionChartSelections({ ...clause }, true);
        })

        newAggFilList.forEach((clause: LoonarClause) => {
            trackLevelSelection.value.update({ ...clause });
            trackLevelFilter.value.update({ ...clause });
        })

        _updateConditionChartsDomain();
        _updateStandardHighlightOrFilter(true)
        _updateAttributeChartRanges();


    }, { deep: true })


    // Used to watch when selectedGrid changes
    watch(conditionSelectorStore.selectedGrid, (newSelectedGrid) => {

        // Whenever selected Grid Changes, change
    });



    /* -------------------------------------------------
    ----------------- UPDATE FUNCTIONS -----------------
    ------------------------------------------------- */
    async function _updateAttributeChartRanges() {

        const compFilPredicate = compFilPredString.value;
        const aggFilPredicate = aggFilPredString.value;

        const promiseList: Promise<any>[] = [];
        attributeCharts.value.forEach(chart => {

            const { plotName, type } = chart;

            // Use appropriate predicate.
            let predicate = ``
            if (type === 'cell') {
                if (compFilPredicate) {
                    predicate = `WHERE ${compFilPredicate}`
                }
            } else if (type === 'track') {
                if (aggFilPredicate) {
                    predicate = `WHERE ${aggFilPredicate}`
                }
            }


            // Table Prefix
            const tableNamePrefix =
                `${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata`
            // Generate correct table name
            const tableName =
                type === 'cell' ? tableNamePrefix : `${tableNamePrefix}_aggregate`

            const query = `
                SELECT 
                    '${plotName}' as source,
                    CAST(MIN("${plotName}") AS VARCHAR) as min_value,
                    CAST(MAX("${plotName}") AS VARCHAR) as max_value
                FROM ${tableName}
                ${predicate}
            `
            promiseList.push(
                vg.coordinator().query(query, { 'type': 'json' })
            )
        });

        // Wait for all promises to resolve
        try {
            const results = await Promise.all(promiseList);
            // Process the results as needed

            results.forEach((resultList: RangeResult[]) => {
                const result = resultList[0];
                let correspondingPlot = attributeCharts.value.find((chart: AttributeChart) => chart.plotName === result.source);
                if (correspondingPlot) {
                    correspondingPlot.maxRange = [parseFloat(result.min_value), parseFloat(result.max_value)]
                    // If there is a selection when a filter is removed, then we need to update the slider (attributeChart) range to be the same as the selection, not the max range returned from the results.

                    let correspondingSelection = dataSelections.value.find((selection: DataSelection) => selection.plotName === result.source)
                    if (correspondingSelection) {
                        correspondingPlot.range = [...correspondingSelection.range]
                    } else {
                        correspondingPlot.range = [parseFloat(result.min_value), parseFloat(result.max_value)]
                    }
                }
            })

            return results;
        } catch (error) {
            // Handle any errors that occur in the promises
            console.error('Error resolving promises:', error);
            throw error;
        }


    }

    async function _updateStandardHighlightOrFilter(
        filter?: boolean
    ) {

        const selPredicateString = filter ? aggSelPredString.value : compSelPredString.value;

        const filPredicateString = filter ? aggFilPredString.value : compFilPredString.value;

        let predicate = ``
        const predicateTuple = [selPredicateString, filPredicateString].filter(Boolean);
        if (predicateTuple.length > 0) {
            predicate = `AND ${predicateTuple.join(' AND ')}`
        }

        if (
            currentExperimentMetadata.value &&
            currentLocationMetadata.value?.id &&
            currentExperimentMetadata.value.headerTransforms
        ) {
            if (!filter) {
                // If no selections, nothing should be selected. 
                if (selPredicateString === null) {
                    highlightedCellIds.value = null;
                    return;
                }
                // When !filter, uses composite table. Still applies sel and fil predicate.

                // Generate predicate string
                // Pull id and frame column names
                const { id, frame } = currentExperimentMetadata.value.headerTransforms
                // Construct query to get all track id, frame, location combinations that satisfy predicate
                const selectionQuery = `
                    SELECT CAST("${id}" AS VARCHAR) as id, "${frame}" as frame, location
                    FROM ${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata
                    WHERE location = '${currentLocationMetadata?.value?.id}'
                    ${predicate}

                `;
                const selectionRes: QueryResult[] = await vg.coordinator().query(selectionQuery, { 'type': 'json' });

                // No need to filter out 'filtered' track ids. This is already handled by query.
                // These strings identify a particular row in the table.
                const uniqueCellIds = selectionRes.map((entry: any) => {
                    return `${entry.id}_${parseInt(entry.frame)}_${parseInt(entry.location)}`
                })

                // Update selected ids
                highlightedCellIds.value = uniqueCellIds
            } else {
                // When filter, uses aggregate table to grab track ids. Still uses ful sel and fil predicate.

                // Pull track ids from aggregate table
                const filterQuery = `
                    SELECT CAST(tracking_id as VARCHAR) AS id
                    FROM ${currentExperimentMetadata?.value?.name}_composite_experiment_cell_metadata_aggregate
                    WHERE location = '${currentLocationMetadata?.value?.id}'
                    ${predicate}
                `;
                const filterRes: QueryResult[] = await vg.coordinator().query(filterQuery, { 'type': 'json' })

                const resultIds = filterRes.map(entry => entry.id);

                // Update unfilteredTrackIds
                unfilteredTrackIds.value = resultIds;

                // Update selected cell Ids to exclude any tracks filtered out
                if (highlightedCellIds.value) {
                    highlightedCellIds.value = highlightedCellIds.value.filter((entry: any) => {
                        return resultIds.includes(entry.split('_')[0])
                    });
                }
            }
        }
    }

    function _updateConditionChartSelections(clause: LoonarClause, filter?: boolean) {
        Object.values(conditionChartSelections.value).forEach(
            (selectionObject: ConditionChartSelection) => {
                selectionObject.filteredSelection.update(clause);
                // If filtering, also apply clause to the base filter on the chart.
                if (filter) {
                    selectionObject.baseSelection.update(clause);
                }
            }
        );
    }

    async function _updateConditionChartsDomain() {

        const filPredicateString = compFilPredString.value;
        const selPredicateString = compSelPredString.value;

        const xAttributeName =
            currentExperimentMetadata.value?.headerTransforms?.frame;
        const yAttributeName =
            currentExperimentMetadata.value?.headerTransforms?.mass;

        // Catch to return early.
        if (!xAttributeName || !yAttributeName) {
            console.log('Could not get frame and mass from header transforms.')
            return;
        }
        const compositeTableName = `${currentExperimentMetadata.value?.name}_composite_experiment_cell_metadata`;
        let overallMin = Infinity;
        let overallMax = -Infinity;

        const s1Predicate = filPredicateString ? `WHERE ${filPredicateString}` : '';
        const s2Predicate = s1Predicate === '' ? selPredicateString ? `WHERE ${selPredicateString}` : '' : `${s1Predicate} AND ${selPredicateString}`;


        const query = `
                SELECT MIN(avg_value) AS min, MAX(avg_value) AS max
                FROM (
                    SELECT AVG("${yAttributeName}") AS avg_value
                    FROM "${compositeTableName}"
                    ${s1Predicate}
                    GROUP BY "${xAttributeName}", "${conditionSelectorStore.selectedXTag}", "${conditionSelectorStore.selectedYTag}"
                    UNION
                    SELECT AVG("${yAttributeName}") AS avg_value
                    FROM "${compositeTableName}"
                    ${s2Predicate}
                    GROUP BY "${xAttributeName}", "${conditionSelectorStore.selectedXTag}", "${conditionSelectorStore.selectedYTag}"
                )
            `;

        try {
            const result = await vg
                .coordinator()
                .query(query, { type: 'json' });

            if (result && Array.isArray(result) && result.length > 0) {
                const { min, max } = result[0];
                if (min !== null && min < overallMin) overallMin = min;
                if (max !== null && max > overallMax) overallMax = max;
            }
        } catch (error) {
            console.error(`Error computing domain`, error);
            throw error;
        }

        if (overallMin === Infinity || overallMax === -Infinity) {
            throw new Error('No data found for any condition.');
        }
        $conditionChartYAxisDomain.update([overallMin, overallMax]);
    }

    /* -------------------------------------------------
    ----------------- UTILITY FUNCTIONS -----------------
    ------------------------------------------------- */

    function _findClause(clauseList: LoonarClause[], source: string) {
        return clauseList.find(entry => entry.source === source);
    }

    function _updatePredicate(clauseList: LoonarClause[], clause: LoonarClause) {
        const searchedClause = _findClause(clauseList, clause.source);
        if (searchedClause) {
            searchedClause.predicate = clause.predicate;
        } else {
            clauseList.push(clause);
        }
    }

    function _clauseListToPredString(clauseList: LoonarClause[]) {
        let tempString: string | null = '';
        if (clauseList.length > 0) {
            tempString = `${clauseList.map((clause: LoonarClause) => clause.predicate).filter(Boolean).join(') AND (')}`
        }
        return tempString.trim() === "" ? null : `(${tempString})`
    }

    return {
        cellLevelSelection,
        trackLevelSelection,
        cellLevelFilter,
        trackLevelFilter,
        conditionChartSelections,
        conditionChartSelectionsInitialized,
        $conditionChartYAxisDomain,
        highlightedCellIds,
        unfilteredTrackIds,
        resetState
    };
});
