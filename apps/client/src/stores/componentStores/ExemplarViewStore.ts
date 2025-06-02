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
    const {aggFilPredString,conditionChartSelectionsInitialized} = storeToRefs(mosaicSelectionStore);
    const { selectedXTag, selectedYTag } = storeToRefs(conditionSelectorStore);
    const selectionStore = useSelectionStore();
    const { dataSelections, dataFilters } = storeToRefs(selectionStore);
     
    const selectedAttribute = ref<string>('Mass (pg)'); // Default attribute
    const selectedAggregation = ref<AggregationOption>({
        label: 'Average',
        value: 'AVG',
    });
    const exemplarPercentiles = ref<number[]>([5, 50, 95]); // Default percentiles for exemplar tracks
    // New reactive property to track whether exemplar data is loaded
    const exemplarDataLoaded = ref<boolean>(true);

    const viewConfiguration = ref<ViewConfiguration>({
        afterStarredGap: 100,
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
    async function getExemplarViewData(replace?: boolean, exemplarPercentiles?: number[], additionalTrackValue?: number): Promise<void> {
        exemplarDataLoaded.value = false;
        try {
            await getHistogramData();

            console.log('Exemplar tracks generated.');
            await getExemplarTracks(replace, exemplarPercentiles, additionalTrackValue);
            console.log('Exemplar tracks fetched.');
        } finally {
            exemplarDataLoaded.value = true;
        }
}

    const filterWhereClause = computed(() => {
        return aggFilPredString.value;
    });

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
        const aggAttribute = `${selectedAggregation.value.label} ${selectedAttribute.value}`;
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
            console.log('Condition Histograms:', conditionHistograms.value);
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
        () => [selectedAttribute.value, selectedAggregation.value],
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
                label: `${aggLabel}`, // e.g., "Minimum Mass (pg)"
                attr1: selectedAttribute.value,
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
                const addedColumnName = await addAggregateColumn(
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
            console.log(`${label} took ${elapsed.toFixed(2)} ms`);
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
            console.log('Refreshing exemplar view data');
            await getExemplarViewData(true);
          }
        },
        { immediate: true }
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
                matchingExemplars.sort((a, b) => a.p - b.p);
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
     * @param conditions            Array of [conditionOne, conditionTwo] pairs.
     * @param percentiles?          Optional list of percentiles (e.g. [5, 50, 95]).
     * @param additionalTrackValue? Optional extra track value to include.
     * @returns Promise resolving to an array of ExemplarTrack objects.
     */
    async function getExemplarTracksData(
        conditions: [string, string][],
        percentiles?: number[],
        additionalTrackValue?: number
    ): Promise<ExemplarTrack[]> {

        // Percentiles
        const percentileDecimals = percentiles?.map((p) => p / 100) ?? [];
        const percentileValuesSql = percentileDecimals?.map((d) => `(${d})`).join(',');

        // Conditions
        const conditionsSql = conditions.map(
            ([conditionOne, conditionTwo]) => `('${conditionOne}', '${conditionTwo}')`).join(',');

        // Column names
        const timeColumn = 'Time (h)';
        const attributeColumn = selectedAttribute.value; // Use selected attribute
        const aggregationColumn = selectedAggregation.value.label;
    
        // Table / Experiment names
        const experimentName = currentExperimentMetadata?.value?.name;
        const cellLevelTableName = `${experimentName}_composite_experiment_cell_metadata`;
        const trackLevelTableName = `${experimentName}_composite_experiment_cell_metadata_aggregate`;

        // Filtering 
        const whereClause = filterWhereClause.value ? `AND ${filterWhereClause.value}` : '';
        const aggregatedAttribute = `${aggregationColumn} ${attributeColumn}`;



        console.log('Percentile values sql:', percentileValuesSql);
        console.log('Conditions SQL:', conditionsSql);



        // Query for exemplar tracks ---------------------------------------------------
        let query;

        // 1) Get the target aggregate attribute value for a given condition pair and percentile.
        // Example: target_value will be 1000 pg for 50th percentile average mass, for condition pair A + B.
        // build aliases and SELECT list for each p
            const percentileAliases = percentileDecimals.map(d => d.toString().replace('.', '_'));
            const percentileSelectList = percentileDecimals
            .map((d, i) => 
                `percentile_disc(${d}) WITHIN GROUP (ORDER BY "${aggregatedAttribute}") AS val${percentileAliases[i]}`
            ).join(',\n      ');
            const lateralValues = percentileDecimals
            .map((d, i) => `(${d}, val${percentileAliases[i]})`)
            .join(',\n        ');

            const percentageValuesQuery = `
            WITH
            conditions(c1,c2) AS (VALUES ${conditionsSql}),
            stats AS (
                SELECT
                cond.c1 AS conditionOne,
                cond.c2 AS conditionTwo,
                ${percentileSelectList}
                FROM "${trackLevelTableName}" t
                CROSS JOIN conditions cond
                WHERE 1=1 ${whereClause}
                AND t."${selectedXTag.value}" = cond.c1
                AND t."${selectedYTag.value}" = cond.c2
                GROUP BY cond.c1, cond.c2
            )
            SELECT
            s.conditionOne,
            s.conditionTwo,
            v.p,
            v.target_value
            FROM stats s
            CROSS JOIN LATERAL (
            VALUES
                ${lateralValues}
            ) AS v(p, target_value)
            `;
        console.log('--- percentageValues SQL ---\n', percentageValuesQuery);
        let percentageValuesResult;
        try {
        percentageValuesResult = await timedVgQuery('percentageValuesQuery', percentageValuesQuery);

        console.log('percentageValues Result:', percentageValuesResult);
        } catch (err) {
        console.error('Error executing percentageValuesQuery:', err);
        throw err;
        }

        // 2) Select all tracks that match the conditions and have the percentile target aggregate attribute value.
        // Return the track ID, location, condition values, birth and death time, min and max values, and the p value.
        const selectedTracksQuery = `
        WITH percentageValues AS (${percentageValuesQuery})
        SELECT
            t.tracking_id::INTEGER   AS track_id,
            t.location::INTEGER      AS location,
            t."${selectedXTag.value}" AS conditionOne,
            t."${selectedYTag.value}" AS conditionTwo,
            t."Minimum Time (h)"     AS birthTime,
            t."Maximum Time (h)"     AS deathTime,
            t."Minimum ${attributeColumn}" AS minValue,
            t."Maximum ${attributeColumn}" AS maxValue,
            pv.p                      AS p
        FROM "${trackLevelTableName}" t
        JOIN percentageValues pv
            ON t."${selectedXTag.value}" = pv.conditionOne
        AND t."${selectedYTag.value}" = pv.conditionTwo
        AND t."${aggregatedAttribute}" = pv.target_value
        `;
        console.log('--- Selected Tracks SQL ---\n', selectedTracksQuery);
        let selectedTracksResult;
        try {
        selectedTracksResult = await timedVgQuery('selectedTracksQuery', selectedTracksQuery);
        console.log('Selected Tracks Result:', selectedTracksResult);
        } catch (err) {
        console.error('Error executing selectedTracksQuery:', err);
        throw err;
        }

        // 3) Include all data from the selected tracks, and also include the Cell-level data for those tracks 
        const finalQuery = `
        WITH selected_tracks AS (${selectedTracksQuery})
        SELECT
            st.track_id,
            st.location,
            st.birthTime,
            st.deathTime,
            st.minValue,
            st.maxValue,
            st.conditionOne,
            st.conditionTwo,
            st.p,
            -- Cell-level data
            array_agg(ARRAY[
            n.track_id::TEXT,
            n."${timeColumn}"::TEXT,
            n."Frame ID"::TEXT,
            n."${attributeColumn}"::TEXT,
            n.x::TEXT,
            n.y::TEXT
            ]) AS cellLevelData
        FROM selected_tracks st
        JOIN "${cellLevelTableName}" n
            ON n.track_id = st.track_id
        GROUP BY
            st.track_id,
            st.location,
            st.birthTime,
            st.deathTime,
            st.minValue,
            st.maxValue,
            st.conditionOne,
            st.conditionTwo,
            st.p
        `;
        console.log('--- Final Data SQL ---\n', finalQuery);
        let finalResult;
        try {
        finalResult = await timedVgQuery('finalQuery', finalQuery);
        console.log('Final Data Result:', finalResult);
        } catch (err) {
        console.error('Error executing finalQuery:', err);
        throw err;
        }

        // Return query results -------------------------------------------------------------
        // Return new promise of finalResult as type ExemplarTrack[]
        const tracks: ExemplarTrack[] = finalResult.map((row: any) => {
            // reconstruct the cell‐level data
            const data: Cell[] = row.cellLevelData.map((c: string[]) => ({
            trackId: c[0],
            time:   parseFloat(c[1]),
            frame:  parseInt(c[2], 10),
            value:  parseFloat(c[3]),
            x:      parseFloat(c[4]),
            y:      parseFloat(c[5]),
            }));
        
            return {
            trackId:    row.track_id.toString(),
            locationId: row.location.toString(),
            minTime:    row.birthTime,
            maxTime:    row.deathTime,
            minValue:   row.minValue,
            maxValue:   row.maxValue,
            data,
            tags: {
                conditionOne: row.conditionOne,
                conditionTwo: row.conditionTwo
            },
            p:       row.p,
            pinned:  false,
            starred: false
            };
        });
        return tracks;
    }

    exemplarTracks.value = [];
    async function getExemplarTracks(
        replace?: boolean,
        percentiles: number[] = exemplarPercentiles.value,
        additionalTrackValue?: number
    ): Promise<void> {

        // Collect unique (condition one value, condition two value) pairs
        const selectedConditionPairs: [string, string][] = [];
        for (const locMeta of currentExperimentMetadata.value?.locationMetadataList ?? []) {
            const c1 = locMeta.tags?.[selectedXTag.value];
            const c2 = locMeta.tags?.[selectedYTag.value];
            if (c1 && c2 && !selectedConditionPairs.some(([x, y]) => x === c1 && y === c2)) {
            selectedConditionPairs.push([c1, c2]);
            }
        }

        console.log('getting exemplar tracks');
        let tracks = exemplarTracks.value;
        
        try {
            // fetch all tracks in one call
            tracks = await getExemplarTracksData(
              selectedConditionPairs,
              percentiles,
              additionalTrackValue
            );
        
            if (replace) {
              exemplarTracks.value = tracks;
            } else {
              exemplarTracks.value = [...exemplarTracks.value, ...tracks];
            }
        
            // Ensure the exemplar tracks are sorted by condition, and flattened.
            exemplarTracks.value = sortExemplarsByCondition(exemplarTracks.value).flat();

            console.log('Exemplar tracks fetched:', exemplarTracks.value);
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
        getTotalExperimentTime,
        getHistogramData,
        getExemplarViewData,
        exemplarPercentiles,
        conditionHistograms: conditionHistogramsComputed,
        histogramDomains: histogramDomainsComputed,
        exemplarDataLoaded, // export the loading state
    };
});
