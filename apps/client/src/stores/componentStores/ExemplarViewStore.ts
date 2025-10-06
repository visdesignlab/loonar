import { ref, watch, computed } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import * as vg from '@uwdata/vgplot';

// Aggregation imports
import { addAggregateColumn, type AggregateObject } from '@/util/datasetLoader';
import { aggregateFunctions, isCustomAggregateFunction } from '@/components/plotSelector/aggregateFunctions';

// Store imports
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';
import { useSelectionStore } from '@/stores/interactionStores/selectionStore';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import { useMosaicSelectionStore } from '@/stores/dataStores/mosaicSelectionStore';
import { until } from '@vueuse/core';

// Interfaces ------------------------------------------------------------------------

// Tracks ------------
export interface ExemplarTrack {
    trackId: string;
    locationId: string;
    minTime: number;
    maxTime: number;
    minValue: number;
    maxValue: number;
    data: Cell[];
    tags: Record<string, string>;
    p: number; // the sample position, e.g. median has p=0.5
    pinned: boolean; // true if this is a user pinned exemplar
    starred: boolean; // true if this is a user starred exemplar
    aggValue: number; // add aggValue for sorting
}
export interface Cell {
    time: number;
    trackId: string;
    frame: number;
    value: number;
    x: number;
    y: number;
    isHovered?: boolean;
    isSelected?: boolean;
}

// User request for a specific track
export interface SelectedTrackRequest {
    binRange: [number, number];
    conditionGroupKey: Record<string, string>;
}
// Track Aggregation Option (Ex: Average Mass)
interface AggregationOption {
    label: string;
    value: string;
}
// Histograms -------------------
// Histogram data for each condition pair
export interface conditionHistogram {
    condition: Record<string, string>;
    histogramData: number[];
}

// Bin ranges and domains for histograms
export interface HistogramBin {
    min: number;
    max: number;
}
export interface HistogramDomains {
    histogramBinRanges: HistogramBin[];
    // Global min and max across all histograms
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

// View Configuration - Exemplar View --------------
export interface ExemplarHorizonChartSettings {
    default: true | false;
    userModifiedNumeric: boolean;
    userModifiedColors: boolean;
    positiveColorScheme: {
        label: string;
        value: any;
    };
    negativeColorScheme: {
        label: string;
        value: any;
    };
    modHeight: number;
    baseline: number;
}
// Main user edited configuration for the Exemplar View
export interface ViewConfiguration {
    afterStarredGap: number;
    snippetSourceSize: number;
    snippetDisplayHeight: number;
    snippetDisplayWidth: number;
    snippetHorizonChartGap: number;
    horizonChartHeight: number;
    horizonChartWidth: number;
    horizonTimeBarGap: number;
    timeBarHeightOuter: number;
    timeBarHeightInner: number;
    betweenExemplarGap: number;
    betweenConditionGap: number;
    horizonHistogramGap: number;
    histogramWidth: number;
    margin: number;
    showSnippetImage: boolean;
    showSnippetOutline: boolean;
    spaceKeyFramesEvenly: boolean;
    histogramFontSize: number;
    histogramTooltipFontSize: number;
    hoveredLineWidth: number;
    histogramConditionLabelWrapFactor: number;
}

// Initializations --------------------------------------------------------------------
// Histograms, and histogram bin ranges
const conditionHistograms = ref<conditionHistogram[]>([]);
const histogramDomains = ref<HistogramDomains>({
    histogramBinRanges: [],
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
});

// Exemplar Percentile Options
const percentileOptions = [
    { label: 'Default (5th, Median, 95th)', value: [5, 50, 95] },
    { label: 'Quartiles (25th, Median, 75th)', value: [25, 50, 75] },
    { label: 'Min, Max', value: [0, 100] },
    { label: 'Min, Max, 20th, 80th', value: [0, 20, 80, 100] }
];

// Horizon Chart Color Scheme
export const horizonChartScheme = [
    '#e6e3e3', // Light Grey 1
    '#cccccc', // Light Grey 2
    '#b3b3b3', // Grey 3
    '#999999', // Grey 4
    '#808080', // Grey 5
    '#666666', // Grey 6
    '#4d4d4d', // Grey 7
    '#1a1a1a', // Grey 9
    '#000000', // Black
];

// Store Definition ------------------------------------------------------------------
/**
 * Store for exemplar view data and settings
 */
export const useExemplarViewStore = defineStore('ExemplarViewStore', () => {

    // Initializations in store -----------------------------------------------------
    // Store imports
    const datasetSelectionStore = useDatasetSelectionStore();
    const conditionSelectorStore = useConditionSelectorStore();
    const mosaicSelectionStore = useMosaicSelectionStore();

    // Data Loading state -------------
    const exemplarDataLoaded = ref<boolean>(true);

    const { experimentDataInitialized, currentExperimentMetadata } =
        storeToRefs(datasetSelectionStore);

    // Filters, condition filters
    const { aggFilPredString, conditionChartSelectionsInitialized } = storeToRefs(mosaicSelectionStore);
    const filterWhereClause = computed(() => {
        return aggFilPredString.value;
    });
    
    // Selected attributes and aggregations
    const { selectedXTag, selectedYTag } = storeToRefs(conditionSelectorStore);
    type AttrOption = string | { label?: string; value?: string };
    const selectedAttribute = ref<AttrOption | undefined>(undefined);
    const timeCol = ref<string | undefined>(undefined);
    const frameCol = ref<string | undefined>(undefined);
    const idCol = ref<string | undefined>(undefined);
    const xCol = ref<string | undefined>(undefined);
    const yCol = ref<string | undefined>(undefined);

    watch(
        [experimentDataInitialized, currentExperimentMetadata],
        ([isInitialized, metadata]) => {
            if (
                isInitialized &&
                metadata &&
                metadata.headerTransforms &&
                metadata.headerTransforms.mass
            ) {
                selectedAttribute.value = metadata.headerTransforms.mass;
                timeCol.value = metadata.headerTransforms.time;
                frameCol.value = metadata.headerTransforms.frame;
                idCol.value = metadata.headerTransforms.id;
                xCol.value = metadata.headerTransforms.x;
                yCol.value = metadata.headerTransforms.y;
            }
        },
        { immediate: true }
    );
    const selectedAttr2 = ref<string | null>(null);
    const selectedVar1 = ref<number | string | null>(null);
    const selectedAggregation = ref<AggregationOption>({
        label: 'Average',
        value: 'AVG',
    });

    // Exemplar Tracks and Percentiles
    const exemplarTracks = ref<ExemplarTrack[]>([]);
    const exemplarPercentiles = ref<number[]>(percentileOptions[0].value);

    // Histogram bin count
    const histogramBinCount = ref<number>(70);

    // View Configuration - Exemplar View -----------
    const viewConfiguration = ref<ViewConfiguration>({
        afterStarredGap: 100,
        snippetSourceSize: 80,
        snippetDisplayHeight: 80,
        snippetDisplayWidth: 80,
        snippetHorizonChartGap: 5,
        horizonChartHeight: 30,
        horizonChartWidth: 1000,
        horizonTimeBarGap: 5,
        timeBarHeightOuter: 6,
        timeBarHeightInner: 2,
        betweenExemplarGap: 20,
        betweenConditionGap: 60,
        horizonHistogramGap: 150,
        histogramWidth: 80,
        margin: 50,
        showSnippetImage: true,
        showSnippetOutline: true,
        spaceKeyFramesEvenly: true,
        histogramFontSize: 20,
        histogramTooltipFontSize: 16,
        hoveredLineWidth: 3,
        histogramConditionLabelWrapFactor: 3,
    });

    const exemplarHeight = computed(() => {
        return (
            viewConfiguration.value.snippetDisplayHeight +
            viewConfiguration.value.snippetHorizonChartGap +
            viewConfiguration.value.horizonChartHeight +
            viewConfiguration.value.horizonTimeBarGap +
            viewConfiguration.value.timeBarHeightOuter
        );
    });

    const snippetZoom = computed<number>(() => {
        return viewConfiguration.value.snippetDisplayHeight / viewConfiguration.value.snippetSourceSize;
    });

    const horizonChartSettings = ref<ExemplarHorizonChartSettings>({
        default: true,
        userModifiedNumeric: false, // Initialize as false
        userModifiedColors: false, // Initialize as false
        positiveColorScheme: { label: 'Default', value: [] },
        negativeColorScheme: { label: 'Default', value: [] },
        modHeight: 1,
        baseline: 0,
    });

    // Functions -------------------------------------------------------------
    /**
     * @returns A Map of location IDs to image URLs for the exemplar tracks.
     */
    function getExemplarImageUrls(): Map<string, string> {
        const map = new Map();
        const metadataLookup = new Map()
        for (const locationMetadata of currentExperimentMetadata.value
            ?.locationMetadataList ?? []) {
            metadataLookup.set(locationMetadata.id, locationMetadata);
        }
        for (const track of exemplarTracks.value) {
            const locationMetadata = metadataLookup.get(track.locationId);
            const url = locationMetadata?.imageDataFilename;
            if (url) {
                map.set(track.locationId, url);
            }
        }
        return map;
    }

    /**
     * @returns The total time of the entire experiment
     */
    async function getTotalExperimentTime(): Promise<number> {
        if (
            !experimentDataInitialized.value ||
            !currentExperimentMetadata.value
        ) {
            return 0;
        }

        const tableName = `${currentExperimentMetadata.value.name}_composite_experiment_cell_metadata`;

        const query = `
            SELECT MAX("${timeCol.value}") as max_time, MIN("${timeCol.value}") as min_time
            FROM "${tableName}"
        `;

        try {
            const result: { max_time: number; min_time: number }[] = await vg
                .coordinator()
                .query(query, { type: 'json' });
            if (
                result &&
                result.length > 0 &&
                result[0].max_time != null &&
                result[0].min_time != null
            ) {
                return result[0].max_time - result[0].min_time;
            } else {
                return 0;
            }
        } catch (error) {
            console.error('Error fetching total experiment time:', error);
            return 0;
        }
    }

    /**
     * 
     * @param replace True if the exemplar tracks should be replaced, false if they should be appended.
     * @param exemplarPercentiles What percentiles [0-100] the exemplar tracks are in the histogram
     * @param selectedTrackRequest Fetch a specific track based on a user request
     */
    async function getExemplarViewData(replace?: boolean, exemplarPercentiles?: number[], selectedTrackRequest?: SelectedTrackRequest): Promise<void> {
        // Wait for selectedAttribute and time column to be set
        await until(() => selectedAttribute.value !== undefined);
        await until(() => currentExperimentMetadata.value?.headerTransforms?.time !== undefined);
        // Not done loading until data fetched.
        exemplarDataLoaded.value = false;
        try {
            // Histograms
            await getHistogramData();

            // Exemplar tracks
            await getExemplarTracks(replace, exemplarPercentiles, selectedTrackRequest);

        } finally {
            // After fetching, we've finished loading.
            exemplarDataLoaded.value = true;
        }
    }
    
    function getAttributeName(): string {
        const aggLabel = selectedAggregation.value.label;
        const aggFunc = aggregateFunctions[aggLabel];
        if (isCustomAggregateFunction(aggFunc) || !selectedAttribute.value) {
            return currentExperimentMetadata.value?.headerTransforms?.mass ?? '';
        }
        // If selectedAttribute.value is an object, return its label or value
        if (
            selectedAttribute.value &&
            typeof selectedAttribute.value === 'object' &&
            'label' in selectedAttribute.value
        ) {
            const attrObj = selectedAttribute.value as { label?: string; value?: string };
            return attrObj.label ?? attrObj.value ?? '';
        }
        // Ensure we only return a string here
        return typeof selectedAttribute.value === 'string' ? selectedAttribute.value : '';
    }
    // Helper to build the aggregate column name for queries
    function getAggregateAttributeName(): string {
        const aggLabel = selectedAggregation.value.label;
        const attr1 = selectedAttribute.value;
        const attr2 = selectedAttr2.value;
        const var1 = selectedVar1.value;

        // Check the aggregate function's selections to determine which params to use
        const aggFunc = aggregateFunctions[aggLabel];
        if (isCustomAggregateFunction(aggFunc) || !selectedAttribute.value) {
            return aggLabel;
        }
        if (aggFunc && 'selections' in aggFunc) {
            const sel = aggFunc.selections;
            if (sel.attr1 && sel.attr2 && attr2) {
                return `${aggLabel} ${attr1} ${attr2}`;
            }
            if (sel.attr1 && sel.var1 && var1 !== null && var1 !== undefined && var1 !== '') {
                return `${aggLabel} ${attr1} ${var1}`;
            }
            if (sel.attr1) {
                return `${aggLabel} ${attr1}`;
            }
        }
        // Fallback for custom or basic
        return `${aggLabel} ${attr1}`;
    }

    /**
     * This function gets the histogram data for the selected attribute and aggregation.
     * It first queries the domain of the attribute, then builds the bin ranges, and then
     * queries the histogram counts for each condition.
     */
    async function getHistogramData(): Promise<void> {
        if (
            !experimentDataInitialized.value ||
            !currentExperimentMetadata.value
        ) {
            console.warn(
                'Experiment data not initialized or metadata missing.'
            );
            return;
        }
    
        const aggTableName = `${currentExperimentMetadata.value.name}_composite_experiment_cell_metadata_aggregate`;
        const aggAttribute = getAggregateAttributeName();
        const whereClause = filterWhereClause.value ? `WHERE ${filterWhereClause.value}` : '';
    
        try {
            // 1) Get global min and max value of the aggregated attribute.
            const domainQuery = `
                SELECT
                    CAST(MIN("${aggAttribute}") AS DOUBLE PRECISION) AS min_attr,
                    CAST(MAX("${aggAttribute}") AS DOUBLE PRECISION) AS max_attr
                FROM "${aggTableName}"
                ${whereClause}
                `;
            let domainResult;
            try {
                domainResult = await timedVgQuery('domainQuery', domainQuery);
            } catch (error) {
                console.error('Error during domainQuery:', error);
                throw error;
            }
    
            if (!domainResult || domainResult.length === 0) {
                console.warn('No results returned from domainQuery.');
                return;
            }
            const { min_attr, max_attr } = domainResult[0];
    
            // Fill in histogramDomains with the global min and max aggregated values.
            const minX = typeof min_attr === 'bigint' ? Number(min_attr) : min_attr;
            const maxX = typeof max_attr === 'bigint' ? Number(max_attr) : max_attr;
    
            histogramDomains.value.minX = minX;
            histogramDomains.value.maxX = maxX;
    
            // Build bin ranges (we store these in histogramDomains).
            const binSize = (max_attr - min_attr) / histogramBinCount.value;
    
            histogramDomains.value.histogramBinRanges = Array.from(
                { length: histogramBinCount.value },
                (_, i) => ({
                    min: min_attr + binSize * i,
                    max: i === histogramBinCount.value - 1
                        ? max_attr + 0.0001
                        : min_attr + binSize * (i + 1),
                })
            );
            const histogramConditionQuery = `
                SELECT
                    CAST("${selectedXTag.value}" AS TEXT) AS c1,
                    CAST("${selectedYTag.value}" AS TEXT) AS c2,
                    CAST(
                        CASE 
                            WHEN "${aggAttribute}" >= ${max_attr} THEN ${histogramBinCount.value - 1}
                            ELSE FLOOR(("${aggAttribute}" - ${min_attr}) / ${binSize})
                        END
                        AS INTEGER
                    ) AS bin_index,
                    CAST(COUNT(*) AS DOUBLE PRECISION) AS count
                FROM "${aggTableName}"
                ${whereClause}
                GROUP BY c1, c2, bin_index
                ORDER BY c1, c2, bin_index;
            `;
    
            let histogramBinCounts;
            try {
                histogramBinCounts = await timedVgQuery('histogramConditionQuery', histogramConditionQuery);
            } catch (error) {
                console.error('Error during histogramConditionQuery:', error);
                throw error;
            }
    
            if (!histogramBinCounts || histogramBinCounts.length === 0) {
                console.warn('No histogram counts found.');
                conditionHistograms.value = [];
                return;
            }
    
            // 4) Build a Map from "conditionKey" -> counts array
            const binCountsMap = new Map<string, number[]>();
    
            for (const { c1, c2, bin_index, count } of histogramBinCounts) {
                const conditionKey = `${c1}__${c2}`;
                if (!binCountsMap.has(conditionKey)) {
                    binCountsMap.set(conditionKey, Array(histogramBinCount.value).fill(0));
                }
                const safeBinIndex = typeof bin_index === 'bigint' ? Number(bin_index) : bin_index;
                const safeCount = typeof count === 'bigint' ? Number(count) : count;
                binCountsMap.get(conditionKey)![safeBinIndex] = safeCount;
            }
    
            conditionHistograms.value = Array.from(binCountsMap.entries()).map(
                ([key, counts]) => {
                    const [conditionOne, conditionTwo] = key.split('__');
                    return {
                        condition: { conditionOne, conditionTwo },
                        histogramData: counts
                    };
                }
            );
            histogramDomains.value.minY = 0;
            histogramDomains.value.maxY = Math.max(
                ...conditionHistograms.value.flatMap((c) => c.histogramData)
            );
            return;
        } catch (error) {
            console.error('Error fetching histogram data (outer catch):', error);
        }
    }

    const histogramYAxisLabel = computed(() => {
        const aggLabel = selectedAggregation.value.label;
        const attr1 = selectedAttribute.value;
        const attr2 = selectedAttr2.value;
        const var1 = selectedVar1.value;

        const aggFunc = aggregateFunctions[aggLabel];
        if (isCustomAggregateFunction(aggFunc) || !attr1) {
            return aggLabel;
        }
        if (aggFunc && 'selections' in aggFunc) {
            const sel = aggFunc.selections;
            if (sel.attr1 && sel.attr2 && attr2) {
                return `${aggLabel} ${attr1} ${attr2}`;
            } else if (sel.attr1 && sel.var1 && var1 !== null && var1 !== undefined && var1 !== '') {
                return `${aggLabel} ${attr1} ${var1}`;
            } else if (sel.attr1) {
                return `${aggLabel} ${attr1}`;
            }
        }
        // Fallback for custom or basic
        return `${aggLabel} ${attr1}`;
    });

    /**
     * Adds an aggregate column to the aggregate table for the given attribute/aggregation selections.
     * @param selectedAttributeValue
     * @param selectedAggregationValue
     * @param selectedAttr2Value
     * @param selectedVar1Value
     */
    async function addAggregateColumnForSelection(
        selectedAttributeValue: string,
        selectedAggregationValue: AggregationOption,
        selectedAttr2Value: string | null,
        selectedVar1Value: number | string | null
    ): Promise<void> {
        const aggLabel = selectedAggregationValue.label;
        const aggFunc = aggregateFunctions[aggLabel];
        if (!aggFunc) {
            console.error(`Aggregate function "${aggLabel}" not defined.`);
            return;
        }

        let customQuery;
        const aggFunction = aggregateFunctions[aggLabel];
        if (isCustomAggregateFunction(aggFunction)) {
            customQuery = aggFunction.customQuery;
        }
        const aggObject: AggregateObject = {
            functionName: aggFunc.functionName,
            label: aggLabel,
            attr1: selectedAttributeValue,
            attr2: selectedAttr2Value ?? undefined,
            var1: selectedVar1Value !== null && selectedVar1Value !== undefined ? String(selectedVar1Value) : undefined,
            customQuery: customQuery,
        };

        const experimentName = currentExperimentMetadata?.value?.name;
        const aggTableNameFull = `${experimentName}_composite_experiment_cell_metadata_aggregate`;
        const compTableName = `${experimentName}_composite_experiment_cell_metadata`;

        if (
            !experimentDataInitialized.value ||
            !currentExperimentMetadata.value ||
            !compTableName ||
            !aggTableNameFull
        ) {
            return;
        }
        try {

            await addAggregateColumn(
                aggTableNameFull,
                compTableName,
                aggObject,
                currentExperimentMetadata.value.headerTransforms
            );
        } catch (error) {
            console.error('Error adding aggregate column:', error);
        }
    }

    // helper to time all vg queries
    // helper to time all vg queries
    async function timedVgQuery<T = any>(
        label: string,
        query: string,
        opts = { type: 'json' }
    ): Promise<T> {
        const start = performance.now();
        const result = await vg.coordinator().query(query, opts);
        const elapsed = performance.now() - start;
        return result;
    }

    watch(
        [
            () => aggFilPredString.value,
        ],
        async () => {
            // guard: only once, only when cond-chart filters are ready, only when aggFilPredString is non-null
            if (conditionChartSelectionsInitialized.value && aggFilPredString.value) {
                await getExemplarViewData(true);
            }
        },
    );
    watch(
        () => histogramBinCount.value,
        async (newBinCount, oldBinCount) => {
            // Only trigger if the value actually changed and we have initialized data
            if (newBinCount !== oldBinCount && experimentDataInitialized.value) {

                await getExemplarViewData(true);
            }
        }
    );

    function sortExemplarsByCondition(
        exemplars: ExemplarTrack[]
    ): ExemplarTrack[][] {
        // Sorted ExemplarTrack[][]
        const sortedExemplarTracks: Record<string, ExemplarTrack[]> = {};
        // Find all unique condition values.
        const uniqueFirstConditions = Array.from(
            new Set(
                currentExperimentMetadata.value?.locationMetadataList?.map(
                    (locationMetadata) => locationMetadata.tags?.[selectedXTag.value]
                ) ?? []
            )
        ).filter(Boolean);
        const uniqueSecondConditions = Array.from(
            new Set(
                currentExperimentMetadata.value?.locationMetadataList?.map(
                    (locationMetadata) =>
                        locationMetadata.tags?.[selectedYTag.value]
                ) ?? []
            )
        ).filter(Boolean);

        // For every set of conditions, push unique exemplars to the sortedExemplarTracks
        for (const uniqueFirstCondition of uniqueFirstConditions) {
            const c1Exemplars: ExemplarTrack[] = [];
            for (const exemplar of exemplars) {
                if (exemplar.tags.conditionOne === uniqueFirstCondition) {
                    c1Exemplars.push(exemplar);
                }
            }
            // For each conditionTwo that exists, find exemplars from the conditionOne array with that conditionTwo, and add them to the final exemplartrack[][]
            for (const uniqueSecondCondition of uniqueSecondConditions) {
                const matchingExemplars = c1Exemplars.filter(
                    (exemplar) => exemplar.tags.conditionTwo === uniqueSecondCondition
                );
                matchingExemplars.sort((a, b) => a.aggValue - b.aggValue); // sort by aggValue
                if (uniqueFirstCondition && matchingExemplars.length > 0) {
                    if (!sortedExemplarTracks[uniqueFirstCondition]) {
                        sortedExemplarTracks[uniqueFirstCondition] = [];
                    }
                    sortedExemplarTracks[uniqueFirstCondition].push(...matchingExemplars);
                }
            }
        }
        // Return the final exemplartrack[][]
        return Object.values(sortedExemplarTracks);
    }


    /**
     * Return exemplar tracks for every given condition pair, and every percentile / track value for that condition.
     *
     * @param percentiles?          Optional list of percentiles (e.g. [5, 50, 95]).
     * @returns Promise resolving to an array of ExemplarTrack objects.
     */
    async function getExemplarTracksData(
        percentiles?: number[],
        selectedTrackRequest?: SelectedTrackRequest,
    ): Promise<ExemplarTrack[]> {
        const attributeColumn = getAttributeName();
        const aggregationColumn = selectedAggregation.value.label
        const experimentName = currentExperimentMetadata?.value?.name
        const aggTable = `${experimentName}_composite_experiment_cell_metadata_aggregate`
        const cellTable = `${experimentName}_composite_experiment_cell_metadata`
        const whereClause = filterWhereClause.value ? `AND ${filterWhereClause.value}` : ''
        const aggAttr = getAggregateAttributeName();


        // --- New logic for selectedTrackRequest ---
        let selectedRank: number | undefined = undefined;
        let selectedExemplar: { track_id?: string; aggValue?: number } | undefined = undefined;

        if (selectedTrackRequest && selectedTrackRequest.binRange && selectedTrackRequest.conditionGroupKey) {
            // 1. Query all exemplars for this condition group
            const cond1 = selectedTrackRequest.conditionGroupKey.conditionOne;
            const cond2 = selectedTrackRequest.conditionGroupKey.conditionTwo;
            const exemplarQuery = `
                SELECT
                    t.tracking_id::TEXT AS track_id,
                    t.location::INTEGER AS location,
                    CAST(t."${selectedXTag.value}" AS TEXT) AS conditionOne,
                    CAST(t."${selectedYTag.value}" AS TEXT) AS conditionTwo,
                    CAST(t."${aggAttr}" AS DOUBLE PRECISION) AS aggValue,
                FROM "${aggTable}" t
                WHERE CAST(t."${selectedXTag.value}" AS TEXT) = '${cond1}'
                AND CAST(t."${selectedYTag.value}" AS TEXT) = '${cond2}'
                ${whereClause}
            `;
            const exemplars: any[] = await timedVgQuery('exemplarQuery', exemplarQuery);

            // 2. Find the exemplar whose aggValue is within the bin range
            const [binMin, binMax] = selectedTrackRequest.binRange;
            // Find all in range, pick the closest to binMin (or bin center)
            const inRange = exemplars.filter(e => e.aggValue >= binMin && e.aggValue < binMax);
            selectedExemplar = undefined;
            if (inRange.length === 0) {
                // fallback: pick closest overall
                let closest = exemplars[0];
                let minDiff = Math.abs(exemplars[0].aggValue - binMin);
                for (const e of exemplars) {
                    const diff = Math.abs(e.aggValue - binMin);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = e;
                    }
                }
                selectedExemplar = closest;
            } else {
                // pick the closest to binMin in the bin
                let closest = inRange[0];
                let minDiff = Math.abs(inRange[0].aggValue - binMin);
                for (const e of inRange) {
                    const diff = Math.abs(e.aggValue - binMin);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = e;
                    }
                }
                selectedExemplar = closest;
            }

            // 3. Compute the rank (1-based) of this exemplar in the sorted group
            const sorted = exemplars.slice().sort((a, b) => a.aggValue - b.aggValue);
            const idx = selectedExemplar ? sorted.findIndex(e => e.track_id === selectedExemplar!.track_id) : -1;
            const targetRank = idx + 1; // 1-based

            // 4. Use this rank directly in the SQL query
            percentiles = undefined; // Don't use percentiles
            selectedRank = targetRank;
        }


        let selectedRankClause = '';
        if (typeof selectedRank === 'number') {
            selectedRankClause = `WHERE rank = ${selectedRank}`;
        } else if (percentiles && percentiles.length > 0) {
            // Handle min/max (0, 100) separately from other percentiles
            const hasMin = percentiles.includes(0);
            const hasMax = percentiles.includes(100);
            const otherPercentiles = percentiles.filter(p => p !== 0 && p !== 100);

            const rankConditions = [];

            // Add min condition
            if (hasMin) {
                rankConditions.push('rank = 1');
            }

            // Add max condition  
            if (hasMax) {
                rankConditions.push('rank = count');
            }

            // Add other percentiles
            if (otherPercentiles.length > 0) {
                const pctRanks = otherPercentiles
                    .map(p => `FLOOR(count*${p / 100}) + 1`)
                    .join(', ');
                rankConditions.push(`rank IN (${pctRanks})`);
            }

            selectedRankClause = `WHERE ${rankConditions.join(' OR ')}`;
        }

        // ---------------------

        const combinedQuery = `
        WITH
        ranked AS (
            SELECT
            t.tracking_id::TEXT       AS track_id,
            t.location::INTEGER          AS location,
            CAST(t."${selectedXTag.value}" AS TEXT)   AS conditionOne,
            CAST(t."${selectedYTag.value}" AS TEXT)   AS conditionTwo,
            CAST(t."Minimum ${timeCol.value}" AS DOUBLE PRECISION)         AS birthTime,
            CAST(t."Maximum ${timeCol.value}" AS DOUBLE PRECISION)         AS deathTime,
            CAST(t."Minimum ${attributeColumn}" AS DOUBLE PRECISION) AS minValue,
            CAST(t."Maximum ${attributeColumn}" AS DOUBLE PRECISION) AS maxValue,
            CAST(t."${aggAttr}" AS DOUBLE PRECISION)               AS aggValue,
            ROW_NUMBER() OVER (
                PARTITION BY t."${selectedXTag.value}", t."${selectedYTag.value}"
                ORDER BY t."${aggAttr}"
            )                            AS rank,
            COUNT(*)    OVER (
                PARTITION BY t."${selectedXTag.value}", t."${selectedYTag.value}"
            )                            AS count
            FROM "${aggTable}" t
            WHERE 1=1 ${whereClause}
        ),
        selected AS (
            SELECT
            track_id, location,
            conditionOne, conditionTwo,
            birthTime, deathTime,
            minValue, maxValue,
            aggValue, -- add aggValue to selected
            rank AS selected_rank
            FROM ranked
            ${selectedRankClause}
        )
        SELECT
            s.track_id,
            CAST(s.location AS DOUBLE PRECISION) AS location,
            CAST(s.birthTime AS DOUBLE PRECISION) AS birthTime,
            CAST(s.deathTime AS DOUBLE PRECISION) AS deathTime,
            CAST(s.minValue AS DOUBLE PRECISION) AS minValue,
            CAST(s.maxValue AS DOUBLE PRECISION) AS maxValue,
            s.conditionOne,
            s.conditionTwo,
            CAST(s.aggValue AS DOUBLE PRECISION) AS aggValue,
            CAST(NULL AS DOUBLE PRECISION) AS p,
            array_agg(ARRAY[
                CAST(n."${idCol.value}" AS TEXT),
                CAST(n."${timeCol.value}" AS TEXT),
                CAST(n."${frameCol.value}" AS TEXT),
                CAST(n."${attributeColumn}" AS TEXT),
                CAST(n."${xCol.value}" AS TEXT),
                CAST(n."${yCol.value}" AS TEXT)
            ]) AS cellLevelData
        FROM selected s
        JOIN "${cellTable}" n
        ON CAST(n."${idCol.value}" AS TEXT) = s.track_id
        GROUP BY
        s.track_id,
        s.location,
        s.birthTime,
        s.deathTime,
        s.minValue,
        s.maxValue,
        s.conditionOne,
        s.conditionTwo,
        s.aggValue; -- add aggValue to group by
        `

        const finalResult: any[] = await timedVgQuery('combinedExemplarQuery', combinedQuery)

        // Return query results -------------------------------------------------------------
        // Return Exemplar Track Array[]
        const tracks: ExemplarTrack[] = finalResult.map((row: any) => {
            // Reconstruct Cell Level Data
            const data: Cell[] = row.cellLevelData.map((c: string[]) => ({
                trackId: c[0],
                time: parseFloat(c[1]),
                frame: parseInt(c[2], 10),
                value: parseFloat(c[3]),
                x: parseFloat(c[4]),
                y: parseFloat(c[5]),
            }));

            return {
                trackId: row.track_id.toString(),
                locationId: row.location.toString(),
                minTime: row.birthTime,
                maxTime: row.deathTime,
                minValue: row.minValue,
                maxValue: row.maxValue,
                data,
                tags: {
                    conditionOne: row.conditionOne,
                    conditionTwo: row.conditionTwo
                },
                p: row.p,
                pinned: false,
                starred: false,
                aggValue: row.aggValue // add aggValue
            };
        });
        return tracks;
    }

    async function getExemplarTracks(
        replace?: boolean,
        percentiles: number[] = exemplarPercentiles.value,
        selectedTrackRequest?: SelectedTrackRequest
    ): Promise<void> {

        let tracks = exemplarTracks.value;

        try {
            // fetch all tracks in one call
            tracks = await getExemplarTracksData(
                percentiles,
                selectedTrackRequest
            );

            if (replace) {
                exemplarTracks.value = tracks;
            } else {
                exemplarTracks.value = [...exemplarTracks.value, ...tracks];
            }

            // Ensure the exemplar tracks are sorted by condition, and flattened.
            exemplarTracks.value = sortExemplarsByCondition(exemplarTracks.value).flat();

        } catch (error) {
            console.error('Error generating exemplar tracks:', error);
        }
    }

    // const getHistogramDataComputed = computed(() => histogramData.value);
    const conditionHistogramsComputed = computed(
        () => conditionHistograms.value
    );
    const histogramDomainsComputed = computed(() => histogramDomains.value);

    return {
        getExemplarTracks,
        getExemplarImageUrls,
        exemplarTracks,
        viewConfiguration,
        snippetZoom,
        exemplarHeight,
        selectedAttribute,
        selectedAggregation,
        selectedAttr2,
        selectedVar1,
        getTotalExperimentTime,
        getHistogramData,
        getExemplarViewData,
        addAggregateColumnForSelection,
        getAttributeName,
        histogramYAxisLabel,
        histogramBinCount,
        horizonChartSettings,
        exemplarPercentiles,
        percentileOptions,
        conditionHistograms: conditionHistogramsComputed,
        histogramDomains: histogramDomainsComputed,
        exemplarDataLoaded, // export the loading state
        horizonChartScheme,
    };
});
