import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { storeToRefs } from 'pinia';
import {
    useDatasetSelectionStore,
    type LocationMetadata,
} from '@/stores/dataStores/datasetSelectionUntrrackedStore';
import * as vg from '@uwdata/vgplot';

import { useConditionSelectorStore } from '@/stores/componentStores/conditionSelectorStore';

export interface ExemplarTrack {
    trackId: string;
    locationId: string;
    minTime: number;
    maxTime: number;
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

// 1. Add fakeHistogramData and histogramDomains
const fakeHistogramData = ref<number[]>([
    5, 12, 9, 14, 7, 10, 8, 13, 6, 11, 4, 15, 3, 16, 2, 17, 1, 18, 0, 19,
]);

const histogramDomains = ref<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}>({
    minX: 0, // Min value for histogram scaling (x-axis after rotation)
    maxX: 20, // Max value for histogram scaling (x-axis after rotation)
    minY: 0, // Min index for histogram bins
    maxY: 20, // Max index for histogram bins
});

export const useExemplarViewStore = defineStore('ExemplarViewStore', () => {
    const conditionSelector = useConditionSelectorStore();
    const { currentExperimentTags } = storeToRefs(conditionSelector);

    const viewConfiguration = ref<ViewConfiguration>({
        afterStarredGap: 100,
        snippetDisplayHeight: 80,
        snippetHorizonChartGap: 5,
        horizonChartHeight: 40,
        horizonChartWidth: 1000,
        horizonTimeBarGap: 5,
        timeBarHeightOuter: 12,
        timeBarHeightInner: 2,
        betweenExemplarGap: 20,
        betweenConditionGap: 20,
        horizonHistogramGap: 5,
        histogramWidth: 150,
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
                console.log(
                    'getTotalExperimentTime - min_time:',
                    result[0].min_time,
                    'max_time:',
                    result[0].max_time
                );
                return result[0].max_time - result[0].min_time;
            } else {
                return 0;
            }
        } catch (error) {
            console.error('Error fetching total experiment time:', error);
            return 0;
        }
    }

    async function getExemplarTrackData(
        drug: string,
        conc: string,
        p: number
    ): Promise<{
        trackId: string;
        locationId: string;
        birthTime: number;
        deathTime: number;
        data: DataPoint[];
    }> {
        const pDecimal = p / 100;
        const timeColumn = 'Time (h)';
        const drugColumn = 'Drug';
        const concColumn = 'Concentration (um)';
        const massColumn = 'Mass (pg)';
        const trackColumn = 'track_id';
        const locationColumn = 'location';
        const experimentName = currentExperimentMetadata?.value?.name;

        // Start of Selection
        const query = `
                WITH avg_mass_per_cell AS (
                    SELECT
                        "${trackColumn}" AS track_id,
                        AVG("${massColumn}") AS avg_mass
                    FROM "${experimentName}_composite_experiment_cell_metadata"
                    WHERE "${drugColumn}" = '${drug}'
                    AND "${concColumn}" = '${conc}'
                    GROUP BY "${trackColumn}"
                    HAVING COUNT(*) >= 50
                )
                SELECT
                    CAST("${trackColumn}" AS INTEGER) AS track_id,
                    CAST("${locationColumn}" AS INTEGER) AS location,
                    MIN("${timeColumn}") AS birthTime,
                    MAX("${timeColumn}") AS deathTime,
                    array_agg(
                        ARRAY[
                            "${timeColumn}",
                            "Frame ID",
                            "${massColumn}"
                        ]
                    ) AS data
                FROM "${experimentName}_composite_experiment_cell_metadata"
                WHERE "${trackColumn}" = (
                    SELECT track_id
                    FROM avg_mass_per_cell
                    WHERE avg_mass = (
                        SELECT quantile_disc(avg_mass, ${pDecimal})
                        FROM avg_mass_per_cell
                    )
                    LIMIT 1
                )
                GROUP BY
                    "${trackColumn}",
                    "${locationColumn}"
                `;

        try {
            const result = await vg
                .coordinator()
                .query(query, { type: 'json' });

            if (result && result.length > 0) {
                const { track_id, location, birthTime, deathTime, data } =
                    result[0];
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

                return {
                    trackId: track_id,
                    locationId: location,
                    birthTime: birthTime || 0, // Ensure Number type
                    deathTime: deathTime || 100, // Ensure Number type
                    data: mappedData || [],
                };
            } else {
                return {
                    trackId: '',
                    locationId: '',
                    birthTime: 0,
                    deathTime: 100,
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
                data: [],
            };
        }
    }

    async function getExemplarTrack(
        drug: string,
        conc: string,
        p: number
    ): Promise<ExemplarTrack> {
        const { trackId, locationId, birthTime, deathTime, data } =
            await getExemplarTrackData(drug, conc, p);
        console.log(
            `ExemplarTrack - Drug: ${drug}, Concentration: ${conc}, p: ${p}`,
            data
        );
        return {
            trackId: trackId,
            locationId: locationId,
            minTime: birthTime,
            maxTime: deathTime,
            data,
            tags: {
                drug: drug,
                conc: conc,
            },
            p,
            pinned: false,
            starred: false,
        };
    }

    async function generateTestExemplarTracks(): Promise<void> {
        exemplarTracks.value = [];
        const trackPromises: Promise<ExemplarTrack>[] = [];
        for (const drug of ['4HT', 'lap', 'dox']) {
            for (const conc of ['0.0016 um', '0.016 um', '0.08 um']) {
                for (const p of [5, 50, 95]) {
                    trackPromises.push(getExemplarTrack(drug, conc, p));
                }
            }
        }
        try {
            const tracks = await Promise.all(trackPromises);
            exemplarTracks.value.push(...tracks);
            console.log('Exemplar tracks successfully added:', tracks.length);
        } catch (error) {
            console.error('Error generating exemplar tracks:', error);
        }
    }

    async function getExemplarTracks(): Promise<void> {
        exemplarTracks.value = [];
        const trackPromises: Promise<ExemplarTrack>[] = [];

        // // Pull out the arrays of Drug and Concentration tags from currentExperimentTags
        // const drugTags = currentExperimentTags.value?.['Drug'] || [];
        // const concTags =
        //     currentExperimentTags.value?.['Concentration (um)'] || [];

        // // Loop through all possible drugs and concentrations
        // drugTags.forEach((drug) => {
        //     concTags.forEach((conc) => {
        //         // Only proceed if both 'drug' and 'conc' are defined
        //         if (drug && conc) {
        //             for (const p of [5, 50, 95]) {
        //                 trackPromises.push(getExemplarTrack(drug, conc, p));
        //             }
        //         }
        //     });
        // });
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
                for (const p of [5, 50, 95]) {
                    trackPromises.push(getExemplarTrack(drug, conc, p));
                }
            }
        }

        try {
            const tracks = await Promise.all(trackPromises);
            exemplarTracks.value.push(...tracks);
            console.log('Exemplar tracks successfully added:', tracks.length);
        } catch (error) {
            console.error('Error generating exemplar tracks:', error);
        }
    }

    // 2. Expose fakeHistogramData and histogramDomains
    const getFakeHistogramData = computed(() => fakeHistogramData.value);
    const getHistogramDomains = computed(() => histogramDomains.value);

    return {
        generateTestExemplarTracks,
        getExemplarTracks,
        exemplarTracks,
        viewConfiguration,
        exemplarHeight,
        conditionGroupHeight,
        getTotalExperimentTime,
        // Expose the new state
        getFakeHistogramData,
        getHistogramDomains,
    };
});
