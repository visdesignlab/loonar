import { ref, watch, computed } from 'vue';
import { defineStore } from 'pinia';
import { storeToRefs } from 'pinia';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import * as vg from '@uwdata/vgplot';
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';

// Import the utility function and type for building the aggregate object
import { addAggregateColumn, type AggregateObject } from '@/util/datasetLoader';
import { aggregateFunctions } from '@/components/plotSelector/aggregateFunctions';

import { useSelectionStore } from '@/stores/interactionStores/selectionStore';
import { useMosaicSelectionStore } from '@/stores/dataStores/mosaicSelectionStore';

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
export interface SelectedTrackRequest {
    binRange: [number, number];
    conditionGroupKey: Record<string, string>;
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
}

export interface conditionHistogram {
    condition: Record<string, string>;
    histogramData: number[];
}

export interface HistogramBin {
    min: number;
    max: number;
}

export interface HistogramDomains {
    histogramBinRanges: HistogramBin[];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

interface AggregationOption {
    label: string;
    value: string;
}

// Remove histogramData and replace with conditionHistograms
const conditionHistograms = ref<conditionHistogram[]>([]);
const histogramDomains = ref<HistogramDomains>({
    histogramBinRanges: [],
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
});

export const useExemplarViewStore = defineStore('ExemplarViewStore', () => {

    const conditionSelectorStore = useConditionSelectorStore();
    const mosaicSelectionStore = useMosaicSelectionStore();
    const { aggFilPredString, conditionChartSelectionsInitialized } = storeToRefs(mosaicSelectionStore);
    const { selectedXTag, selectedYTag } = storeToRefs(conditionSelectorStore);
    const selectionStore = useSelectionStore();
    const { dataSelections, dataFilters } = storeToRefs(selectionStore);

    const selectedAttribute = ref<string>('Mass (pg)'); // Default attribute
    const selectedAttr2 = ref<string | null>(null);
    const selectedVar1 = ref<number | string | null>(null);
    const selectedAggregation = ref<AggregationOption>({
        label: 'Average',
        value: 'AVG',
    });
    const exemplarPercentiles = ref<number[]>([5, 50, 95]); // Default percentiles for exemplar tracks
    // New reactive property to track whether exemplar data is loaded
    const exemplarDataLoaded = ref<boolean>(true);

    const viewConfiguration = ref<ViewConfiguration>({
        afterStarredGap: 100,
        snippetSourceSize: 80,
        snippetDisplayHeight: 80,
        snippetDisplayWidth: 80,
        snippetHorizonChartGap: 5,
        horizonChartHeight: 40,
        horizonChartWidth: 1000,
        horizonTimeBarGap: 5,
        timeBarHeightOuter: 12,
        timeBarHeightInner: 2,
        betweenExemplarGap: 20,
        betweenConditionGap: 20,
        horizonHistogramGap: 50,
        histogramWidth: 250,
        margin: 50,
        showSnippetImage: true,
        showSnippetOutline: true,
        spaceKeyFramesEvenly: true,

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

    const conditionGroupHeight = computed(() => {
        return (
            exemplarHeight.value * 3 +
            viewConfiguration.value.betweenExemplarGap * 2
        );
    });

    const exemplarTracks = ref<ExemplarTrack[]>([]);

    const datasetSelectionStore = useDatasetSelectionStore();
    const { experimentDataInitialized, currentExperimentMetadata } =
        storeToRefs(datasetSelectionStore);

    /**
     * 
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

    async function getTotalExperimentTime(): Promise<number> {
        if (
            !experimentDataInitialized.value ||
            !currentExperimentMetadata.value
        ) {
            return 0;
        }

        // Assume the time column is specified in headerTransforms
        const timeColumn =
            currentExperimentMetadata.value.headerTransforms?.time;

        if (!timeColumn) {
            console.error('Time column not defined in headerTransforms.');
            return 0;
        }

        const tableName = `${currentExperimentMetadata.value.name}_composite_experiment_cell_metadata`;

        const query = `
            SELECT MAX("${timeColumn}") as max_time, MIN("${timeColumn}") as min_time
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

    /** This function gets all the data for the exemplar view. */
    async function getExemplarViewData(replace?: boolean, exemplarPercentiles?: number[], selectedTrackRequest?: SelectedTrackRequest): Promise<void> {
        exemplarDataLoaded.value = false;
        try {
            await getHistogramData();

            console.log('Exemplar tracks generated.');
            await getExemplarTracks(replace, exemplarPercentiles, selectedTrackRequest);
            console.log('Exemplar tracks fetched.');
        } finally {
            exemplarDataLoaded.value = true;
        }
    }

    const filterWhereClause = computed(() => {
        return aggFilPredString.value;
    });

    // Helper to build the aggregate column name for queries
    function getAggregateColumnName(): string {
        const aggLabel = selectedAggregation.value.label;
        const attr1 = selectedAttribute.value;
        const attr2 = selectedAttr2.value;
        const var1 = selectedVar1.value;

        // Check the aggregate function's selections to determine which params to use
        const aggFunc = aggregateFunctions[aggLabel];
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
        const aggAttribute = getAggregateColumnName();
        const whereClause = filterWhereClause.value ? `WHERE ${filterWhereClause.value}` : '';

        try {
            // 1) Get global min and max value of the aggregated attribute. (Example: min average mass: 2, max average mass: 1000)
            const domainQuery = `
                SELECT
                    CAST(MIN("${aggAttribute}") AS DOUBLE PRECISION) AS min_attr,
                    CAST(MAX("${aggAttribute}") AS DOUBLE PRECISION) AS max_attr
                FROM "${aggTableName}"
                ${whereClause}
                `;
            const domainResult = await timedVgQuery('domainQuery', domainQuery);


            if (!domainResult || domainResult.length === 0) {
                console.warn('No results returned from domainQuery.');
                return;
            }
            const { min_attr, max_attr } = domainResult[0];
            if (min_attr >= max_attr) {
                console.error(
                    `Invalid attribute range: min_attr (${min_attr}) >= max_attr (${max_attr}). Skipping histogram.`
                );
                return;
            }

            // Fill in histogramDomains with the global min and max aggregated values.
            histogramDomains.value.minX = min_attr;
            histogramDomains.value.maxX = max_attr;

            // Build bin ranges (we store these in histogramDomains).
            const binCount = 70;
            const binSize = (max_attr - min_attr) / binCount;
            histogramDomains.value.histogramBinRanges = Array.from(
                { length: binCount },
                (_, i) => ({
                    min: min_attr + binSize * i,
                    max: min_attr + binSize * (i + 1),
                })
            );

            // Using these bin ranges, we find how many track's aggregated attribute values fit into those aggregated attribute bin ranges.
            // Return the conditions, the bin index, and the count of tracks in that bin.
            const histogramConditionQuery = `
                SELECT
                    "${selectedXTag.value}" AS c1,
                    "${selectedYTag.value}" AS c2,
                    CAST(
                    FLOOR(
                        ( "${aggAttribute}" - ${min_attr} )
                        / ${binSize}
                    )
                    AS INTEGER
                    ) AS bin_index,
                    CAST(COUNT(*) AS DOUBLE PRECISION) AS count
                FROM "${aggTableName}"
                ${whereClause}
                    AND "${aggAttribute}" >= ${min_attr}
                    AND "${aggAttribute}" < ${min_attr + binSize * binCount}
                GROUP BY c1, c2, bin_index
                ORDER BY c1, c2, bin_index;
                `;

            // Get result of query - bin counts for each condition pair and bin index.
            const histogramBinCounts = await timedVgQuery('histogramConditionQuery', histogramConditionQuery);


            if (!histogramBinCounts || histogramBinCounts.length === 0) {
                console.warn('No histogram counts found.');
                conditionHistograms.value = [];
                return;
            }

            // 4) Build a Map from "conditionKey" -> counts array
            const binCountsMap = new Map<string, number[]>();

            for (const { c1, c2, bin_index, count } of histogramBinCounts) {
                const conditionKey = `${c1}__${c2}`;
                // initialize on first sight
                if (!binCountsMap.has(conditionKey)) {
                    binCountsMap.set(conditionKey, Array(binCount).fill(0));
                }
                // place the count into its bin index
                binCountsMap.get(conditionKey)![bin_index] = count;
            }

            // 5) Convert Map -> Ref<{condition, histogramData}[]>
            conditionHistograms.value = Array.from(binCountsMap.entries()).map(
                ([key, counts]) => {
                    const [conditionOne, conditionTwo] = key.split('__');
                    return {
                        condition: { conditionOne, conditionTwo },
                        histogramData: counts
                    };
                }
            );
            // 5) Optionally set histogramDomains for the Y range
            histogramDomains.value.minY = 0;
            histogramDomains.value.maxY = Math.max(
                ...conditionHistograms.value.flatMap((c) => c.histogramData)
            );

            return;

            console.log('Histogram data fetched and processed successfully.');
        } catch (error) {
            console.error('Error fetching histogram data:', error);
        }
    }

    // Watch both selectedAttribute and selectedAggregation so that if either changes,
    // an aggregate column is added to the aggregate table.
    watch(
        () => [selectedAttribute.value, selectedAggregation.value, selectedAttr2.value, selectedVar1.value],
        async () => {
            // Since selectedAggregation is always an object, we can directly access .value and .label
            const aggLabel = selectedAggregation.value.label;

            const aggFunc = aggregateFunctions[aggLabel];
            if (!aggFunc) {
                console.error(`Aggregate function "${aggLabel}" not defined.`);
                return;
            }

            // Build the aggregate object using the SQL function and proper label.
            const aggObject: AggregateObject = {
                functionName: aggFunc.functionName,
                label: `${aggLabel}`,
                attr1: selectedAttribute.value,
                attr2: selectedAttr2.value ?? undefined,
                var1: selectedVar1.value !== null && selectedVar1.value !== undefined ? String(selectedVar1.value) : undefined,
                customQuery: (aggFunc as any).customQuery,
            };

            // Ensure table names are available.
            const experimentName = currentExperimentMetadata?.value?.name;
            const aggTableNameFull = `${experimentName}_composite_experiment_cell_metadata_aggregate`;
            const compTableName = `${experimentName}_composite_experiment_cell_metadata`;

            if (
                !experimentDataInitialized.value ||
                !currentExperimentMetadata.value ||
                !compTableName ||
                !aggTableNameFull
            ) {
                console.warn(
                    'Experiment data, metadata, or table names are not set.'
                );
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
        },
        { immediate: true }
    );

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
            () => selectedAggregation.value,
            () => selectedAttribute.value
        ],
        async () => {
            // guard: only once, only when cond-chart filters are ready, only when aggFilPredString is non-null
            if (conditionChartSelectionsInitialized.value && aggFilPredString.value) {
                await getExemplarViewData(true);
            }
        },
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
        const attributeColumn = selectedAttribute.value
        const aggregationColumn = selectedAggregation.value.label
        const experimentName = currentExperimentMetadata?.value?.name
        const aggTable = `${experimentName}_composite_experiment_cell_metadata_aggregate`
        const cellTable = `${experimentName}_composite_experiment_cell_metadata`
        const whereClause = filterWhereClause.value ? `AND ${filterWhereClause.value}` : ''
        const aggAttr = getAggregateColumnName();
        const timeCol = "Time (h)" // hardcoded time column name, should be defined in headerTransforms


        // --- New logic for selectedTrackRequest ---
        let selectedRank: number | undefined = undefined;

        if (selectedTrackRequest && selectedTrackRequest.binRange && selectedTrackRequest.conditionGroupKey) {
            // 1. Query all exemplars for this condition group
            const cond1 = selectedTrackRequest.conditionGroupKey.conditionOne;
            const cond2 = selectedTrackRequest.conditionGroupKey.conditionTwo;
            const exemplarQuery = `
                SELECT
                    t.tracking_id::INTEGER AS track_id,
                    t.location::INTEGER AS location,
                    t."${selectedXTag.value}" AS conditionOne,
                    t."${selectedYTag.value}" AS conditionTwo,
                    t."${aggAttr}" AS aggValue
                FROM "${aggTable}" t
                WHERE t."${selectedXTag.value}" = '${cond1}'
                AND t."${selectedYTag.value}" = '${cond2}'
                ${whereClause}
            `;
            const exemplars: any[] = await timedVgQuery('exemplarQuery', exemplarQuery);

            // 2. Find the exemplar whose aggValue is within the bin range
            const [binMin, binMax] = selectedTrackRequest.binRange;
            // Find all in range, pick the closest to binMin (or bin center)
            const inRange = exemplars.filter(e => e.aggValue >= binMin && e.aggValue < binMax);
            let selectedExemplar;
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
            const idx = sorted.findIndex(e => e.track_id === selectedExemplar.track_id);
            const targetRank = idx + 1; // 1-based

            // 4. Use this rank directly in the SQL query
            percentiles = undefined; // Don't use percentiles
            selectedRank = targetRank;
        }


        const pctDecimals = percentiles?.map(p => p / 100) ?? [];
        const pctRanks = pctDecimals
            .map(d => `FLOOR(count*${d}) + 1`)
            .join(', ');

        let selectedRankClause = '';
        if (typeof selectedRank === 'number') {
            selectedRankClause = `WHERE rank = ${selectedRank}`;
        } else if (pctRanks && pctRanks.length > 0) {
            selectedRankClause = `WHERE rank IN (${pctRanks})`;
        }

        const combinedQuery = `
        WITH
        ranked AS (
            SELECT
            t.tracking_id::INTEGER       AS track_id,
            t.location::INTEGER          AS location,
            t."${selectedXTag.value}"    AS conditionOne,
            t."${selectedYTag.value}"    AS conditionTwo,
            t."Minimum ${timeCol}"         AS birthTime,
            t."Maximum ${timeCol}"         AS deathTime,
            t."Minimum ${attributeColumn}" AS minValue,
            t."Maximum ${attributeColumn}" AS maxValue,
            t."${aggAttr}"               AS aggValue,
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
        s.location,
        s.birthTime,
        s.deathTime,
        s.minValue,
        s.maxValue,
        s.conditionOne,
        s.conditionTwo,
        s.aggValue, -- add aggValue to final select
        NULL::double precision AS p, -- or remove if not needed
        array_agg(ARRAY[
            n.track_id::TEXT,
            n."${timeCol}"::TEXT,
            n."Frame ID"::TEXT,
            n."${attributeColumn}"::TEXT,
            n.x::TEXT,
            n.y::TEXT
        ]) AS cellLevelData
        FROM selected s
        JOIN "${cellTable}" n
        ON n.track_id = s.track_id
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

    exemplarTracks.value = [];
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

    // Remove histogramData related computed properties
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
        exemplarHeight,
        conditionGroupHeight,
        selectedAttribute,
        selectedAggregation,
        selectedAttr2,
        selectedVar1,
        getTotalExperimentTime,
        getHistogramData,
        getExemplarViewData,
        exemplarPercentiles,
        conditionHistograms: conditionHistogramsComputed,
        histogramDomains: histogramDomainsComputed,
        exemplarDataLoaded, // export the loading state
    };
});
