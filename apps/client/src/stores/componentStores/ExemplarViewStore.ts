import { ref, watch, computed } from 'vue';
import { defineStore } from 'pinia';
import { storeToRefs } from 'pinia';
import { useDatasetSelectionStore } from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import * as vg from '@uwdata/vgplot';
import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';

// Import the utility function and type for building the aggregate object
import { addAggregateColumn, type AggregateObject } from '@/util/datasetLoader';
import { aggregateFunctions } from '@/components/plotSelector/aggregateFunctions';
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
    const { selectedXTag, selectedYTag } = storeToRefs(conditionSelectorStore);
     
    const selectedAttribute = ref<string>('Mass (pg)'); // Default attribute
    const selectedAggregation = ref<AggregationOption>({
        label: 'Average',
        value: 'AVG',
    });
    // New reactive property to track whether exemplar data is loading
    const loadingExemplarData = ref<boolean>(false);

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

        // Get the table name from the current experiment metadata
        const tableName = `${currentExperimentMetadata.value.name}_composite_experiment_cell_metadata`;

        try {
            const aggregationColumn = selectedAggregation.value.value;
            // 1) Get global minX / maxX of selected attribute, ensuring they are double

            // 2) Query to get the domain of the selected attribute
            const domainQuery = `
            SELECT
              CAST(MIN(attribute_value) AS DOUBLE PRECISION) AS min_attr,
              CAST(MAX(attribute_value) AS DOUBLE PRECISION) AS max_attr
            FROM (
                SELECT
                    "track_id",
                    CAST(${aggregationColumn}("${selectedAttribute.value}") AS DOUBLE PRECISION) AS attribute_value
                FROM "${tableName}"
                GROUP BY "track_id"
                HAVING COUNT(*) > 50
            ) AS subquery
          `;

            const domainResult = await vg.coordinator().query(domainQuery, {
                type: 'json',
            });

            if (!domainResult || domainResult.length === 0) {
                console.warn('No results returned from domainQuery.');
                return;
            }

            // From the domain query, we get the min and max of the attribute.
            const { min_attr, max_attr } = domainResult[0];
            if (min_attr >= max_attr) {
                console.error(
                    `Invalid attribute range: min_attr (${min_attr}) >= max_attr (${max_attr}). Skipping histogram.`
                );
                return;
            }

            // Fill in histogramDomains
            histogramDomains.value.minX = min_attr;
            histogramDomains.value.maxX = max_attr;

            // 2) Build bin ranges (we store these in histogramDomains).
            //    These will be purely in JavaScript as standard numbers.
            const binCount = 70;
            const binSize = (max_attr - min_attr) / binCount;
            histogramDomains.value.histogramBinRanges = Array.from(
                { length: binCount },
                (_, i) => ({
                    min: min_attr + binSize * i,
                    max: min_attr + binSize * (i + 1),
                })
            );

            console.log("Conidition One:", selectedXTag.value);
            console.log("Conidition Two:", selectedYTag.value);
            // 3) Query to get histogram counts (all cast to DOUBLE or INT so no BigInt is returned).
            const histogramConditionQuery = `
                WITH aggregated_data AS (
                    SELECT
                        "track_id",
                        "${selectedXTag.value}" AS "conditionOne",
                        "${selectedYTag.value}" AS "conditionTwo",
                        CAST(${aggregationColumn}("${selectedAttribute.value}") AS DOUBLE PRECISION) AS agg_value,
                        COUNT(*) AS row_count
                    FROM "${tableName}"
                    GROUP BY "track_id", "conditionOne", "conditionTwo"
                ),
                bins AS (
                    SELECT
                        CAST(bin_index AS INTEGER) AS bin_index,
                        CAST(${min_attr} AS DOUBLE PRECISION)
                            + (
                            (CAST((${max_attr}) AS DOUBLE PRECISION) - CAST(${min_attr} AS DOUBLE PRECISION)) 
                            / ${binCount}
                            ) * CAST(bin_index AS DOUBLE PRECISION) AS bin_min,
                        CAST(${min_attr} AS DOUBLE PRECISION)
                            + (
                            (CAST((${max_attr}) AS DOUBLE PRECISION) - CAST(${min_attr} AS DOUBLE PRECISION)) 
                            / ${binCount}
                            ) * (CAST(bin_index AS DOUBLE PRECISION) + 1) AS bin_max
                    FROM (
                    SELECT generate_series AS bin_index
                    FROM generate_series(0, ${binCount} - 1)
                    ) t
                )
                SELECT
                    aggregated_data.conditionOne AS c1,
                    aggregated_data.conditionTwo AS c2,
                    bins.bin_index,
                    CAST(COUNT(*) AS DOUBLE PRECISION) AS count
                FROM aggregated_data
                CROSS JOIN bins
                WHERE aggregated_data.row_count > 50
                    AND aggregated_data.agg_value >= bins.bin_min
                    AND aggregated_data.agg_value < bins.bin_max
                GROUP BY c1, c2, bins.bin_index
                ORDER BY c1, c2, bins.bin_index
                `;

            const histogramCounts = await vg
                .coordinator()
                .query(histogramConditionQuery, { type: 'json' });

            if (!histogramCounts || histogramCounts.length === 0) {
                console.warn('No histogram counts found.');
                conditionHistograms.value = [];
                return;
            }

            // For test logging, log the condition, and for each histogram bin, log the bin index, the min and max values, and the count.

            // 4) Construct conditionHistograms from the query result
            const conditionMap = new Map<string, number[]>();

            for (const row of histogramCounts) {
                // row.bin_index, row.count, row.conditionOne, row.conditionTwo are guaranteed to be numbers/strings now
                const binIndex = row.bin_index;
                const count = row.count;
                const c1 = row.c1;
                const c2 = row.c2;

                const conditionKey = `${c1}__${c2}`;
                if (!conditionMap.has(conditionKey)) {
                    conditionMap.set(conditionKey, Array(binCount).fill(0));
                }
                conditionMap.get(conditionKey)![binIndex] = count;
            }

            // This is storing the result of the query.
            conditionHistograms.value = Array.from(conditionMap.entries()).map(
                ([key, counts]) => {
                    const [c1, c2] = key.split('__');
                    return {
                        condition: {
                            conditionOne: c1,
                            conditionTwo: c2,
                        },
                        histogramData: counts,
                    };
                }
            );
            // 5) Optionally set histogramDomains for the Y range
            histogramDomains.value.minY = 0;
            histogramDomains.value.maxY = Math.max(
                ...conditionHistograms.value.flatMap((c) => c.histogramData)
            );

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

    // Consolidate data loading into one watcher so that loading remains true until both
    // the histogram data and exemplar tracks are fully loaded.
    watch(
        () => [selectedAttribute.value, selectedAggregation.value],
        async ([newAttr, newAgg]) => {
            loadingExemplarData.value = true;
            try {
                await getHistogramData();
                await getExemplarTracks(true);
            } finally {
                loadingExemplarData.value = false;
            }
        },
        { immediate: false }
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

    async function getExemplarTrackData(
        conditionOne: string,
        conditionTwo: string,
        p?: number,
        additionalTrackValue?: number
    ): Promise<{
        trackId: string;
        locationId: string;
        birthTime: number;
        deathTime: number;
        minValue: number;
        maxValue: number;
        data: Cell[];
    }> {
        const pDecimal = p ? p / 100 : undefined;
        const timeColumn = 'Time (h)';
        const condOneColumn = selectedXTag.value;
        const condTwoColumn = selectedYTag.value;
        const attributeColumn = selectedAttribute.value; // Use selected attribute
        const aggregationColumn = selectedAggregation.value.label;
        const experimentName = currentExperimentMetadata?.value?.name;

        let query;
        if (
            additionalTrackValue === undefined ||
            additionalTrackValue === null
        ) {
            // Start of Selection
            query = `
            WITH valid_tracks AS (
                SELECT "track_id"
                FROM "${experimentName}_composite_experiment_cell_metadata"
                WHERE "${condOneColumn}" = '${conditionOne}'
                AND "${condTwoColumn}" = '${conditionTwo}'
                GROUP BY "track_id"
                HAVING COUNT(*) >= 50
            ),
            aggregated_data AS (
                SELECT
                "tracking_id"::INTEGER AS track_id,
                "location"::INTEGER AS location,
                "Minimum Time (h)" AS birthTime,
                "Maximum Time (h)" AS deathTime,
                "Minimum ${attributeColumn}" AS minValue,
                "Maximum ${attributeColumn}" AS maxValue,
                "${aggregationColumn} ${attributeColumn}" AS avg_attr
                FROM "${experimentName}_composite_experiment_cell_metadata_aggregate"
                WHERE "${condOneColumn}"  = '${conditionOne}'
                AND "${condTwoColumn}"  = '${conditionTwo}'
                AND "tracking_id" IN (SELECT track_id FROM valid_tracks)
            ),
            selected_track AS (
                SELECT track_id
                FROM aggregated_data
                WHERE avg_attr = (
                SELECT quantile_disc(avg_attr, ${pDecimal})
                FROM aggregated_data
                )
                LIMIT 1
            )
            SELECT
                agg.track_id,
                agg.location,
                agg.birthTime,
                agg.deathTime,
                agg.minValue,
                agg.maxValue,
                array_agg(
                ARRAY[
                    n.track_id,
                    n."${timeColumn}",
                    n."Frame ID",
                    n."${attributeColumn}",
                    n."x",
                    n."y"
                ]
                ) AS data
            FROM "${experimentName}_composite_experiment_cell_metadata" n
            JOIN aggregated_data agg
                ON n."track_id" = agg.track_id
            WHERE n."track_id" = (SELECT track_id FROM selected_track)
            GROUP BY
                agg.track_id,
                agg.location,
                agg.birthTime,
                agg.deathTime,
                agg.minValue,
                agg.maxValue;
                `;
        } else {
            // Updated query: rather than using pDecimal, select the track whose avg_attr
            // is nearest to the additionalTrackValue
            query = `
            WITH valid_tracks AS (
                SELECT "track_id"
                FROM "${experimentName}_composite_experiment_cell_metadata"
                WHERE "${condOneColumn}" = '${conditionOne}'
                AND "${condTwoColumn}" = '${conditionTwo}'
                GROUP BY "track_id"
                HAVING COUNT(*) >= 50
            ),
            aggregated_data AS (
                SELECT
                    "tracking_id"::INTEGER AS track_id,
                    "location"::INTEGER AS location,
                    "Minimum Time (h)" AS birthTime,
                    "Maximum Time (h)" AS deathTime,
                    "Minimum ${attributeColumn}" AS minValue,
                    "Maximum ${attributeColumn}" AS maxValue,
                    "${aggregationColumn} ${attributeColumn}" AS avg_attr
                FROM "${experimentName}_composite_experiment_cell_metadata_aggregate"
                WHERE "${condOneColumn}"  = '${conditionOne}'
                AND "${condTwoColumn}"  = '${conditionTwo}'
                AND "tracking_id" IN (SELECT track_id FROM valid_tracks)
            ),
            selected_track AS (
                SELECT track_id
                FROM aggregated_data
                ORDER BY ABS(avg_attr - ${additionalTrackValue}) ASC
                LIMIT 1
            )
            SELECT
                agg.track_id,
                agg.location,
                agg.birthTime,
                agg.deathTime,
                agg.minValue,
                agg.maxValue,
                array_agg(
                    ARRAY[
                        n.track_id,
                        n."${timeColumn}",
                        n."Frame ID",
                        n."${attributeColumn}",
                        n."x",
                        n."y"
                    ]
                ) AS data
            FROM "${experimentName}_composite_experiment_cell_metadata" n
            JOIN aggregated_data agg ON n."track_id" = agg.track_id
            WHERE n."track_id" = (SELECT track_id FROM selected_track)
            GROUP BY
                agg.track_id,
                agg.location,
                agg.birthTime,
                agg.deathTime,
                agg.minValue,
                agg.maxValue;
        `;
        }

        try {
            const result = await vg
                .coordinator()
                .query(query, { type: 'json' });

            if (result && result.length > 0) {
                const {
                    track_id,
                    location,
                    birthTime,
                    deathTime,
                    minValue,
                    maxValue,
                    data,
                } = result[0];

                // Map the returned array to Cell[] with BigInt conversion
                const mappedData: Cell[] = data.map((d: any[]) => ({
                    trackId: d[0].toString(), // Convert BigInt to String
                    time: d[1], // Convert BigInt to Number
                    frame: d[2], // Convert BigInt to Number
                    value: d[3], // Convert BigInt to Number
                    x: d[4],
                    y: d[5],
                }));

                return {
                    trackId: track_id,
                    locationId: location.toString(),
                    birthTime: birthTime || 0, // Ensure Number type
                    deathTime: deathTime || 100, // Ensure Number type
                    minValue: minValue || 0,
                    maxValue: maxValue || 0,
                    data: mappedData || [],
                };
            } else {
                return {
                    trackId: '',
                    locationId: '',
                    birthTime: 0,
                    deathTime: 100,
                    minValue: 0,
                    maxValue: 0,
                    data: [],
                };
            }
        } catch (error) {
            console.error(
                `Error querying times for ${conditionOne}-${conditionTwo} with p=${p}:`,
                error
            );
            return {
                trackId: '',
                locationId: '',
                birthTime: 0,
                deathTime: 100,
                minValue: 0,
                maxValue: 0,
                data: [],
            };
        }
    }

    async function getExemplarTrack(
        conditionOne: string,
        conditionTwo: string,
        p?: number,
        additionalTrackValue?: number
    ): Promise<ExemplarTrack> {
        const {
            trackId,
            locationId,
            birthTime,
            deathTime,
            minValue,
            maxValue,
            data,
        } = await getExemplarTrackData(
            conditionOne,
            conditionTwo,
            p ?? undefined,
            additionalTrackValue ?? undefined
        );
        return {
            trackId: trackId,
            locationId: locationId,
            minTime: birthTime,
            maxTime: deathTime,
            minValue: minValue,
            maxValue: maxValue,
            data,
            tags: {
                conditionOne,
                conditionTwo,
            },
            p: p ?? undefined,
            pinned: false,
            starred: false,
        };
    }

    exemplarTracks.value = [];
    async function getExemplarTracks(
        replace?: boolean,
        exemplarPercentiles: number[] = [5, 50, 95],
        additionalTrackValue?: number
    ): Promise<void> {
        const trackPromises: Promise<ExemplarTrack>[] = [];

        // 1. Build a mapping of conditionOne -> set of conditionTwos
        const conditionOneOrder: string[] = []; // helps preserve the order of first appearance
        const conditionMapping = new Map<string, Set<string>>();

        for (const locationMetadata of currentExperimentMetadata.value
            ?.locationMetadataList ?? []) {
            // Skip if no tags
            if (!locationMetadata.tags) continue;

            // Directly pull out the condition tags
            const c1 = locationMetadata.tags[selectedXTag.value];
            const c2 = locationMetadata.tags[selectedYTag.value];

            // If both exist
            if (c1 && c2) {
                // If it's the first time we see this conditionOne, remember its order
                if (!conditionMapping.has(c1)) {
                    conditionMapping.set(c1, new Set<string>());
                    conditionOneOrder.push(c1);
                }

                // Add the conditionTwos to the Set
                conditionMapping.get(c1)?.add(c2);
            }
        }

        // 2. Now enqueue promises grouped by each c1
        for (const c1 of conditionOneOrder) {
            const c2s = conditionMapping.get(c1);
            if (!c2s) continue;

            for (const c2 of c2s) {
                if (
                    additionalTrackValue === undefined ||
                    additionalTrackValue === null
                ) {
                    for (const p of exemplarPercentiles) {
                        trackPromises.push(
                            getExemplarTrack(c1, c2, p, undefined)
                        );
                    }
                } else {
                    trackPromises.push(
                        getExemplarTrack(
                            c1,
                            c2,
                            undefined,
                            additionalTrackValue
                        )
                    );
                }
            }
        }

        try {
            const tracks = await Promise.all(trackPromises);

            if (replace) {
                exemplarTracks.value = tracks;
            } else {
                exemplarTracks.value.push(...tracks);
            }
            // Group exemplars by condition
            exemplarTracks.value = sortExemplarsByCondition(
                exemplarTracks.value
            ).flat();
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
        conditionHistograms: conditionHistogramsComputed,
        histogramDomains: histogramDomainsComputed,
        loadingExemplarData, // export the loading state
    };
});
