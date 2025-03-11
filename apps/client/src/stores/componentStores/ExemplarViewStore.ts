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
    data: DataPoint[];
    tags: Record<string, string>;
    p: number; // the sample position, e.g. median has p=0.5
    pinned: boolean; // true if this is a user pinned exemplar
    starred: boolean; // true if this is a user starred exemplar
}

export interface DataPoint {
    time: number;
    frame: number;
    value: number;
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
        horizonHistogramGap: 0,
        histogramWidth: 250,
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
            console.log(
                `${selectedAttribute.value} - min: ${min_attr}, max: ${max_attr}`
            );

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

            // // Console log the selected attribute, and the values of the bin ranges for each histogram.
            // console.log(
            //     `${selectedAttribute.value}: binRanges: ` +
            //         histogramDomains.value.histogramBinRanges
            //             .map((bin) => `[min: ${bin.min}, max: ${bin.max}]`)
            //             .join(', ')
            // );

            // 3) Query to get histogram counts (all cast to DOUBLE or INT so no BigInt is returned).
            const histogramConditionQuery = `
                WITH aggregated_data AS (
                    SELECT
                        "track_id",
                        "Drug",
                        "Concentration (um)",
                        CAST(${aggregationColumn}("${selectedAttribute.value}") AS DOUBLE PRECISION) AS agg_value,
                        COUNT(*) AS row_count
                    FROM "${tableName}"
                    GROUP BY "track_id", "Drug", "Concentration (um)"
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
                    aggregated_data."Drug" AS drug,
                    aggregated_data."Concentration (um)" AS conc,
                    bins.bin_index,
                    CAST(COUNT(*) AS DOUBLE PRECISION) AS count
                FROM aggregated_data
                CROSS JOIN bins
                WHERE aggregated_data.row_count > 50
                    AND aggregated_data.agg_value >= bins.bin_min
                    AND aggregated_data.agg_value < bins.bin_max
                GROUP BY drug, conc, bins.bin_index
                ORDER BY drug, conc, bins.bin_index
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
                // row.bin_index, row.count, row.drug, row.conc are guaranteed to be numbers/strings now
                const binIndex = row.bin_index;
                const count = row.count;
                const drug = row.drug;
                const conc = row.conc;

                const conditionKey = `${drug}__${conc}`;
                if (!conditionMap.has(conditionKey)) {
                    conditionMap.set(conditionKey, Array(binCount).fill(0));
                }
                conditionMap.get(conditionKey)![binIndex] = count;
            }

            // This is storing the result of the query.
            conditionHistograms.value = Array.from(conditionMap.entries()).map(
                ([key, counts]) => {
                    const [drug, concentration] = key.split('__');
                    return {
                        condition: {
                            Drug: drug,
                            'Concentration (um)': concentration,
                        },
                        histogramData: counts,
                    };
                }
            );

            console.log(
                `${selectedAttribute.value} - histogramData: `,
                conditionHistograms.value
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
                console.log(`Aggregate column added: ${addedColumnName}`);
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

    function groupExemplarsByCondition(
        exemplars: ExemplarTrack[]
    ): ExemplarTrack[][] {
        // Sorted ExemplarTrack[][]
        const sortedExemplarTracks: Record<string, ExemplarTrack[]> = {};
        // Find all unique drugs and concentrations.
        const uniqueDrugs = Array.from(
            new Set(
                currentExperimentMetadata.value?.locationMetadataList?.map(
                    (locationMetadata) => locationMetadata.tags?.Drug
                ) ?? []
            )
        ).filter(Boolean);
        const uniqueConcentrations = Array.from(
            new Set(
                currentExperimentMetadata.value?.locationMetadataList?.map(
                    (locationMetadata) =>
                        locationMetadata.tags?.['Concentration (um)']
                ) ?? []
            )
        ).filter(Boolean);

        console.log('uniqueDrugs', uniqueDrugs);
        console.log('uniqueConcentrations', uniqueConcentrations);
        //
        for (const uniqueDrug of uniqueDrugs) {
            const drugExemplars: ExemplarTrack[] = [];
            for (const exemplar of exemplars) {
                console.log('exemplar.tags.Drug', exemplar.tags.drug);
                console.log('uniqueDrug', uniqueDrug);
                if (exemplar.tags.drug === uniqueDrug) {
                    drugExemplars.push(exemplar);
                }
            }
            console.log('drugExemplars', drugExemplars);
            // For each concentration that exists, find exemplars from the drug array with that concentration, and add them to the final exemplartrack[][]
            for (const uniqueConc of uniqueConcentrations) {
                for (const exemplar of drugExemplars) {
                    if (exemplar.tags.conc === uniqueConc) {
                        // Initialize the group if it doesn't exist
                        if (uniqueDrug && !sortedExemplarTracks[uniqueDrug]) {
                            sortedExemplarTracks[uniqueDrug] = [];
                        }
                        if (uniqueDrug && uniqueConc) {
                            sortedExemplarTracks[uniqueDrug].push(exemplar);
                        }
                    }
                }
            }
        }

        // Return the final exemplartrack[][]
        return Object.values(sortedExemplarTracks);
    }

    async function getExemplarTrackData(
        drug: string,
        conc: string,
        p?: number,
        additionalTrackValue?: number
    ): Promise<{
        trackId: string;
        locationId: string;
        birthTime: number;
        deathTime: number;
        minValue: number;
        maxValue: number;
        data: DataPoint[];
    }> {
        const pDecimal = p ? p / 100 : undefined;
        const timeColumn = 'Time (h)';
        const drugColumn = 'Drug';
        const concColumn = 'Concentration (um)';
        const attributeColumn = selectedAttribute.value; // Use selected attribute
        const aggregationColumn = selectedAggregation.value.label;
        const experimentName = currentExperimentMetadata?.value?.name;

        let query;
        if (
            additionalTrackValue === undefined ||
            additionalTrackValue === null
        ) {
            console.log('getExemplarTrackData - p query called');
            // Start of Selection
            query = `
            WITH valid_tracks AS (
                SELECT "track_id"
                FROM "${experimentName}_composite_experiment_cell_metadata"
                WHERE "${drugColumn}" = '${drug}'
                AND "${concColumn}" = '${conc}'
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
                WHERE "Drug" = '${drug}'
                AND "Concentration (um)" = '${conc}'
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
                    n."${timeColumn}",
                    n."Frame ID",
                    n."${attributeColumn}"
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
                WHERE "${drugColumn}" = '${drug}'
                AND "${concColumn}" = '${conc}'
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
                WHERE "Drug" = '${drug}'
                AND "Concentration (um)" = '${conc}'
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
                        n."${timeColumn}",
                        n."Frame ID",
                        n."${attributeColumn}"
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
                // console.log(
                //     `getExemplarTrackData - Drug: ${drug}, Conc: ${conc}, p: ${p}`
                // );
                // console.log('Birth Time:', birthTime, 'Death Time:', deathTime);
                // console.log('Data Array:', data);

                // Map the returned array to DataPoint[] with BigInt conversion
                const mappedData: DataPoint[] = data.map((d: any[]) => ({
                    time: d[0], // Convert BigInt to Number
                    frame: d[1], // Convert BigInt to Number
                    value: d[2], // Convert BigInt to Number
                }));

                console.log(
                    'getExemplarTrackData result: ',
                    track_id,
                    location,
                    birthTime,
                    deathTime,
                    minValue,
                    maxValue,
                    mappedData
                );

                return {
                    trackId: track_id,
                    locationId: location,
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
                `Error querying times for ${drug}-${conc} with p=${p}:`,
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
        drug: string,
        conc: string,
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
            drug,
            conc,
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
                drug: drug,
                conc: conc,
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

        // 1. Build a mapping of drug -> set of concentrations
        const drugOrder: string[] = []; // helps preserve the order of first appearance
        const drugToConcs = new Map<string, Set<string>>();

        for (const locationMetadata of currentExperimentMetadata.value
            ?.locationMetadataList ?? []) {
            // Skip if no tags
            if (!locationMetadata.tags) continue;

            // Directly pull out the Drug and Concentration tags
            const drug = locationMetadata.tags['Drug'];
            const conc = locationMetadata.tags['Concentration (um)'];

            // If both exist
            if (drug && conc) {
                // If it's the first time we see this drug, remember its order
                if (!drugToConcs.has(drug)) {
                    drugToConcs.set(drug, new Set<string>());
                    drugOrder.push(drug);
                }

                // Add the concentration to the Set
                drugToConcs.get(drug)?.add(conc);
            }
        }

        // 2. Now enqueue promises grouped by each drug
        for (const drug of drugOrder) {
            const concs = drugToConcs.get(drug);
            if (!concs) continue;

            for (const conc of concs) {
                if (
                    additionalTrackValue === undefined ||
                    additionalTrackValue === null
                ) {
                    for (const p of exemplarPercentiles) {
                        trackPromises.push(
                            getExemplarTrack(drug, conc, p, undefined)
                        );
                    }
                } else {
                    console.log(
                        'getExemplarTracks - additionalTrackValue:',
                        additionalTrackValue
                    );
                    trackPromises.push(
                        getExemplarTrack(
                            drug,
                            conc,
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
                console.log('replacing');
                exemplarTracks.value = tracks;
            } else {
                console.log('pushing');
                exemplarTracks.value.push(...tracks);
            }

            // console.log(
            //     'groupExemplarsByCondition',
            //     groupExemplarsByCondition(exemplarTracks.value).flat()
            // );
            // Group exemplars by condition
            exemplarTracks.value = groupExemplarsByCondition(
                exemplarTracks.value
            ).flat();

            console.log('Exemplar tracks successfully added:', tracks.length);
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
